const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const WINDOWS_APP_ID = 'com.payday3modmanager.app';

let modService;
let discordService;
let startupError = null;
try {
  modService = require('./modService');
  discordService = require('./discordService');
} catch (err) {
  startupError = err;
  console.error('Startup error:', err);
}

let mainWindow = null;
let lastDiscordClientId = null;
let lastDiscordActivity = null;
let discordDisabledByGame = false;
let discordGameCheckInterval = null;
const DISCORD_GAME_CHECK_MS = 4000;

app.setName('PAYDAY 3 Mod Manager');

if (process.platform === 'win32') {
  // Keep Windows taskbar pinning tied to the packaged app identity across updates.
  app.setAppUserModelId(WINDOWS_APP_ID);
  const roaming = app.getPath('appData');
  app.setPath('userData', path.join(roaming, 'Payday3ModManager'));
}

function getAppDataPath() {
  const dir = app.getPath('userData');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function getIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'icon.ico'),
        path.join(process.resourcesPath, 'icon.png'),
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icon.png'),
      ]
    : [
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, '..', 'icon.ico'),
        path.join(__dirname, '..', 'icon.png'),
      ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return path.resolve(p);
  }
  return null;
}

function getTitlebarIconDataUrl() {
  const iconPath = getIconPath();
  if (!iconPath) return null;
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) return null;
    let sized = img;
    try {
      sized = img.resize({ width: 32, height: 32 });
    } catch (_) {}
    if (typeof sized.toDataURL === 'function') return sized.toDataURL();
    const buf = sized.toPNG();
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch (_) {
    return null;
  }
}

function broadcastWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('window-state', { maximized: win.isMaximized() });
  } catch (_) {}
}

function createWindow() {
  const winOpts = {
    width: 1040,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow <video src="file://..."> for absolute paths (custom protocol streaming is unreliable for media).
      webSecurity: false,
    },
  };
  const iconPath = getIconPath();
  if (iconPath) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) winOpts.icon = img;
  }
  mainWindow = new BrowserWindow(winOpts);
  mainWindow.setTitle('PAYDAY 3 Mod Manager');
  if (iconPath) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) mainWindow.setIcon(img);
  }
  mainWindow.on('maximize', () => broadcastWindowState(mainWindow));
  mainWindow.on('unmaximize', () => broadcastWindowState(mainWindow));
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.once('did-finish-load', () => broadcastWindowState(mainWindow));
  mainWindow.on('close', () => {
    stopDiscordGameCheck();
    if (discordService) discordService.shutdown();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

let autoUpdaterRef = null;
let updateDownloadActive = false;

function sendUpdateToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send(channel, payload);
  } catch (_) {}
}

function formatUpdaterError(err) {
  if (!err) return 'Update check failed.';
  const httpCode = err.statusCode || err.status || (err.response && err.response.statusCode);
  const raw = err.message != null ? String(err.message) : String(err);
  const ec = err.code;

  if (ec === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') {
    return (
      'This release on GitHub has no latest.yml asset. The updater needs latest.yml next to the installer. ' +
      'From the project folder run: npm run release (with GH_TOKEN set) so electron-builder uploads dist output including latest.yml.'
    );
  }
  if (ec === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS') {
    return 'No GitHub Releases found for this repo. Create a release (e.g. npm run release) with build.publish owner/repo pointing at that repository.';
  }
  if (ec === 'ERR_UPDATER_ASSET_NOT_FOUND') {
    return (
      'An installer file listed in latest.yml is missing from the release assets. Re-run npm run release or re-upload the .exe and blockmap from dist/.'
    );
  }
  if (ec === 'ERR_UPDATER_INVALID_RELEASE_FEED') {
    return (
      'The GitHub releases feed could not be parsed. Confirm the repository is public, has at least one Release, and try again.'
    );
  }
  if (ec === 'ERR_UPDATER_INVALID_UPDATE_INFO') {
    if (/rawData:\s*<\!DOCTYPE/i.test(raw) || /rawData:\s*<\s*html/i.test(raw) || /Unexpected token.*</i.test(raw)) {
      return (
        'GitHub returned HTML instead of latest.yml (wrong file URL, private asset, or API rate limit). ' +
        'On the release page, open the latest.yml asset: it must display plain YAML. Rebuild and publish with npm run release so assets stay in sync.'
      );
    }
    if (/rawData:\s*null/i.test(raw) || /rawData:\s*$/m.test(raw)) {
      return 'latest.yml downloaded empty. Remove and re-upload the asset from dist/latest.yml, or run npm run release again.';
    }
    return (
      'latest.yml is not valid YAML or does not match this app. ' +
      'After npm run release, do not rename release files on GitHub; paths in latest.yml must match asset names exactly (installer .exe and .blockmap).'
    );
  }

  if (httpCode === 406 || /\b406\b/.test(raw)) {
    return (
      'GitHub returned 406. Ensure build.publish owner/repo match the releases repo and you published a Release with latest.yml and the installer assets.'
    );
  }
  if (
    ec === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' ||
    /ERR_UPDATER_LATEST_VERSION_NOT_FOUND/i.test(raw) ||
    /Unable to find latest version on GitHub/i.test(raw) ||
    /Cannot parse releases feed/i.test(raw)
  ) {
    return (
      'Could not read the latest GitHub release. Common causes: (1) no Release yet, or only draft releases; ' +
      '(2) the newest release is marked Pre-release — GitHub treats “latest” as the newest non-prerelease, so uncheck that or publish a stable release; ' +
      '(3) owner/repo in package.json does not match the repo. Publish with: npm run release (uploads latest.yml, installer, blockmap).'
    );
  }
  if (httpCode === 404 || /\b404\b/.test(raw) || /not found/i.test(raw)) {
    return (
      'No update on GitHub (404). Create a Release and upload latest.yml, the NSIS Setup .exe, and .blockmap from your dist folder (npm run release does this).'
    );
  }
  if (raw.length > 360) {
    return raw.slice(0, 360).trim() + '…';
  }
  return raw;
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdaterRef = autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('download-progress', (progress) => {
      sendUpdateToRenderer('update-download-progress', {
        percent: typeof progress.percent === 'number' ? progress.percent : 0,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      updateDownloadActive = false;
      const ver = info && info.version != null ? String(info.version) : '';
      sendUpdateToRenderer('update-downloaded', { version: ver });
    });
    autoUpdater.on('error', (err) => {
      console.warn('[auto-update]', err && err.stack ? err.stack : err);
      console.warn('[auto-update]', formatUpdaterError(err));
    });
    const sixHours = 6 * 60 * 60 * 1000;
    setInterval(() => {
      try {
        autoUpdater.checkForUpdates();
      } catch (_) {}
    }, sixHours);
  } catch (e) {
    console.warn('[auto-update] init failed', e);
    autoUpdaterRef = null;
  }
}

app.whenReady().then(() => {
  if (startupError) {
    dialog.showErrorBox('PAYDAY 3 Mod Manager', 'Failed to load: ' + (startupError.message || String(startupError)) + '\n\nRun "npm install" in the electron folder.');
    app.quit();
    return;
  }
  Menu.setApplicationMenu(null);
  createWindow();
  if (mainWindow) mainWindow.setMenuBarVisibility(false);
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopDiscordGameCheck();
  if (discordService) discordService.shutdown();
  app.exit(0);
});

ipcMain.handle('path-to-file-url', (_, fsPath) => {
  try {
    if (!fsPath || typeof fsPath !== 'string') return '';
    const normalized = path.normalize(fsPath.trim());
    if (!/\.(mp4|webm|mkv|mov)$/i.test(normalized)) return '';
    return pathToFileURL(normalized).href;
  } catch (_) {
    return '';
  }
});
ipcMain.handle('get-titlebar-icon-data-url', () => getTitlebarIconDataUrl());
ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});
ipcMain.handle('window-is-maximized', () =>
  Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()));

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-patch-notes', () => {
  try {
    const p = path.join(__dirname, 'renderer', 'patchnotes.md');
    return fs.readFileSync(p, 'utf-8');
  } catch (_) {
    return '';
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, message: 'Update checks apply to the installed app. Run a packaged build to check for updates.' };
  }
  if (!autoUpdaterRef) {
    return { ok: false, message: 'The updater is not available.' };
  }
  try {
    const result = await autoUpdaterRef.checkForUpdates();
    if (result && result.isUpdateAvailable) {
      const ver = result.updateInfo && result.updateInfo.version ? String(result.updateInfo.version) : '';
      return {
        ok: true,
        updateAvailable: true,
        version: ver,
        message: ver ? `Update available: ${ver}` : 'Update available.',
      };
    }
    return { ok: true, updateAvailable: false, message: 'You are up to date.' };
  } catch (err) {
    return { ok: false, message: formatUpdaterError(err) };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged || !autoUpdaterRef) {
    return { ok: false, message: 'Updates are only available in the installed app.' };
  }
  updateDownloadActive = true;
  autoUpdaterRef
    .downloadUpdate()
    .then(() => {
      updateDownloadActive = false;
    })
    .catch((err) => {
      updateDownloadActive = false;
      sendUpdateToRenderer('update-download-error', { message: formatUpdaterError(err) });
    });
  return { ok: true };
});

ipcMain.handle('quit-and-install', () => {
  if (!app.isPackaged || !autoUpdaterRef) return false;
  try {
    autoUpdaterRef.quitAndInstall(false, true);
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.handle('get-app-data-path', () => getAppDataPath());
ipcMain.handle('get-config-path', (_, name) => path.join(getAppDataPath(), name));

ipcMain.handle('read-file', async (_, filePath, encoding = 'utf-8') => {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (_) {
    return null;
  }
});

ipcMain.handle('write-file', async (_, filePath, data, encoding = 'utf-8') => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, encoding);
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.handle('file-exists', (_, p) => {
  try { return fs.existsSync(p); } catch (_) { return false; }
});

const CROSSHAIR_PATHS_JSON = 'crosshair_paths.json';

function getDefaultPayday3GameUserSettingsCandidates() {
  const list = [];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    list.push(path.join(local, 'PAYDAY3', 'Saved', 'Config', 'WindowsNoEditor', 'GameUserSettings.ini'));
  } else if (process.platform === 'darwin') {
    const base = path.join(os.homedir(), 'Library', 'Application Support', 'PAYDAY3', 'Saved', 'Config');
    list.push(path.join(base, 'Mac', 'GameUserSettings.ini'));
    list.push(path.join(base, 'MacClient', 'GameUserSettings.ini'));
  } else {
    const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const base = path.join(xdg, 'PAYDAY3', 'Saved', 'Config');
    list.push(path.join(base, 'LinuxClient', 'GameUserSettings.ini'));
    list.push(path.join(base, 'Unix', 'GameUserSettings.ini'));
  }
  return list;
}

function readCrosshairIniOverride() {
  try {
    const raw = fs.readFileSync(path.join(getAppDataPath(), CROSSHAIR_PATHS_JSON), 'utf8');
    const j = JSON.parse(raw);
    if (j && typeof j.customIniPath === 'string') {
      const t = j.customIniPath.trim();
      return t ? path.normalize(t) : null;
    }
  } catch (_) {}
  return null;
}

function writeCrosshairIniOverride(customIniPath) {
  fs.writeFileSync(
    path.join(getAppDataPath(), CROSSHAIR_PATHS_JSON),
    JSON.stringify({ customIniPath: customIniPath || null }, null, 2),
    'utf8'
  );
}

/** Active INI path: optional user override, else first default path that exists, else first default (for display). */
function getPayday3GameUserSettingsPath() {
  const custom = readCrosshairIniOverride();
  if (custom) {
    try {
      if (fs.existsSync(custom)) return custom;
    } catch (_) {}
  }
  const candidates = getDefaultPayday3GameUserSettingsCandidates();
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return candidates[0];
}

const CROSSHAIR_INI_KEYS = [
  'CrosshairsBarWidth',
  'CrosshairsBarLength',
  'CrosshairsDotSize',
  'bCrosshairsShowAccuracy',
  'CrosshairsCenterGap',
  'CrosshairsBarColor',
  'CrosshairsDotColor',
];

const CROSSHAIR_INI_BACKUP_JSON = 'crosshair_ini_backup.json';

function extractCrosshairKeysFromIni(content) {
  const out = {};
  const lines = String(content).split(/\r?\n/);
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (CROSSHAIR_INI_KEYS.includes(key)) {
      out[key] = line.slice(eq + 1).trim();
    }
  }
  return out;
}

function readCrosshairIniBackup() {
  try {
    const raw = fs.readFileSync(path.join(getAppDataPath(), CROSSHAIR_INI_BACKUP_JSON), 'utf8');
    const j = JSON.parse(raw);
    if (j && j.values && typeof j.values === 'object') return j.values;
  } catch (_) {}
  return null;
}

function writeCrosshairIniBackup(values) {
  fs.writeFileSync(
    path.join(getAppDataPath(), CROSSHAIR_INI_BACKUP_JSON),
    JSON.stringify({ savedAt: new Date().toISOString(), values }, null, 2),
    'utf8'
  );
}

/** Replace only crosshair-related keys; other lines unchanged. Missing keys are appended at end. */
function patchGameUserSettingsCrosshairs(content, replacements) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const used = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      lines[i] = `${key}=${replacements[key]}`;
      used.add(key);
    }
  }
  for (const k of Object.keys(replacements)) {
    if (!used.has(k)) {
      lines.push(`${k}=${replacements[k]}`);
    }
  }
  return lines.join(eol);
}

ipcMain.handle('get-payday3-game-user-settings-path', () => getPayday3GameUserSettingsPath());

ipcMain.handle('get-payday3-game-user-settings-path-info', () => {
  const customIniPath = readCrosshairIniOverride();
  const candidates = getDefaultPayday3GameUserSettingsCandidates();
  const resolved = getPayday3GameUserSettingsPath();
  let resolvedExists = false;
  try {
    resolvedExists = fs.existsSync(resolved);
  } catch (_) {}
  return {
    path: resolved,
    pathDir: path.dirname(resolved),
    customIniPath,
    candidates,
    resolvedExists,
  };
});

ipcMain.handle('set-payday3-game-user-settings-custom-path', (_, maybePath) => {
  if (maybePath == null || maybePath === '') {
    writeCrosshairIniOverride(null);
    return { ok: true, path: getPayday3GameUserSettingsPath() };
  }
  const p = path.normalize(String(maybePath).trim());
  if (!/\.ini$/i.test(p)) {
    return { ok: false, message: 'Select a .ini file (e.g. GameUserSettings.ini).' };
  }
  try {
    if (!fs.existsSync(p)) {
      return { ok: false, message: 'That file does not exist.' };
    }
  } catch (e) {
    return { ok: false, message: e && e.message ? String(e.message) : String(e) };
  }
  writeCrosshairIniOverride(p);
  return { ok: true, path: getPayday3GameUserSettingsPath() };
});

ipcMain.handle('read-payday3-game-user-settings', async () => {
  const p = getPayday3GameUserSettingsPath();
  try {
    const fileContent = fs.readFileSync(p, 'utf8');
    return { ok: true, path: p, content: fileContent };
  } catch (e) {
    return { ok: false, path: p, message: e && e.message ? String(e.message) : String(e) };
  }
});

ipcMain.handle('write-payday3-game-user-settings-crosshairs', async (_, replacements) => {
  const p = getPayday3GameUserSettingsPath();
  let fileContent;
  try {
    fileContent = fs.readFileSync(p, 'utf8');
  } catch (e) {
    return { ok: false, message: 'Could not read GameUserSettings.ini: ' + (e && e.message ? e.message : String(e)) };
  }
  const before = extractCrosshairKeysFromIni(fileContent);
  if (Object.keys(before).length > 0) {
    writeCrosshairIniBackup(before);
  }
  const next = patchGameUserSettingsCrosshairs(fileContent, replacements);
  try {
    fs.writeFileSync(p, next, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? String(e.message) : String(e) };
  }
});

ipcMain.handle('has-payday3-crosshair-backup', () => {
  const b = readCrosshairIniBackup();
  return { hasBackup: !!(b && Object.keys(b).length > 0) };
});

ipcMain.handle('restore-payday3-game-user-settings-crosshairs', async () => {
  const backup = readCrosshairIniBackup();
  if (!backup || Object.keys(backup).length === 0) {
    return {
      ok: false,
      message: 'No backup yet. Save to the game once to store the previous crosshair values.',
    };
  }
  const p = getPayday3GameUserSettingsPath();
  let fileContent;
  try {
    fileContent = fs.readFileSync(p, 'utf8');
  } catch (e) {
    return { ok: false, message: 'Could not read GameUserSettings.ini: ' + (e && e.message ? e.message : String(e)) };
  }
  const next = patchGameUserSettingsCrosshairs(fileContent, backup);
  try {
    fs.writeFileSync(p, next, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? String(e.message) : String(e) };
  }
});

/** Default folder for birage case-opening skins (see message.txt / user Downloads). */
function birageDefaultSkinDir() {
  return path.join(os.homedir(), 'Downloads', 'biragepackage_images', 'biragepackage_images');
}

ipcMain.handle('birage-default-skin-dir', () => birageDefaultSkinDir());

ipcMain.handle('birage-list-skins', async (_, customDir) => {
  const dir = (customDir && String(customDir).trim()) || birageDefaultSkinDir();
  try {
    if (!fs.existsSync(dir)) {
      return { ok: false, error: 'not_found', dir, files: [] };
    }
    const names = fs.readdirSync(dir).filter((n) => /\.png$/i.test(n));
    return { ok: true, dir, files: names.sort((a, b) => a.localeCompare(b)) };
  } catch (e) {
    return { ok: false, error: e.message || String(e), dir, files: [] };
  }
});

ipcMain.handle('birage-read-skin', async (_, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString('base64');
    return { ok: true, dataUrl: `data:image/png;base64,${b64}` };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

/** Same color keys as renderer BIRAGE_TIER_HEX; longest first for substring match. */
const BIRAGE_TIER_KEYS_SORTED = [
  'scarlet', 'crimson', 'magenta', 'indigo', 'purple', 'yellow', 'orange', 'silver', 'bronze', 'brown', 'violet',
  'green', 'black', 'white', 'navy', 'cyan', 'teal', 'blue', 'lime', 'pink', 'rose', 'gold', 'gray', 'grey',
  'red', 'sky',
].sort((a, b) => b.length - a.length || a.localeCompare(b));

const BIRAGE_TIER_KEY_SET = new Set(BIRAGE_TIER_KEYS_SORTED);

function birageLongestTierKeyInString(s) {
  if (!s) return null;
  let best = '';
  for (const name of BIRAGE_TIER_KEYS_SORTED) {
    if (s.includes(name) && name.length > best.length) best = name;
  }
  return best || null;
}

/** Tier from basename: red.png → red, pink1.png → pink; also handles red_skin.png, weapon_pink1.png, etc. */
function birageTierFromFilename(filename) {
  const base = filename.replace(/\.png$/i, '');
  const lower = base.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean).map((t) => t.replace(/\d+$/, '').replace(/_+$/, '')).filter(Boolean);

  let tierKey = null;
  for (const seg of tokens) {
    if (BIRAGE_TIER_KEY_SET.has(seg)) {
      tierKey = seg;
      break;
    }
  }
  if (!tierKey) {
    for (const seg of tokens) {
      const hit = birageLongestTierKeyInString(seg);
      if (hit) {
        tierKey = hit;
        break;
      }
    }
  }
  if (!tierKey) {
    const compact = lower.replace(/\d+$/, '').replace(/[^a-z0-9]/g, '');
    tierKey = birageLongestTierKeyInString(compact);
  }
  if (!tierKey) {
    const stem = lower.replace(/\d+$/, '').replace(/[^a-z0-9]/g, '');
    tierKey = stem || 'unknown';
  }
  const tierLabel = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
  return { tierKey, tierLabel };
}

/** Load PNG skins from the birage folder as data URLs (max 64) for the case-opening UI. */
ipcMain.handle('birage-load-skins-data', async (_, customDir) => {
  const dir = (customDir && String(customDir).trim()) || birageDefaultSkinDir();
  try {
    if (!fs.existsSync(dir)) {
      return { ok: false, error: 'not_found', dir, skins: [] };
    }
    const names = fs.readdirSync(dir).filter((n) => /\.png$/i.test(n)).sort((a, b) => a.localeCompare(b));
    const skins = [];
    const cap = Math.min(names.length, 64);
    for (let i = 0; i < cap; i++) {
      const fp = path.join(dir, names[i]);
      const buf = fs.readFileSync(fp);
      const { tierKey, tierLabel } = birageTierFromFilename(names[i]);
      skins.push({
        name: names[i],
        dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
        tierKey,
        tierLabel,
      });
    }
    return { ok: true, dir, skins };
  } catch (e) {
    return { ok: false, error: e.message || String(e), dir, skins: [] };
  }
});
ipcMain.handle('mod-exists', (_, modsDir, filename) => {
  try { return fs.existsSync(path.join(modsDir, filename)); } catch (_) { return false; }
});
ipcMain.handle('mod-exists-any-variant', (_, modsDir, filename) => modService.modExistsAnyVariant(modsDir, filename));

ipcMain.handle('ensure-mods-dir', (_, basePath) => modService.ensureModsDir(basePath));
ipcMain.handle('list-mods', (_, modsDir) => modService.listMods(modsDir));
ipcMain.handle('sort-mods', (_, modsDir, mods, sortKey) => {
  const appData = getAppDataPath();
  const getDate = (dir, fn) => modService.getModDateAdded(appData, dir, fn);
  return modService.sortMods(modsDir, mods, sortKey, getDate);
});
ipcMain.handle('set-enabled', (_, modsDir, filename, enabled) => modService.setEnabled(modsDir, filename, enabled));
ipcMain.handle('remove-mod', (_, modsDir, filename, moveToRecycle) => modService.removeMod(modsDir, filename, !!moveToRecycle));
ipcMain.handle('get-deleted-mods-path', () => modService.getDeletedModsFolderPath());
ipcMain.handle('list-deleted-mods', () => modService.listDeletedMods());
ipcMain.handle('get-deleted-mods-storage-bytes', () => modService.getDeletedModsStorageBytes());
ipcMain.handle('restore-deleted-mod', (_, modsDir, filename) => modService.restoreDeletedMod(modsDir, filename));
ipcMain.handle('permanently-delete-from-recycle', (_, filename) => modService.permanentlyDeleteFromRecycle(filename));
ipcMain.handle('delete-all-from-recycle', () => modService.deleteAllFromRecycle());
ipcMain.handle('get-mod-date', (_, modsDir, filename) => modService.getModDateAdded(getAppDataPath(), modsDir, filename));
ipcMain.handle('set-mod-date', (_, modsDir, filename, dateStr) => modService.setModDateAdded(getAppDataPath(), modsDir, filename, dateStr));
ipcMain.handle('get-mod-mtime', (_, modsDir, filename) => {
  try {
    const stat = fs.statSync(path.join(modsDir, filename));
    return stat.mtime.toISOString();
  } catch (_) { return null; }
});
ipcMain.handle('extract-archive', (_, archivePath) => modService.extractPaksFromArchive(archivePath));
ipcMain.handle('copy-pak-to-mods', (_, srcPath, modsDir) => modService.copyPakToMods(srcPath, modsDir));
ipcMain.handle('show-open-dialog', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result.canceled ? null : result.filePaths;
});
ipcMain.handle('show-folder-dialog', async (_, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Select folder',
    properties: ['openDirectory'],
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});
ipcMain.handle('open-path', (_, pathOrUrl) => shell.openPath(pathOrUrl));
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('launch-game', () => shell.openExternal('steam://rungameid/1272080'));

function startDiscordGameCheck() {
  if (discordGameCheckInterval || process.platform !== 'win32') return;
  discordGameCheckInterval = setInterval(async () => {
    try {
      const running = await modService.isPayday3ShippingRunningAsync();
      if (running && !discordDisabledByGame && lastDiscordClientId) {
        discordService.shutdown();
        discordDisabledByGame = true;
      } else if (!running && discordDisabledByGame && lastDiscordClientId) {
        const ok = await discordService.init(lastDiscordClientId);
        discordDisabledByGame = false;
        if (ok && lastDiscordActivity) {
          discordService.update(
            lastDiscordActivity.details,
            lastDiscordActivity.state,
            lastDiscordActivity.startTimestamp
          );
        }
      }
    } catch (_) {}
  }, DISCORD_GAME_CHECK_MS);
}

function stopDiscordGameCheck() {
  if (discordGameCheckInterval) {
    clearInterval(discordGameCheckInterval);
    discordGameCheckInterval = null;
  }
}

ipcMain.handle('discord-init', async (_, clientId) => {
  if (!discordService) return false;
  lastDiscordClientId = clientId || null;
  const result = await discordService.init(clientId);
  if (result && process.platform === 'win32') startDiscordGameCheck();
  return result;
});
ipcMain.handle('discord-update', (_, details, state, startTimestamp) => {
  if (!discordService) return false;
  lastDiscordActivity = details != null || state != null || startTimestamp != null
    ? { details, state, startTimestamp }
    : null;
  return discordService.update(details, state, startTimestamp);
});
ipcMain.handle('discord-clear', () => discordService ? discordService.clear() : false);
ipcMain.handle('discord-shutdown', () => {
  stopDiscordGameCheck();
  discordDisabledByGame = false;
  lastDiscordClientId = null;
  lastDiscordActivity = null;
  return discordService ? discordService.shutdown() : undefined;
});
ipcMain.handle('is-payday3-running', async () => modService.isPayday3ShippingRunningAsync());
