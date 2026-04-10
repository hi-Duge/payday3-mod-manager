const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPathForFile: (file) => (file && typeof webUtils !== 'undefined' && webUtils.getPathForFile) ? webUtils.getPathForFile(file) : '',
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  getPayday3GameUserSettingsPath: () => ipcRenderer.invoke('get-payday3-game-user-settings-path'),
  getPayday3GameUserSettingsPathInfo: () => ipcRenderer.invoke('get-payday3-game-user-settings-path-info'),
  setPayday3GameUserSettingsCustomPath: (filePath) =>
    ipcRenderer.invoke('set-payday3-game-user-settings-custom-path', filePath),
  readPayday3GameUserSettings: () => ipcRenderer.invoke('read-payday3-game-user-settings'),
  writePayday3GameUserSettingsCrosshairs: (replacements) =>
    ipcRenderer.invoke('write-payday3-game-user-settings-crosshairs', replacements),
  hasPayday3CrosshairBackup: () => ipcRenderer.invoke('has-payday3-crosshair-backup'),
  restorePayday3GameUserSettingsCrosshairs: () =>
    ipcRenderer.invoke('restore-payday3-game-user-settings-crosshairs'),
  getConfigPath: (name) => ipcRenderer.invoke('get-config-path', name),
  readFile: (filePath, encoding) => ipcRenderer.invoke('read-file', filePath, encoding),
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('write-file', filePath, data, encoding),
  fileExists: (p) => ipcRenderer.invoke('file-exists', p),
  modExists: (modsDir, filename) => ipcRenderer.invoke('mod-exists', modsDir, filename),
  modExistsAnyVariant: (modsDir, filename) => ipcRenderer.invoke('mod-exists-any-variant', modsDir, filename),
  ensureModsDir: (basePath) => ipcRenderer.invoke('ensure-mods-dir', basePath),
  listMods: (modsDir) => ipcRenderer.invoke('list-mods', modsDir),
  sortMods: (modsDir, mods, sortKey) => ipcRenderer.invoke('sort-mods', modsDir, mods, sortKey),
  setEnabled: (modsDir, filename, enabled) => ipcRenderer.invoke('set-enabled', modsDir, filename, enabled),
  removeMod: (modsDir, filename, moveToRecycle) => ipcRenderer.invoke('remove-mod', modsDir, filename, moveToRecycle),
  getDeletedModsPath: () => ipcRenderer.invoke('get-deleted-mods-path'),
  listDeletedMods: () => ipcRenderer.invoke('list-deleted-mods'),
  getDeletedModsStorageBytes: () => ipcRenderer.invoke('get-deleted-mods-storage-bytes'),
  restoreDeletedMod: (modsDir, filename) => ipcRenderer.invoke('restore-deleted-mod', modsDir, filename),
  permanentlyDeleteFromRecycle: (filename) => ipcRenderer.invoke('permanently-delete-from-recycle', filename),
  deleteAllFromRecycle: () => ipcRenderer.invoke('delete-all-from-recycle'),
  getModDate: (modsDir, filename) => ipcRenderer.invoke('get-mod-date', modsDir, filename),
  setModDate: (modsDir, filename, dateStr) => ipcRenderer.invoke('set-mod-date', modsDir, filename, dateStr),
  getModMtime: (modsDir, filename) => ipcRenderer.invoke('get-mod-mtime', modsDir, filename),
  extractArchive: (archivePath) => ipcRenderer.invoke('extract-archive', archivePath),
  copyPakToMods: (srcPath, modsDir) => ipcRenderer.invoke('copy-pak-to-mods', srcPath, modsDir),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showFolderDialog: (title) => ipcRenderer.invoke('show-folder-dialog', title),
  openPath: (pathOrUrl) => ipcRenderer.invoke('open-path', pathOrUrl),
  pathToFileUrl: (fsPath) => ipcRenderer.invoke('path-to-file-url', fsPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  launchGame: () => ipcRenderer.invoke('launch-game'),
  killPayday3: () => ipcRenderer.invoke('kill-payday3'),
  discordInit: (clientId) => ipcRenderer.invoke('discord-init', clientId),
  discordUpdate: (details, state, startTimestamp) => ipcRenderer.invoke('discord-update', details, state, startTimestamp),
  discordClear: () => ipcRenderer.invoke('discord-clear'),
  discordShutdown: () => ipcRenderer.invoke('discord-shutdown'),
  isPayday3Running: () => ipcRenderer.invoke('is-payday3-running'),
  getTitlebarIconDataUrl: () => ipcRenderer.invoke('get-titlebar-icon-data-url'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateDownloadProgress: (callback) => {
    const handler = (_, payload) => {
      if (callback && typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_, payload) => {
      if (callback && typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateDownloadError: (callback) => {
    const handler = (_, payload) => {
      if (callback && typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('update-download-error', handler);
    return () => ipcRenderer.removeListener('update-download-error', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPatchNotes: () => ipcRenderer.invoke('get-patch-notes'),
  birageDefaultSkinDir: () => ipcRenderer.invoke('birage-default-skin-dir'),
  birageListSkins: (customDir) => ipcRenderer.invoke('birage-list-skins', customDir),
  birageReadSkin: (filePath) => ipcRenderer.invoke('birage-read-skin', filePath),
  birageLoadSkinsData: (customDir) => ipcRenderer.invoke('birage-load-skins-data', customDir),
  onWindowState: (callback) => {
    const handler = (_, state) => {
      if (callback && typeof callback === 'function') callback(state);
    };
    ipcRenderer.on('window-state', handler);
    return () => ipcRenderer.removeListener('window-state', handler);
  },
});
