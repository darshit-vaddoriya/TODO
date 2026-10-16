/**
 * Guards the colour theme: reads the real tokens out of global.css and checks
 * WCAG 2.x contrast for the pairs the UI actually uses, in both themes. If a
 * colour is changed and a pair drops below its threshold, this fails.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

/** Tokens declared in the block that starts at `opener` (e.g. `:root {`). */
function tokens(opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`block not found: ${opener}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

const light = tokens(':root {');
const dark = tokens(':root[data-theme="dark"] {');
const darkMedia = tokens(':root:not([data-theme="light"]) {');

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA_TEXT = 4.5;
const AA_UI = 3;
const BACKGROUNDS = ['paper', 'surface', 'field'];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme palette', (_name, t) => {
  it('declares every token', () => {
    for (const k of [
      'paper',
      'surface',
      'field',
      'ink',
      'muted',
      'teal',
      'on-teal',
      'accent',
      'on-accent',
      'haldi',
      'on-haldi',
      'info',
      'positive',
      'control',
    ]) {
      expect(t[k], `--${k}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(BACKGROUNDS)('body and secondary text are readable on %s', (bg) => {
    expect(contrast(t.ink, t[bg])).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(t.muted, t[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(BACKGROUNDS)('semantic text colours are readable on %s', (bg) => {
    for (const k of ['teal', 'accent', 'haldi', 'info', 'positive']) {
      expect(contrast(t[k], t[bg]), `--${k} on ${bg}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('text on filled buttons and chips is readable', () => {
    expect(contrast(t['on-teal'], t.teal)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(t['on-haldi'], t.haldi)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('controls are distinguishable from the surfaces they sit on (3:1)', () => {
    expect(contrast(t.teal, t.surface)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrast(t.teal, t.paper)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrast(t.control, t.surface)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrast(t.control, t.paper)).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe('theme blocks', () => {
  it('the system-dark block matches the explicit dark theme', () => {
    expect(darkMedia).toEqual(dark);
  });
});
