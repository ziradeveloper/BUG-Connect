import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Architecture guard for wave 5: the lifecycle surfaces must be styled from the
 * global tree, and they must have a phone story.
 *
 * There is no browser in this sandbox, so the "renders on Desktop + Mobile" bar
 * is pinned the two ways it can be pinned in code:
 *
 *  1. every class a wave-5 template wears resolves to a rule under `src/styles/`
 *     (an unstyled class renders as a bare element at both widths), and
 *  2. the surfaces that carry a fixed two-part line declare explicit narrow
 *     behaviour, instead of relying on the desktop row to squeeze.
 */
const TEMPLATES = [
  'src/app/pages/forgot-password-page/forgot-password-page.html',
  'src/app/pages/reset-password-page/reset-password-page.html',
  'src/app/pages/accept-invite-page/accept-invite-page.html',
  'src/app/client/suspended/suspended-page.html',
  'src/app/client/billing/billing-page/billing-page.html',
  'src/app/client/audit/audit-page/audit-page.html',
  'src/app/admin/audit/audit-page/audit-page.html',
  'src/app/admin/settings/platform-settings-page/platform-settings-page.html',
];

const STYLE_ROOT = join(process.cwd(), 'src/styles');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const stylesheets = walk(STYLE_ROOT).filter((file) => file.endsWith('.css'));
const allCss = stylesheets.map((file) => readFileSync(file, 'utf8')).join('\n');

/** Class names defined anywhere in the global tree. */
function definedClasses(css: string): Set<string> {
  return new Set([...css.matchAll(/\.(-?[a-zA-Z][\w-]*)/g)].map((match) => match[1] as string));
}

/** Class names defined inside a `max-width: Nrem` block at or above the cutoff. */
function classesInsideNarrowBlocks(css: string, minRem: number): Set<string> {
  const found = new Set<string>();

  for (const match of css.matchAll(/@media\s*\(max-width:\s*([\d.]+)rem\)\s*\{/g)) {
    const width = Number(match[1]);
    if (width < minRem || match.index === undefined) {
      continue;
    }

    // Walk to the matching closing brace so only this block's rules are read.
    let depth = 0;
    let index = match.index + match[0].length - 1;
    for (; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    for (const name of definedClasses(css.slice(match.index, index))) {
      found.add(name);
    }
  }

  return found;
}

/** Every class a template wears, including `[class.x]` bindings. */
function classesUsedBy(html: string): Set<string> {
  const used = new Set<string>();

  for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const name of (match[1] as string).split(/\s+/)) {
      if (name) used.add(name);
    }
  }

  for (const match of html.matchAll(/\[class\.([\w-]+)\]/g)) {
    used.add(match[1] as string);
  }

  return used;
}

describe('wave 5 styling contract', () => {
  it('has every wave-5 template in place', () => {
    expect(TEMPLATES.filter((file) => !existsSync(join(process.cwd(), file)))).toEqual([]);
  });

  it('resolves every class the wave-5 templates use', () => {
    const defined = definedClasses(allCss);
    const unstyled: string[] = [];

    for (const template of TEMPLATES) {
      const html = readFileSync(join(process.cwd(), template), 'utf8');
      for (const name of classesUsedBy(html)) {
        if (!defined.has(name)) {
          unstyled.push(`${relative(process.cwd(), template)} → .${name}`);
        }
      }
    }

    expect(unstyled).toEqual([]);
  });

  it('gives the fixed two-part rows an explicit narrow-screen rule', () => {
    // 40rem ≈ the tablet-to-phone break the rest of the tree uses.
    const narrow = classesInsideNarrowBlocks(allCss, 40);

    for (const name of ['checkout-sheet__head', 'settings-save', 'audit-filters']) {
      expect(narrow.has(name), `.${name} has no ≤40rem rule`).toBe(true);
    }

    // The auth cards and the lock screen size themselves with min()/clamp(),
    // which is what keeps them readable at 360px without a media query.
    for (const name of ['auth-card', 'suspended-card']) {
      expect(allCss, `.${name} lost its fluid sizing`).toMatch(
        new RegExp(`\\.${name}\\s*\\{[^}]*width:\\s*min\\(`),
      );
    }
  });
});
