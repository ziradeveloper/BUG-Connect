import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import type { Invoice, InvoiceStatus } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

type InvoiceRow = Invoice & { tenantName: string; tenantId: string };

const ALL = null;

/**
 * Platform invoice records (`/invoices`): every billing cycle per tenant with
 * collection state. Status chips filter; the header totals answer "what is
 * still out" at a glance.
 */
@Component({
  selector: 'app-invoices-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './invoices-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesPage {
  protected readonly data = inject(MockDataService);

  protected readonly allRows = signal<InvoiceRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeStatus = signal<InvoiceStatus | null>(ALL);

  protected readonly statuses: InvoiceStatus[] = ['due', 'overdue', 'paid', 'void'];

  protected readonly rows = computed(() => {
    const wanted = this.activeStatus();
    const rows = this.allRows();
    return wanted === ALL ? rows : rows.filter((row) => row.status === wanted);
  });

  protected readonly summary = computed(() => {
    const rows = this.allRows();
    const outstanding = rows.filter((row) => row.status === 'due' || row.status === 'overdue');

    return {
      total: rows.length,
      outstanding: outstanding.reduce((sum, row) => sum + row.amountInr, 0),
      overdue: rows
        .filter((row) => row.status === 'overdue')
        .reduce((sum, row) => sum + row.amountInr, 0),
      collected: rows
        .filter((row) => row.status === 'paid')
        .reduce((sum, row) => sum + row.amountInr, 0),
    };
  });

  protected readonly columns: DataColumn<InvoiceRow>[] = [
    { key: 'number', label: 'Invoice', sortable: true, cellClass: 'data-table__mono' },
    { key: 'tenantName', label: 'Client', sortable: true },
    { key: 'period', label: 'Period', sortable: true, align: 'center' },
    {
      key: 'amountInr',
      label: 'Amount',
      sortable: true,
      align: 'end',
      type: 'number',
      format: (row) => this.inr(row.amountInr),
    },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'dueAt',
      label: 'Due',
      sortable: true,
      value: (row) => row.dueAt,
      format: (row) => formatRelative(row.dueAt),
    },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  constructor() {
    this.load();
  }

  protected selectStatus(status: InvoiceStatus | null): void {
    this.activeStatus.set(status);
  }

  protected isActive(status: InvoiceStatus | null): boolean {
    return this.activeStatus() === status;
  }

  protected statusLabel(status: InvoiceStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  protected statusTone(status: InvoiceStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'paid':
        return 'success';
      case 'due':
        return 'warning';
      case 'overdue':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected inr(amount: number): string {
    return amount === 0 ? 'Free' : `₹${amount.toLocaleString('en-IN')}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.activeStatus.set(ALL);

    this.data.listInvoices().then(
      (page) => {
        const rows = page.items
          .map((invoice) => ({
            ...invoice,
            tenantName: this.data.tenantById(invoice.tenantId)?.businessName ?? 'Unknown workspace',
          }))
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        this.allRows.set(rows);
        this.loading.set(false);
      },
      () => {
        this.error.set('Invoices could not be loaded.');
        this.loading.set(false);
      },
    );
  }
}
