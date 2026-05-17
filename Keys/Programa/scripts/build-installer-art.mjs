import sharp from 'sharp';
import { Jimp } from 'jimp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const ICON_SVG = path.join(BUILD_DIR, 'icon.svg');

const APP_TITLE = 'DREITZ KEYS';
const APP_SUBTITLE = 'DREITZTEAM';
const APP_TAGLINE = 'Tu boveda de licencias';

async function logoPng(size) {
  return sharp(ICON_SVG, { density: 320 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
}

function headerBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 228" width="600" height="228">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#130b0b"/>
        <stop offset="54%" stop-color="#211416"/>
        <stop offset="100%" stop-color="#050403"/>
      </linearGradient>
      <linearGradient id="text" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#c9bfb0"/>
        <stop offset="50%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#8f3036"/>
      </linearGradient>
    </defs>
    <rect width="600" height="228" fill="url(#bg)"/>
    <circle cx="100" cy="114" r="120" fill="#8f3036" opacity="0.18"/>
    <circle cx="540" cy="40" r="180" fill="#c9bfb0" opacity="0.08"/>
    <path d="M0 210 C120 168 226 208 350 164 C448 130 512 148 600 110 L600 228 L0 228 Z" fill="#000" opacity="0.34"/>
    <text x="214" y="120" font-family="Segoe UI, Inter, sans-serif" font-weight="900" font-size="60" fill="url(#text)" letter-spacing="-2">${APP_TITLE}</text>
    <text x="218" y="164" font-family="Segoe UI, Inter, sans-serif" font-weight="700" font-size="20" fill="#a79d91" letter-spacing="6">${APP_SUBTITLE}</text>
  </svg>`;
}

function sidebarBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 656 1256" width="656" height="1256">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#17100f"/>
        <stop offset="45%" stop-color="#080706"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
      <linearGradient id="text" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#c9bfb0"/>
        <stop offset="50%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#8f3036"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="36%" r="55%">
        <stop offset="0%" stop-color="#8f3036" stop-opacity="0.32"/>
        <stop offset="55%" stop-color="#c9bfb0" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="656" height="1256" fill="url(#bg)"/>
    <ellipse cx="328" cy="455" rx="300" ry="315" fill="url(#glow)"/>
    <path d="M0 1160 C126 1090 238 1132 360 1064 C472 1002 560 1020 656 960 L656 1256 L0 1256 Z" fill="#090706"/>
    <text x="328" y="930" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-weight="900" font-size="90" fill="url(#text)" letter-spacing="-3">${APP_TITLE}</text>
    <text x="328" y="985" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-weight="700" font-size="31" fill="#a79d91" letter-spacing="10">${APP_SUBTITLE}</text>
    <text x="328" y="1064" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-weight="500" font-size="26" fill="#8b8176">${APP_TAGLINE}</text>
  </svg>`;
}

async function svgToBmp(svgString, width, height, outPath, composites) {
  let image = sharp(Buffer.from(svgString));
  if (composites.length) image = image.composite(composites);
  const composed = await image.png().toBuffer();
  const pngBuffer = await sharp(composed)
    .resize(width, height, { fit: 'cover' })
    .flatten({ background: '#050403' })
    .png()
    .toBuffer();
  const img = await Jimp.read(pngBuffer);
  await img.write(outPath);
}

console.log('Generating Keys installer art from tian logo...');

await svgToBmp(headerBackground(), 150, 57, path.join(BUILD_DIR, 'installerHeader.bmp'), [
  { input: await logoPng(176), left: 24, top: 24 }
]);
console.log('Wrote installerHeader.bmp (150x57)');

await svgToBmp(sidebarBackground(), 164, 314, path.join(BUILD_DIR, 'installerSidebar.bmp'), [
  { input: await logoPng(500), left: 78, top: 150 }
]);
console.log('Wrote installerSidebar.bmp (164x314)');

console.log('Keys installer art ready.');
