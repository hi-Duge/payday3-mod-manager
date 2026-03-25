const path = require('path');
const fs = require('fs');

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const projectDir = context.packager?.projectDir || path.join(__dirname, '..');
  const pkg = require(path.join(projectDir, 'package.json'));
  const productName = pkg.build?.productName || pkg.productName || pkg.name;
  const exeName = productName + '.exe';
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(projectDir, 'icon.ico');
  if (!fs.existsSync(exePath)) return;
  const displayName = productName;
  try {
    const { rcedit } = await import('rcedit');
    const opts = {
      'version-string': {
        FileDescription: displayName,
        ProductName: displayName,
      },
    };
    if (fs.existsSync(iconPath)) opts.icon = iconPath;
    await rcedit(exePath, opts);
  } catch (e) {
    console.warn('rcedit (exe icon/name) skipped:', e.message);
  }

  // Embed GitHub PAT at build time so private-repo auto-update works without user input.
  // Set GH_TOKEN or GITHUB_TOKEN in the environment when building (CI secret or local User env).
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token && String(token).trim()) {
    const resDir = path.join(context.appOutDir, 'resources');
    const dest = path.join(resDir, '.github-update-token');
    try {
      fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(dest, String(token).trim(), 'utf8');
      console.warn('[afterPack] Embedded GitHub token for electron-updater (private repo).');
    } catch (e) {
      console.warn('[afterPack] Could not write .github-update-token:', e.message);
    }
  } else {
    const pub = pkg.build?.publish?.[0];
    if (pub?.provider === 'github' && pub.private) {
      console.warn(
        '[afterPack] publish.private is true but GH_TOKEN/GITHUB_TOKEN is not set. ' +
          'In-app updates for a private repo will not work until you rebuild with a token in the environment.'
      );
    }
  }
};
