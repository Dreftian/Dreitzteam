// Converts build/icon.svg into Windows icon assets.
// Also creates a high-contrast gray tray icon so it stays visible on dark taskbars.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SVG_PATH = join(ROOT, 'build', 'icon.svg');
const ICO_PATH = join(ROOT, 'build', 'icon.ico');
const PNG_256_PATH = join(ROOT, 'build', 'icon-256.png');
const TRAY_ICO_PATH = join(ROOT, 'build', 'tray.ico');
const TRAY_PNG_256_PATH = join(ROOT, 'build', 'tray-256.png');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const TRAY_COLOR = { r: 196, g: 199, b: 203 };

async function makeIconPng(svg, size) {
  return sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toBuffer();
}

async function makeTrayPng(svg, size) {
  const alpha = await sharp(svg, { density: 300 })
    .resize(size, size)
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(8)
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: TRAY_COLOR
    }
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

async function main() {
  console.log('Building Dreitz icons from', SVG_PATH);
  const svg = await readFile(SVG_PATH);

  const pngs = await Promise.all(SIZES.map((size) => makeIconPng(svg, size)));
  const ico = await pngToIco(pngs);
  await writeFile(ICO_PATH, ico);
  await writeFile(PNG_256_PATH, pngs[pngs.length - 1]);
  console.log(`Wrote ${ICO_PATH} and ${PNG_256_PATH}`);

  const trayPngs = await Promise.all(SIZES.map((size) => makeTrayPng(svg, size)));
  const trayIco = await pngToIco(trayPngs);
  await writeFile(TRAY_ICO_PATH, trayIco);
  await writeFile(TRAY_PNG_256_PATH, trayPngs[trayPngs.length - 1]);
  console.log(`Wrote ${TRAY_ICO_PATH} and ${TRAY_PNG_256_PATH}`);
}

main().catch((err) => {
  console.error('build-icon failed:', err);
  process.exit(1);
});
