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
};
