import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A guard, not a behaviour test.
 *
 * `<ng-template appCell="x">` compiles silently into nothing when the page forgot
 * to import `DataTableCellDirective`: the column falls back to plain text and every
 * avatar, pill and action button quietly disappears. Five pages did exactly that in
 * one pass, so the rule is pinned in code rather than in review comments — the
 * remaining waves add ~30 more table pages and the failure is invisible by eye.
 */
// vitest runs from the project root; import.meta.url is a server-relative path in
// the browser bundle, so it cannot be turned into a filesystem path.
const APP_ROOT = join(process.cwd(), 'src/app');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(ts|html)$/.test(path) && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

/** The component that owns a template, whether the template is inline or a sibling `.html`. */
function ownerOf(file: string): string {
  return file.endsWith('.html') ? file.replace(/\.html$/, '.ts') : file;
}

function read(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

const pages = [...new Set(sourceFiles(APP_ROOT).map(ownerOf))]
  .filter((file) => existsSync(file))
  .map((file) => {
    const component = read(file);
    const template = read(file.replace(/\.ts$/, '.html')) || component;

    return { file, component, template };
  })
  // A page counts when it declares the shared table in its `imports`, which also
  // excludes the table's own files — their doc comments mention appCell too.
  .filter((page) => /imports: \[[^\]]*DataTableComponent/.test(page.component));

describe('data table cell templates', () => {
  it('finds the table pages it is meant to police', () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it('imports the cell directive wherever a cell template is declared', () => {
    const offenders = pages
      .filter(
        (page) =>
          page.template.includes('appCell=') &&
          !/imports: \[[^\]]*DataTableCellDirective/.test(page.component),
      )
      .map((page) => page.file.replace(join(process.cwd(), '/'), ''));

    expect(offenders).toEqual([]);
  });
});
