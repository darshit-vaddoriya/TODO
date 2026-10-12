/**
 * Generate every app icon from one SVG, so there are no binary assets in git.
 * Run with `npm run icons` (also runs automatically before a build).
 *
 * Logo: a soft teal rounded tile with a white reminder bell and a small drop,
 * matching the app's calm wellness feel.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const TEAL = '#0d8f74';
const TEAL_DEEP = '#0a6e5a';

/** The bell + drop glyph, white strokes, drawn in a 0..100 viewBox. */
function glyph(stroke = '#ffffff') {
  return `
    <g fill="none" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M31 63 V46 a19 19 0 0 1 38 0 V63 l6 6 H25 Z" />
      <path d="M43 78 a7 7 0 0 0 14 0" />
    </g>
    <circle cx="50" cy="30" r="4.5" fill="${stroke}" />`;
}

/** Full rounded-tile icon as an SVG string. `pad` leaves a safe margin for maskable icons. */
function tileSvg(size, pad = 0) {
  const inner = 100 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${TEAL}"/>
        <stop offset="1" stop-color="${TEAL_DEEP}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${pad ? 0 : 22}" fill="url(#g)"/>
    <g transform="translate(${pad}, ${pad}) scale(${inner / 100})">${glyph()}</g>
  </svg>`;
}

/** A monochrome badge (Android status bar): white glyph on transparent. */
function badgeSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${glyph('#ffffff')}</svg>`;
}

async function png(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, file));
  process.stdout.write(`  ${file}\n`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('Generating icons:');
  await png(tileSvg(192), 'icon-192.png', 192);
  await png(tileSvg(512), 'icon-512.png', 512);
  await png(tileSvg(512, 12), 'maskable-512.png', 512);
  await png(tileSvg(180), 'apple-touch-icon.png', 180);
  await png(badgeSvg(72), 'badge-72.png', 72);
  await png(tileSvg(96), 'shortcut-add.png', 96);
  await png(tileSvg(96), 'shortcut-presets.png', 96);

  // The browser-tab favicon stays an SVG (crisp at every size).
  await writeFile(join(OUT, '..', 'favicon.svg'), tileSvg(64).trim() + '\n');
  process.stdout.write('  favicon.svg\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
