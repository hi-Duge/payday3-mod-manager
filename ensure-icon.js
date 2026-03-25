const fs = require('fs');
const path = require('path');
const iconPath = path.join(__dirname, 'icon.png');
const icoPath = path.join(__dirname, 'icon.ico');
const size = 256;

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (_) {
    console.error('Run "npm install" first (needs sharp).');
    process.exit(1);
  }
  let needWrite = false;
  let buffer = null;
  if (fs.existsSync(iconPath)) {
    const meta = await sharp(iconPath).metadata();
    if (meta.width >= size && meta.height >= size) {
      if (meta.width !== size || meta.height !== size) {
        buffer = await sharp(iconPath).resize(size, size).png().toBuffer();
        needWrite = true;
      }
    } else {
      buffer = await sharp(iconPath).resize(size, size).png().toBuffer();
      needWrite = true;
    }
  } else {
    buffer = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 60, g: 60, b: 80, alpha: 1 } }
    }).png().toBuffer();
    needWrite = true;
  }
  if (needWrite && buffer) {
    fs.writeFileSync(iconPath, buffer);
    console.log('icon.png is now 256x256.');
  }
  const pngForIco = buffer || await sharp(iconPath).resize(size, size).png().toBuffer();
  let toIco;
  try {
    toIco = require('to-ico');
  } catch (_) {
    return;
  }
  const icoBuffer = await toIco([pngForIco], { resize: true, sizes: [16, 32, 48, 256] });
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('icon.ico created for exe/installer.');
}

run().catch((e) => { console.error(e); process.exit(1); });
