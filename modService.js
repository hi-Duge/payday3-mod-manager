const fs = require('fs');
const path = require('path');
const { execSync, execFile } = require('child_process');
const AdmZip = require('adm-zip');
const os = require('os');

const MODS_FOLDER_NAME = '~mods';
const PAK_EXT = '.pak';
const DISABLED_SUFFIX = '.disabled';

const SEVEN_ZIP_PATHS = [
  path.join(process.env['ProgramFiles'] || '', '7-Zip', '7z.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', '7-Zip', '7z.exe'),
];

function find7z() {
  for (const p of SEVEN_ZIP_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function ensureModsDir(basePath) {
  let resolved = path.resolve(basePath);
  if (path.basename(resolved) === MODS_FOLDER_NAME) {
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  if (path.basename(resolved) === 'PAYDAY3') {
    resolved = path.join(resolved, 'PAYDAY3', 'Content', 'Paks', MODS_FOLDER_NAME);
  } else {
    resolved = path.join(resolved, 'PAYDAY3', 'PAYDAY3', 'Content', 'Paks', MODS_FOLDER_NAME);
  }
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function listMods(modsDir) {
  if (!modsDir || !fs.existsSync(modsDir) || !fs.statSync(modsDir).isDirectory()) {
    return [];
  }
  const out = [];
  const entries = fs.readdirSync(modsDir);
  for (const f of entries) {
    const full = path.join(modsDir, f);
    if (!fs.statSync(full).isFile()) continue;
    if (f.endsWith(DISABLED_SUFFIX)) {
      const base = f.slice(0, -DISABLED_SUFFIX.length);
      if (base.toLowerCase().endsWith(PAK_EXT)) out.push([f, false]);
    } else if (f.toLowerCase().endsWith(PAK_EXT)) {
      out.push([f, true]);
    }
  }
  return out;
}

const SORT_DATE_NEWEST = 'date_newest';
const SORT_DATE_OLDEST = 'date_oldest';
const SORT_NAME_AZ = 'name_az';
const SORT_NAME_ZA = 'name_za';

function sortMods(modsDir, mods, sortKey, getModDateAdded) {
  if (sortKey === SORT_NAME_AZ) return [...mods].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
  if (sortKey === SORT_NAME_ZA) return [...mods].sort((a, b) => b[0].localeCompare(a[0], undefined, { sensitivity: 'base' }));
  if (sortKey === SORT_DATE_NEWEST || sortKey === SORT_DATE_OLDEST) {
    const getTs = (item) => {
      const dateStr = getModDateAdded(modsDir, item[0]);
      if (dateStr) {
        try {
          return new Date(dateStr.replace('Z', '+00:00')).getTime();
        } catch (_) {}
      }
      try {
        return fs.statSync(path.join(modsDir, item[0])).mtimeMs;
      } catch (_) {
        return 0;
      }
    };
    return [...mods].sort((a, b) => {
      const ta = getTs(a), tb = getTs(b);
      return sortKey === SORT_DATE_NEWEST ? tb - ta : ta - tb;
    });
  }
  return [...mods].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
}

function setEnabled(modsDir, filename, enabled) {
  const src = path.join(modsDir, filename);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return false;
  let dest;
  if (enabled) {
    if (!filename.endsWith(DISABLED_SUFFIX)) return true;
    dest = path.join(modsDir, filename.slice(0, -DISABLED_SUFFIX.length));
  } else {
    if (filename.endsWith(DISABLED_SUFFIX)) return true;
    dest = path.join(modsDir, filename + DISABLED_SUFFIX);
  }
  try {
    // If both enabled and disabled variants exist, remove the destination variant first
    // so toggling always succeeds for the selected file.
    if (fs.existsSync(dest) && fs.statSync(dest).isFile()) {
      fs.unlinkSync(dest);
    }
    fs.renameSync(src, dest);
    return true;
  } catch (_) {
    return false;
  }
}

function modExistsAnyVariant(modsDir, filename) {
  const enabledName = filename.endsWith(DISABLED_SUFFIX) ? filename.slice(0, -DISABLED_SUFFIX.length) : filename;
  const disabledName = enabledName + DISABLED_SUFFIX;
  try {
    return fs.existsSync(path.join(modsDir, enabledName)) || fs.existsSync(path.join(modsDir, disabledName));
  } catch (_) {
    return false;
  }
}

const DELETED_MODS_FOLDER = path.join(os.tmpdir(), 'Payday3ModManager', 'deleted');

function getDeletedModsFolderPath() {
  return DELETED_MODS_FOLDER;
}

function ensureDeletedFolder() {
  try {
    fs.mkdirSync(DELETED_MODS_FOLDER, { recursive: true });
  } catch (_) {}
}

function removeMod(modsDir, filename, moveToRecycle = false) {
  const full = path.join(modsDir, filename);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
  if (moveToRecycle) {
    try {
      ensureDeletedFolder();
      const baseName = path.basename(filename);
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let target = path.join(DELETED_MODS_FOLDER, baseName);
      let n = 0;
      while (fs.existsSync(target)) {
        n++;
        target = path.join(DELETED_MODS_FOLDER, base + '_' + n + ext);
      }
      fs.copyFileSync(full, target);
      fs.unlinkSync(full);
      return true;
    } catch (_) {
      moveToRecycle = false;
    }
  }
  if (!moveToRecycle) {
    try {
      fs.unlinkSync(full);
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

function listDeletedMods() {
  if (!fs.existsSync(DELETED_MODS_FOLDER)) return [];
  const names = [];
  try {
    for (const f of fs.readdirSync(DELETED_MODS_FOLDER)) {
      const full = path.join(DELETED_MODS_FOLDER, f);
      if (fs.statSync(full).isFile() && (f.toLowerCase().endsWith(PAK_EXT) || f.endsWith(DISABLED_SUFFIX))) {
        names.push(f);
      }
    }
  } catch (_) {}
  return names;
}

function getDeletedModsStorageBytes() {
  if (!fs.existsSync(DELETED_MODS_FOLDER)) return 0;
  let total = 0;
  try {
    for (const f of fs.readdirSync(DELETED_MODS_FOLDER)) {
      const full = path.join(DELETED_MODS_FOLDER, f);
      const st = fs.statSync(full);
      if (st.isFile() && (f.toLowerCase().endsWith(PAK_EXT) || f.endsWith(DISABLED_SUFFIX))) {
        total += st.size;
      }
    }
  } catch (_) {}
  return total;
}

function restoreDeletedMod(modsDir, filename) {
  const baseName = path.basename(filename);
  const src = path.join(DELETED_MODS_FOLDER, baseName);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return { ok: false, exists: false };
  const dest = path.join(modsDir, baseName);
  if (fs.existsSync(dest)) return { ok: false, exists: true };
  try {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
    return { ok: true };
  } catch (_) {
    return { ok: false, exists: false };
  }
}

function permanentlyDeleteFromRecycle(filename) {
  const full = path.join(DELETED_MODS_FOLDER, path.basename(filename));
  if (!fs.existsSync(full)) return false;
  try {
    fs.unlinkSync(full);
    return true;
  } catch (_) {
    return false;
  }
}

function deleteAllFromRecycle() {
  ensureDeletedFolder();
  const names = listDeletedMods();
  let deleted = 0;
  for (const f of names) {
    if (permanentlyDeleteFromRecycle(f)) deleted += 1;
  }
  return { deleted, total: names.length };
}

function extractPaksFromZip(zipPath) {
  const tmpDir = path.join(os.tmpdir(), 'pd3modmgr', path.basename(zipPath) + '_zip');
  fs.mkdirSync(tmpDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tmpDir, true);
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (e.toLowerCase().endsWith(PAK_EXT) && !e.toLowerCase().endsWith(DISABLED_SUFFIX)) out.push(full);
    }
  }
  walk(tmpDir);
  return out;
}

function extractPaksWith7z(archivePath) {
  const exe = find7z();
  if (!exe) return [];
  const tmpdir = path.join(os.tmpdir(), 'pd3modmgr', path.basename(archivePath) + '_extract');
  fs.mkdirSync(tmpdir, { recursive: true });
  try {
    execSync(`"${exe}" x "${archivePath}" -o"${tmpdir}" -y`, { windowsHide: true });
  } catch (_) {
    return [];
  }
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (e.toLowerCase().endsWith(PAK_EXT)) out.push(full);
    }
  }
  walk(tmpdir);
  return out;
}

function extractPaksFromArchive(archivePath) {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith('.zip')) return extractPaksFromZip(archivePath);
  if (lower.endsWith('.7z') || lower.endsWith('.rar')) return extractPaksWith7z(archivePath);
  return [];
}

function copyPakToMods(srcPath, modsDir) {
  const base = path.basename(srcPath);
  if (!base.toLowerCase().endsWith(PAK_EXT)) return false;
  const dest = path.join(modsDir, base);
  if (path.resolve(srcPath) === path.resolve(dest)) return false;
  try {
    fs.copyFileSync(srcPath, dest);
    return true;
  } catch (_) {
    return false;
  }
}

let metadataCache = null;
let metadataPath = null;

function getMetadataPath(appDataPath) {
  if (!metadataPath) metadataPath = path.join(appDataPath, 'mod_metadata.json');
  return metadataPath;
}

function loadModMetadata(appDataPath) {
  const p = getMetadataPath(appDataPath);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {
    return {};
  }
}

function saveModMetadata(appDataPath, data) {
  const p = getMetadataPath(appDataPath);
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch (_) {}
}

function getModDateAdded(appDataPath, modsDir, filename) {
  const data = loadModMetadata(appDataPath);
  const key = path.normalize(modsDir);
  if (!data[key]) return null;
  return data[key][filename] || null;
}

function setModDateAdded(appDataPath, modsDir, filename, dateStr) {
  const data = loadModMetadata(appDataPath);
  const key = path.normalize(modsDir);
  if (!data[key]) data[key] = {};
  if (dateStr) data[key][filename] = dateStr;
  else delete data[key][filename];
  saveModMetadata(appDataPath, data);
}

const PAYDAY3_SHIPPING_EXE = 'PAYDAY3-WIN64-SHIPPING.EXE';

function isPayday3GameProcess(line) {
  const u = line.toUpperCase();
  if (u.includes('MOD MANAGER')) return false;
  return u.includes('PAYDAY3') || (u.includes('PAYDAY 3') && u.includes('.EXE'));
}

function isPayday3ShippingProcess(line) {
  return line.toUpperCase().includes(PAYDAY3_SHIPPING_EXE);
}

function isPayday3Running() {
  if (process.platform !== 'win32') return false;
  try {
    const out = execSync('tasklist /V /FO CSV /NH', { encoding: 'utf-8', windowsHide: true });
    return out.split(/\r?\n/).some(isPayday3GameProcess);
  } catch (_) {
    return false;
  }
}

function isPayday3RunningAsync() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    execFile(
      'tasklist',
      ['/V', '/FO', 'CSV', '/NH'],
      { windowsHide: true, timeout: 3000, encoding: 'utf-8' },
      (err, stdout) => {
        if (err || !stdout) {
          resolve(false);
          return;
        }
        const lines = String(stdout).split(/\r?\n/);
        resolve(lines.some(isPayday3GameProcess));
      }
    );
  });
}

function isPayday3ShippingRunningAsync() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    execFile(
      'tasklist',
      ['/FO', 'CSV', '/NH', '/FI', `IMAGENAME eq ${PAYDAY3_SHIPPING_EXE}`],
      { windowsHide: true, timeout: 3000, encoding: 'utf-8' },
      (err, stdout) => {
        if (err || !stdout) {
          resolve(false);
          return;
        }
        const out = String(stdout).toUpperCase();
        if (out.includes('NO TASKS ARE RUNNING')) {
          resolve(false);
          return;
        }
        resolve(out.includes(PAYDAY3_SHIPPING_EXE));
      }
    );
  });
}

module.exports = {
  MODS_FOLDER_NAME,
  PAK_EXT,
  DISABLED_SUFFIX,
  SORT_DATE_NEWEST,
  SORT_DATE_OLDEST,
  SORT_NAME_AZ,
  SORT_NAME_ZA,
  ensureModsDir,
  listMods,
  sortMods,
  setEnabled,
  modExistsAnyVariant,
  removeMod,
  getDeletedModsFolderPath,
  listDeletedMods,
  getDeletedModsStorageBytes,
  restoreDeletedMod,
  permanentlyDeleteFromRecycle,
  deleteAllFromRecycle,
  extractPaksFromArchive,
  copyPakToMods,
  getModDateAdded,
  setModDateAdded,
  isPayday3Running,
  isPayday3RunningAsync,
  isPayday3ShippingRunningAsync,
};
