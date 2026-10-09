import { Directive, inject, Input, TemplateRef } from '@angular/core';

export type DataColumnType = 'text' | 'number' | 'date';

export interface DataColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
  width?: string;
  type?: DataColumnType;
  /** Raw value used for sorting, filtering and export. Defaults to `row[key]`. */
  value?: (row: T) => unknown;
  /** Rendered when the page supplies no `<ng-template appCell="key">`. */
  format?: (row: T) => string;
  /** Extra class on the cell, e.g. a mono key column. */
  cellClass?: string;
  headerClass?: string;
}

export type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export type DataTableRowContext<T> = {
  $implicit: T;
  index: number;
  column: DataColumn<T>;
};

/**
 * Marks a cell template for a column key:
 *
 * ```html
 * <app-data-table [columns]="columns" [rows]="rows()">
 *   <ng-template appCell="status" let-row>
 *     <span class="badge" [class]="'badge badge-' + row.tone">{{ row.status }}</span>
 *   </ng-template>
 * </app-data-table>
 * ```
 */
@Directive({ selector: 'ng-template[appCell]' })
export class DataTableCellDirective<T> {
  readonly template = inject(TemplateRef<DataTableRowContext<T>>);

  @Input({ required: true }) appCell!: string;
}
