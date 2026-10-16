/**
 * Enforces the layering described in ARCHITECTURE.md by reading the real import
 * statements: each layer may only depend on the layers below it, the domain
 * stays free of browser APIs, features don't import each other, and
 * cross-directory imports go through the "@/" alias.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('architecture.test.ts'));
const rel = (f: string) => relative(SRC, f).split(sep).join('/');

interface Import {
  file: string;
  spec: string;
  /** Path of the imported module relative to src (no extension), when it is internal. */
  target: string | null;
}

function importsOf(file: string): Import[] {
  const text = readFileSync(file, 'utf8');
  const out: Import[] = [];
  for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s+'([^']+)'|import\s+'([^']+)'/g)) {
    const spec = m[1] ?? m[2];
    let target: string | null = null;
    if (spec.startsWith('@/')) target = spec.slice(2);
    else if (spec.startsWith('.'))
      target = normalize(join(dirname(rel(file)), spec))
        .split(sep)
        .join('/');
    out.push({ file: rel(file), spec, target });
  }
  return out;
}

const all = files.flatMap(importsOf);
const layerOf = (path: string) => path.split('/')[0];

/** What each layer is allowed to import (itself included). */
const ALLOWED: Record<string, string[]> = {
  domain: ['domain'],
  data: ['domain', 'data'],
  services: ['domain', 'data', 'services'],
  ui: ['domain', 'data', 'services', 'ui'],
};

describe('layer dependencies', () => {
  it('knows every source file belongs to a layer', () => {
    // Entry points (main.tsx, version.ts, env.d.ts) live at the root; everything else is in a layer
    // (or styles/, which holds the design tokens and their contrast test).
    const rootFiles = files.map(rel).filter((f) => !f.includes('/'));
    expect(rootFiles.sort()).toEqual(['env.d.ts', 'main.tsx', 'version.ts']);
    const dirs = new Set(
      files
        .map(rel)
        .filter((f) => f.includes('/'))
        .map(layerOf),
    );
    expect([...dirs].sort()).toEqual(['data', 'domain', 'services', 'styles', 'ui']);
  });

  it.each(Object.keys(ALLOWED))('%s only imports from %s and the layers below it', (layer) => {
    const bad = all.filter(
      (i) =>
        layerOf(i.file) === layer && i.target && ALLOWED[layer].every((l) => layerOf(i.target as string) !== l) && !['version', 'env.d'].includes(i.target),
    );
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it('the domain is free of browser and UI APIs', () => {
    const forbidden = /\bfrom\s+'preact|\blocalStorage\b|\bindexedDB\b|\bdocument\.|\bwindow\.|\bnavigator\.|\bNotification\b/;
    const bad = files.filter((f) => rel(f).startsWith('domain/') && !rel(f).endsWith('.test.ts') && forbidden.test(readFileSync(f, 'utf8')));
    expect(bad.map(rel)).toEqual([]);
  });

  it('features do not import each other (shared code lives in ui/shared or ui/components)', () => {
    const featureOf = (p: string) => (p.startsWith('ui/features/') ? p.split('/')[2] : null);
    const bad = all.filter((i) => {
      const from = featureOf(i.file);
      const to = i.target ? featureOf(i.target) : null;
      return from && to && from !== to;
    });
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it('shared UI components do not depend on features', () => {
    const bad = all.filter((i) => i.file.startsWith('ui/components/') && i.target?.startsWith('ui/features/'));
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it('cross-directory imports use the @/ alias, never ../', () => {
    const bad = all.filter((i) => i.spec.startsWith('../'));
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });
});
