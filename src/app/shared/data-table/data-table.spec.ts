import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DataTableComponent } from './data-table';
import { DataTableCellDirective, type DataColumn } from './data-table.model';

type Row = { id: string; name: string; seats: number; joined: string };

const ROWS: Row[] = [
  { id: 'r1', name: 'Nellai Sweets', seats: 8, joined: '2026-01-05' },
  { id: 'r2', name: 'Alpha Textiles', seats: 3, joined: '2025-11-20' },
  { id: 'r3', name: 'Zebra Diagnostics', seats: 15, joined: '2026-03-02' },
  { id: 'r4', name: 'Coaching Labs', seats: 1, joined: '2024-07-19' },
  { id: 'r5', name: 'Bridal House', seats: 7, joined: '2026-02-11' },
];

@Component({
  selector: 'app-host',
  imports: [DataTableComponent, DataTableCellDirective],
  template: `
    <app-data-table
      [columns]="columns"
      [rows]="rows()"
      [pageSize]="2"
      [selectable]="selectable()"
      [loading]="loading()"
      caption="Test workspaces"
      (selectionChange)="selected = $event"
    >
      <ng-template appCell="name" let-row>
        <em>{{ row.name }}</em>
      </ng-template>
    </app-data-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  columns: DataColumn<Row>[] = [
    { key: 'name', label: 'Workspace', sortable: true },
    { key: 'seats', label: 'Seats', sortable: true, type: 'number' },
    { key: 'joined', label: 'Joined', sortable: true },
  ];

  readonly rows = signal<Row[]>(ROWS);
  readonly loading = signal(false);
  readonly selectable = signal(false);
  selected: Row[] = [];
}

type HostFixture = ReturnType<typeof TestBed.createComponent<HostComponent>>;

function headers(fixture: HostFixture): HTMLButtonElement[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.data-table__sort'),
  );
}

function bodyRows(fixture: HostFixture): Element[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.data-table__row'));
}

function cellText(row: Element, index: number): string {
  return (row.querySelectorAll('td')[index]?.textContent ?? '').trim();
}

describe('DataTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('pages instead of dumping every row', () => {
    const fixture = create();

    expect(bodyRows(fixture).length).toBe(2);
    expect(fixture.nativeElement.querySelector('.data-table__range').textContent).toContain(
      '1–2 of 5',
    );
  });

  it('renders a supplied cell template and falls back to text', () => {
    const fixture = create();
    const first = bodyRows(fixture)[0] as Element;

    expect(first.querySelector('em')).toBeTruthy();
    expect(cellText(first, 1)).toBe('8');
  });

  it('sorts ascending, then descending, then clears', () => {
    const fixture = create();
    const seats = headers(fixture)[1] as HTMLButtonElement;

    seats.click();
    fixture.detectChanges();
    expect(cellText(bodyRows(fixture)[0] as Element, 1)).toBe('1');

    seats.click();
    fixture.detectChanges();
    expect(cellText(bodyRows(fixture)[0] as Element, 1)).toBe('15');

    seats.click();
    fixture.detectChanges();
    expect(cellText(bodyRows(fixture)[0] as Element, 0)).toBe('Nellai Sweets');
  });

  it('filters across every column and resets to page one', () => {
    const fixture = create();
    const search = fixture.nativeElement.querySelector('.data-table__search') as HTMLInputElement;

    search.value = 'diagnostics';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(bodyRows(fixture).length).toBe(1);
    expect(cellText(bodyRows(fixture)[0] as Element, 0)).toBe('Zebra Diagnostics');
  });

  it('moves between pages and disables next on the last page', () => {
    const fixture = create();
    const pages = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
          '.data-table__page',
        ),
      );
    const next = () => pages().at(-1) as HTMLButtonElement;

    expect(next().disabled).toBe(false);
    next().click();
    fixture.detectChanges();
    expect(cellText(bodyRows(fixture)[0] as Element, 0)).toBe('Zebra Diagnostics');

    next().click();
    fixture.detectChanges();
    // Five rows at two per page means the third page holds the last one.
    expect(bodyRows(fixture).length).toBe(1);
    expect(next().disabled).toBe(true);
  });

  it('emits the selected rows', () => {
    const fixture = create();
    fixture.componentInstance.selectable.set(true);
    fixture.detectChanges();

    const box = fixture.nativeElement.querySelector(
      'tbody input[type="checkbox"]',
    ) as HTMLInputElement;

    box.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected.length).toBe(1);
    expect(fixture.componentInstance.selected[0]?.id).toBe('r1');
  });

  it('selects every row on the visible page only', () => {
    const fixture = create();
    fixture.componentInstance.selectable.set(true);
    fixture.detectChanges();

    const head = fixture.nativeElement.querySelector(
      'thead input[type="checkbox"]',
    ) as HTMLInputElement;

    head.click();
    fixture.detectChanges();

    // Two rows per page out of five: the header must not reach page two.
    expect(fixture.componentInstance.selected.length).toBe(2);
  });

  it('swaps in skeleton rows while loading', () => {
    const fixture = create();

    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.data-table__row--skeleton').length,
    ).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.data-table__row')).toBeNull();
  });

  it('exposes sort state to assistive tech', () => {
    const fixture = create();
    const seats = headers(fixture)[1] as HTMLButtonElement;

    seats.click();
    fixture.detectChanges();

    const sorted = [...fixture.nativeElement.querySelectorAll('th')].find(
      (th: Element) => th.getAttribute('aria-sort') === 'ascending',
    );

    expect(sorted?.textContent).toContain('Seats');
  });
});
