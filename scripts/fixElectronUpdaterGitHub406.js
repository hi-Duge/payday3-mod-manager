/**
 * electron-updater's GitHubProvider.getLatestTagName() requests the web URL
 * /releases/latest with Accept: application/json; GitHub returns 406.
 * Replace with api.github.com REST (public repos work without a token).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'electron-updater', 'out', 'providers', 'GitHubProvider.js');
if (!fs.existsSync(target)) {
  process.exit(0);
}

const beforePath = path.join(__dirname, 'patches', 'electron-updater-git406.before.txt');
const afterPath = path.join(__dirname, 'patches', 'electron-updater-git406.after.txt');
if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
  process.exit(0);
}

const norm = (t) => t.replace(/\r\n/g, '\n');
const before = norm(fs.readFileSync(beforePath, 'utf8'));
const after = norm(fs.readFileSync(afterPath, 'utf8'));
let s = norm(fs.readFileSync(target, 'utf8'));

if (s.includes('GitHub.com no longer serves JSON')) {
  process.exit(0);
}
if (!s.includes(before)) {
  console.warn('[fixElectronUpdaterGitHub406] electron-updater GitHubProvider.js not in expected form; skip.');
  process.exit(0);
}

fs.writeFileSync(target, s.replace(before, after));
console.warn('[fixElectronUpdaterGitHub406] Patched electron-updater GitHubProvider (api.github.com for latest release).');
