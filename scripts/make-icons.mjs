/**
 * Generate every app icon and splash image from one logo, so there are no binary
 * assets in git. Run with `npm run icons` (also runs automatically before a build).
 *
 * Logo: a white bell with a check mark cut out of it and a small amber alert dot,
 * on a deep teal tile — "a reminder you can tick off".
 *
 * Outputs (public/icons): any-purpose 192/512, maskable 512, monochrome 512
 * (Android themed icons), Apple touch icon, notification badge, shortcut icons,
 * and iOS launch images. The favicon is an SVG in public/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = join(ROOT, 'icons');
const TEAL = '#12a085';
const TEAL_DEEP = '#075a4a';
const AMBER = '#ffb020';
const PAPER = '#0b0f0e';

const BELL = 'M29 68 V47 a21 21 0 0 1 42 0 V68 l7 7 H22 Z';
const CHECK = 'M40.5 52 L47.5 59 L60 43';

/** Bell with the check cut out (via mask) and optional alert dot; 0..100 viewBox. */
function glyph({ fill = '#ffffff', dot = true, id = 'cut' } = {}) {
  return `
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="#fff"/>
      <path d="${CHECK}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
    <g mask="url(#${id})"><path d="${BELL}" fill="${fill}" stroke="${fill}" stroke-width="2" stroke-linejoin="round"/></g>
    <circle cx="50" cy="82" r="6" fill="${fill}"/>
    <rect x="47" y="21" width="6" height="6" rx="3" fill="${fill}"/>
    ${dot ? `<circle cx="73" cy="27" r="10" fill="${AMBER}" stroke="${TEAL_DEEP}" stroke-width="3.5"/>` : ''}`;
}

function defs() {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${TEAL}"/><stop offset="1" stop-color="${TEAL_DEEP}"/></linearGradient></defs>`;
}

/** Full tile. `inset` shrinks the glyph (maskable safe zone); `radius` rounds the tile. */
function tileSvg(size, { radius = 22, inset = 0 } = {}) {
  const s = (100 - inset * 2) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${defs()}
    <rect width="100" height="100" rx="${radius}" fill="url(#g)"/>
    <g transform="translate(${inset} ${inset}) scale(${s})">${glyph()}</g></svg>`;
}

/** Android themed icon: single-colour glyph on transparent, tinted by the launcher. */
function monoSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <g transform="translate(10 10) scale(0.8)">${glyph({ dot: false, id: 'm' })}</g></svg>`;
}

/** Status-bar badge: white glyph, transparent background. */
function badgeSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${glyph({ dot: false, id: 'b' })}</svg>`;
}

/** iOS launch image: brand colour field, centred logo, wordmark under it. */
function splashSvg(w, h) {
  const logo = Math.round(Math.min(w, h) * 0.26);
  const x = (w - logo) / 2;
  const y = h / 2 - logo * 0.75;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${PAPER}"/>
    <g transform="translate(${x} ${y}) scale(${logo / 100})">${defs()}<rect width="100" height="100" rx="22" fill="url(#g)"/>${glyph({ id: 's' })}</g>
    <text x="${w / 2}" y="${y + logo + logo * 0.32}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.round(logo * 0.24)}" fill="#e7efec" letter-spacing="1">Yaad</text>
  </svg>`;
}

const SPLASH_SIZES = [
  // [css width, css height, pixel ratio]
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
  [768, 1024, 2],
];

async function png(svg, file, w, h = w) {
  await sharp(Buffer.from(svg)).resize(w, h).png().toFile(join(OUT, file));
  process.stdout.write(`  ${file}\n`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('Generating icons:');
  await png(tileSvg(192), 'icon-192.png', 192);
  await png(tileSvg(512), 'icon-512.png', 512);
  await png(tileSvg(512, { radius: 0, inset: 11 }), 'maskable-512.png', 512);
  await png(monoSvg(512), 'monochrome-512.png', 512);
  await png(tileSvg(180, { radius: 0 }), 'apple-touch-icon.png', 180);
  await png(badgeSvg(96), 'badge-72.png', 72);
  for (const name of ['add', 'today', 'calendar', 'presets']) await png(tileSvg(96, { radius: 0, inset: 6 }), `shortcut-${name}.png`, 96);

  for (const [w, h, r] of SPLASH_SIZES) await png(splashSvg(w * r, h * r), `splash-${w}x${h}.png`, w * r, h * r);

  await writeFile(join(ROOT, 'favicon.svg'), tileSvg(64).trim() + '\n');
  process.stdout.write('  favicon.svg\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
