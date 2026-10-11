import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Wave 6 styling guard, the companion to `wave5-styling.spec.ts`: the automation
 * and growth screens wear classes that must all resolve in `src/styles`, and the
 * wide layouts have to fold down to a phone.
 */
const TEMPLATES = [
  'src/app/client/flows/flows-page/flows-page.html',
  'src/app/client/flows/flow-canvas-page/flow-canvas-page.html',
  'src/app/client/flows/flow-simulator-page/flow-simulator-page.html',
  'src/app/client/flows/flow-versions-page/flow-versions-page.html',
  'src/app/client/whatsapp-flows/whatsapp-flows-page/whatsapp-flows-page.html',
  'src/app/client/whatsapp-flows/whatsapp-form-studio-page/whatsapp-form-studio-page.html',
  'src/app/client/campaigns/campaigns-page/campaigns-page.html',
  'src/app/client/campaigns/campaign-wizard-page/campaign-wizard-page.html',
  'src/app/client/campaigns/campaign-monitor-page/campaign-monitor-page.html',
];

const STYLE_ROOT = join(process.cwd(), 'src/styles');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const stylesheets = walk(STYLE_ROOT).filter((file) => file.endsWith('.css'));
const automationCss = readFileSync(join(STYLE_ROOT, 'pages/automation.css'), 'utf8');
const growthCss = readFileSync(join(STYLE_ROOT, 'pages/growth.css'), 'utf8');
const allCss = stylesheets.map((file) => readFileSync(file, 'utf8')).join('\n');

describe('wave 6 styling contract', () => {
  it('has every flow-builder template in place', () => {
    expect(TEMPLATES.filter((file) => !existsSync(join(process.cwd(), file)))).toEqual([]);
  });

  it('resolves every class the flow templates use', () => {
    const defined = new Set(
      [...allCss.matchAll(/\.(-?[a-zA-Z][\w-]*)/g)].map((match) => match[1] as string),
    );
    const unstyled: string[] = [];

    for (const template of TEMPLATES) {
      const html = readFileSync(join(process.cwd(), template), 'utf8');
      const used = new Set<string>();

      for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
        for (const name of (match[1] as string).split(/\s+/)) {
          if (name) used.add(name);
        }
      }
      for (const match of html.matchAll(/\[class\.([\w-]+)\]/g)) {
        used.add(match[1] as string);
      }
      // `[class]="'flow-node flow-node--' + node.kind"` — the two halves are checked as written.
      for (const match of html.matchAll(/'((?:flow-node|sim-[a-z-]+)[\w -]*)'/g)) {
        for (const name of (match[1] as string).split(/\s+/)) {
          // The prefix of a concatenated class list (`flow-node--` + kind) has no
          // rule of its own — the concrete suffix does.
          if (name && !name.endsWith('-')) used.add(name);
        }
      }

      for (const name of used) {
        if (!defined.has(name)) {
          unstyled.push(`${relative(process.cwd(), template)} → .${name}`);
        }
      }
    }

    expect(unstyled).toEqual([]);
  });

  it('folds the canvas and the phone frame on narrow screens', () => {
    expect(automationCss).toMatch(/@media \(max-width: 60rem\)/);
    expect(automationCss).toMatch(/@media \(max-width: 40rem\)/);

    for (const selector of ['.flow-layout', '.sim-layout', '.flow-option', '.flow-canvas__bar']) {
      const escaped = selector.replace('.', '\\.');
      const narrowBlock = automationCss.slice(automationCss.indexOf('@media (max-width: 40rem)'));
      const wideBlock = automationCss.slice(
        automationCss.indexOf('@media (max-width: 60rem)'),
        automationCss.indexOf('@media (max-width: 40rem)'),
      );
      expect(
        new RegExp(`${escaped}[^{]*\\{`).test(narrowBlock) ||
          new RegExp(`${escaped}[^{]*\\{`).test(wideBlock),
        `${selector} has no narrow-screen rule`,
      ).toBe(true);
    }
  });

  it('folds the form studio and keeps the delivery chart bar-based', () => {
    // The studio is three panes wide, two at 70rem and one by 60rem.
    expect(automationCss).toMatch(/@media \(max-width: 70rem\)/);
    const studioBlock = automationCss.slice(automationCss.indexOf('@media (max-width: 70rem)'));
    expect(studioBlock).toMatch(/\.waform-studio/);
    expect(studioBlock).toMatch(/\.waform-palette/);

    // The monitor's chart is divs sized in percent — no charting dependency.
    expect(growthCss).toMatch(/\.camp-chart\s*\{[^}]*display:\s*flex/);
    expect(growthCss).toMatch(/\.camp-chart__bar\s*\{/);
    expect(growthCss).toMatch(/\.camp-chart__bar--delivered\s*\{/);
    expect(growthCss).toMatch(/\.camp-chart__bar--read\s*\{/);
    expect(growthCss).toMatch(/@media \(max-width: 40rem\)/);
  });

  it('keeps the canvas a positioned surface with drawn connectors', () => {
    expect(automationCss).toMatch(/\.flow-canvas\s*\{[^}]*position:\s*relative/);
    expect(automationCss).toMatch(/\.flow-node\s*\{[^}]*position:\s*absolute/);
    expect(automationCss).toMatch(/\.flow-wire\s*\{[^}]*stroke:/);
    expect(automationCss).toMatch(/\.flow-wire--auto\s*\{[^}]*stroke-dasharray/);
  });
});
