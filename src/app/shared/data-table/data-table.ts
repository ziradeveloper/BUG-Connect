import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  type TemplateRef,
} from '@angular/core';

import {
  DataTableCellDirective,
  type DataColumn,
  type DataTableRowContext,
  type SortState,
} from './data-table.model';

/**
 * The one table every list page uses — sorting, global filter, pagination,
 * selection and CSV export are implemented once, here.
 *
 * Written by hand on purpose: the repo has no CDK, Material or AG Grid, and a
 * table this flat does not need a dependency that fights the theme tokens.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  templateUrl: './data-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  readonly columns = input.required<DataColumn<T>[]>();
  readonly rows = input.required<T[]>();

  readonly caption = input('');
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly selectable = input(false);
  readonly activatable = input(false);
  readonly rowKey = input<(row: T) => string>((row) =>
    String((row as Record<string, unknown>)['id'] ?? ''),
  );
  readonly pageSize = input(10);
  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search records');
  readonly exportName = input<string | null>(null);
  readonly emptyTitle = input('Nothing to show');
  readonly emptyDescription = input('Records added to this workspace will appear here.');
  readonly initialSort = input<SortState>(null);

  readonly rowClick = output<T>();
  readonly selectionChange = output<T[]>();

  protected readonly query = signal('');
  protected readonly page = signal(1);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /**
   * `sort` and `size` are state the user can override, so each is one signal
   * holding the override plus a computed that falls back to the caller's input.
   * Reading `initialSort()`/`pageSize()` straight into a field initializer would
   * snapshot the default instead, because inputs land after construction.
   */
  private readonly sortOverride = signal<SortState | undefined>(undefined);
  private readonly sizeOverride = signal<number | null>(null);

  protected readonly sort = computed<SortState>(() => this.sortOverride() ?? this.initialSort());
  protected readonly size = computed(() => this.sizeOverride() ?? this.pageSize());

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly sizeOptions = [10, 20, 50, 100];

  protected readonly total = computed(() => this.filtered().length);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));

  protected readonly filtered = computed<T[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const rows = this.rows();

    if (!needle) {
      return rows;
    }

    return rows.filter((row) =>
      this.columns().some((column) => this.text(row, column).toLowerCase().includes(needle)),
    );
  });

  protected readonly sorted = computed<T[]>(() => {
    const active = this.sort();
    if (!active) {
      return this.filtered();
    }

    const column = this.columns().find((candidate) => candidate.key === active.key);
    if (!column) {
      return this.filtered();
    }

    const factor = active.direction === 'asc' ? 1 : -1;

    return [...this.filtered()].sort((left, right) => {
      const a = this.rawValue(left, column);
      const b = this.rawValue(right, column);

      if (a === b) {
        return 0;
      }

      if (a === null || a === undefined || a === '') {
        return 1;
      }

      if (b === null || b === undefined || b === '') {
        return -1;
      }

      if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * factor;
      }

      return String(a).localeCompare(String(b), undefined, { numeric: true }) * factor;
    });
  });

  protected readonly visible = computed<T[]>(() => {
    const start = (this.page() - 1) * this.size();
    return this.sorted().slice(start, start + this.size());
  });

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) {
      return 'No matches';
    }

    const start = (this.page() - 1) * this.size() + 1;
    const end = Math.min(start + this.size() - 1, total);
    return `${start}–${end} of ${total}`;
  });

  protected readonly selectedCount = computed(() => this.selected().size);

  protected readonly allOnPageSelected = computed(
    () =>
      this.visible().length > 0 &&
      this.visible().every((row) => this.selected().has(this.rowKey()(row))),
  );

  protected readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const current = this.page();
    const window =
      count <= 7
        ? [...Array(count).keys()].map((index) => index + 1)
        : this.windowed(current, count);
    return window;
  });

  protected cellTemplate(column: DataColumn<T>): TemplateRef<DataTableRowContext<T>> | null {
    const found = this.cellTemplates().find((entry) => entry.appCell === column.key);
    return found?.template ?? null;
  }

  protected text(row: T, column: DataColumn<T>): string {
    return column.format ? column.format(row) : String(this.rawValue(row, column) ?? '');
  }

  protected rawValue(row: T, column: DataColumn<T>): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  }

  protected sortDirection(column: DataColumn<T>): 'asc' | 'desc' | null {
    const active = this.sort();
    return active?.key === column.key ? active.direction : null;
  }

  protected toggleSort(column: DataColumn<T>): void {
    if (!column.sortable) {
      return;
    }

    const current = this.sort();

    this.sortOverride.set(
      !current || current.key !== column.key
        ? { key: column.key, direction: 'asc' }
        : current.direction === 'asc'
          ? { key: column.key, direction: 'desc' }
          : null,
    );
    this.page.set(1);
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected setSize(size: number): void {
    this.sizeOverride.set(size);
    this.page.set(1);
  }

  protected onRowClick(row: T): void {
    if (this.activatable()) {
      this.rowClick.emit(row);
    }
  }

  protected isSelected(row: T): boolean {
    return this.selected().has(this.rowKey()(row));
  }

  protected toggleRow(row: T): void {
    const key = this.rowKey()(row);

    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    this.emitSelection();
  }

  protected toggleAllOnPage(): void {
    const keys = this.visible().map((row) => this.rowKey()(row));
    const every = keys.every((key) => this.selected().has(key));

    this.selected.update((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (every) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      return next;
    });
    this.emitSelection();
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
    this.selectionChange.emit([]);
  }

  protected emitSelection(): void {
    const keys = this.selected();
    this.selectionChange.emit(this.rows().filter((row) => keys.has(this.rowKey()(row))));
  }

  protected trackRow(index: number, row: T): string {
    return this.rowKey()(row);
  }

  protected exportCsv(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const header = this.columns()
      .map((column) => escape(column.label))
      .join(',');
    const body = this.sorted().map((row) =>
      this.columns()
        .map((column) => escape(this.rawValue(row, column)))
        .join(','),
    );

    const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.exportName() ?? 'export'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private windowed(current: number, count: number): number[] {
    const half = 2;
    const start = Math.max(1, Math.min(current - half, count - 2 * half));
    return Array.from({ length: 2 * half + 1 }, (_, index) => start + index).filter(
      (page) => page >= 1 && page <= count,
    );
  }
}
