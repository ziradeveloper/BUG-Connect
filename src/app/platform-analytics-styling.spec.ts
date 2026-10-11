import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLAN_TIERS } from './core/data/plan.seed';
import { buildPlatformSnapshot } from './core/data/platform-analytics';

/**
 * Styling guard for the platform analytics screen.
 *
 * The same rule the wave specs enforce: every class the template wears resolves
 * somewhere in `src/styles`, and the classes built at runtime — the plan bars and
 * the funnel stages — have a rule for every value the data can produce. Those two
 * families are interpolated, so a missing rule is invisible until a new tier or
 * funnel step appears.
 */
const TEMPLATE = 'src/app/admin/analytics/analytics-page/analytics-page.html';
const STYLE_ROOT = join(process.cwd(), 'src/styles');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const allCss = walk(STYLE_ROOT)
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

const analyticsCss = readFileSync(join(STYLE_ROOT, 'pages/analytics.css'), 'utf8');

describe('platform analytics styling contract', () => {
  it('has its template and stylesheet', () => {
    expect(existsSync(join(process.cwd(), TEMPLATE))).toBe(true);
    expect(analyticsCss.length).toBeGreaterThan(0);
  });

  it('resolves every class the template uses', () => {
    const defined = new Set(
      [...allCss.matchAll(/\.(-?[a-zA-Z][\w-]*)/g)].map((match) => match[1] as string),
    );
    const html = readFileSync(join(process.cwd(), TEMPLATE), 'utf8');
    const used = new Set<string>();

    for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
      for (const name of (match[1] as string).split(/\s+/)) {
        // `ana-tier__fill--{{ … }}` and `[class]="tierClass(tier)"` build their
        // suffix at runtime; those families are checked below instead.
        if (name && /^-?[a-zA-Z][\w-]*$/.test(name)) used.add(name);
      }
    }
    for (const match of html.matchAll(/\[class\.([\w-]+)\]/g)) {
      used.add(match[1] as string);
    }

    const unstyled = [...used]
      .filter((name) => !defined.has(name))
      .map((name) => `${relative(process.cwd(), TEMPLATE)} → .${name}`);

    expect(unstyled).toEqual([]);
  });

  it('styles every plan tier and funnel stage the data can produce', () => {
    const tiers = [...PLAN_TIERS.map((tier) => tier.toLowerCase()), 'neutral'];
    const stages = buildPlatformSnapshot(
      {
        tenants: [],
        users: [],
        conversations: [],
        messages: [],
        campaigns: [],
        forms: [],
        invoices: [],
      },
      7,
    ).activation.map((stage) => stage.key);

    expect(stages).toHaveLength(5);

    const missingTiers = tiers.filter(
      (tier) => !new RegExp(`\\.ana-tier__fill--${tier}\\s*\\{`).test(analyticsCss),
    );
    const missingStages = stages.filter(
      (key) => !new RegExp(`\\.ana-funnel__fill--${key}\\s*\\{`).test(analyticsCss),
    );

    expect(missingTiers).toEqual([]);
    expect(missingStages).toEqual([]);
  });

  it('folds to one column on a phone', () => {
    expect(analyticsCss).toMatch(/\.ana-grid\s*\{[^}]*grid-template-columns/);
    expect(analyticsCss).toMatch(/@media \(max-width: 70rem\)/);
    expect(analyticsCss).toMatch(/@media \(max-width: 40rem\)/);
  });
});
