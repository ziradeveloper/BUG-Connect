import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Architecture guard: every style lives in the global stylesheet under `src/styles`.
 *
 * Components must not reintroduce `styleUrl`, inline `styles`, or stray `.css` files.
 * Scoped component CSS is what scattered colours and spacing across 20 files before the
 * token system existed, so this is pinned in code rather than left to review.
 */
const APP_ROOT = join(process.cwd(), 'src/app');
const GLOBAL_ROOT = join(process.cwd(), 'src/styles');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('global styling convention', () => {
  const appFiles = walk(APP_ROOT);

  it('keeps component stylesheets out of src/app', () => {
    const stray = appFiles.filter((file) => file.endsWith('.css')).map((f) => relative(process.cwd(), f));
    expect(stray).toEqual([]);
  });

  it('keeps components free of styleUrl and inline styles', () => {
    const offenders = appFiles
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return /styleUrls?\s*:/.test(source) || /\bstyles\s*:\s*[`'"[]/.test(source);
      })
      .map((f) => relative(process.cwd(), f));
    expect(offenders).toEqual([]);
  });

  it('loads the global stylesheet entry and its token file', () => {
    expect(existsSync(join(process.cwd(), 'src/styles.css'))).toBe(true);
    expect(existsSync(join(GLOBAL_ROOT, 'tokens.css'))).toBe(true);
  });
});
