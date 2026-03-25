const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

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
  mainWindow.webContents.once('did-finish-load', () => broadcastWindowState(mainWindow));
  mainWindow.on('close', () => {
    stopDiscordGameCheck();
    if (discordService) discordService.shutdown();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

let autoUpdaterRef = null;

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
  try {
    await autoUpdaterRef.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: formatUpdaterError(err) };
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
