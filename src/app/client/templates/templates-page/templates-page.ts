import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { MessageTemplate } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';
import { formatRelative } from '../../../shared/format';

const ALL_CATEGORIES = 'ALL' as const;
type CategoryFilter = typeof ALL_CATEGORIES | MessageTemplate['category'];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  ALL: 'All categories',
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
};

/**
 * Template Manager (`/templates`). The Meta catalogue with category tabs, a
 * language badge and the approval status the composer gates on.
 */
@Component({
  selector: 'app-templates-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './templates-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly category = signal<CategoryFilter>(ALL_CATEGORIES);
  protected readonly submittingId = signal<string | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('templates.manage', 'edit'));

  protected readonly categories: CategoryFilter[] = ['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'];

  protected readonly rows = computed(() => {
    const active = this.category();
    const templates = this.data.templates();
    return active === ALL_CATEGORIES
      ? templates
      : templates.filter((template) => template.category === active);
  });

  protected readonly counts = computed(() => {
    const templates = this.data.templates();
    return {
      total: templates.length,
      approved: templates.filter((template) => template.status === 'approved').length,
      pending: templates.filter((template) => template.status === 'pending').length,
      drafts: templates.filter((template) => template.status === 'draft').length,
    };
  });

  protected readonly formatRelative = formatRelative;

  protected readonly columns: DataColumn<MessageTemplate>[] = [
    { key: 'name', label: 'Template', sortable: true, cellClass: 'data-table__mono' },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'language', label: 'Language', sortable: true, align: 'center' },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'variables',
      label: 'Variables',
      sortable: true,
      align: 'center',
      type: 'number',
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      value: (template: MessageTemplate) => template.updatedAt,
      format: (template: MessageTemplate) => formatRelative(template.updatedAt),
    },
    { key: 'actions', label: '', sortable: false, align: 'end' },
  ];

  constructor() {
    const data = this.data;
    effect(() => {
      void data.tenantId();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.data.listTemplates().then(
      () => this.loading.set(false),
      () => {
        this.error.set('The template catalogue could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected categoryLabel(category: CategoryFilter): string {
    return CATEGORY_LABELS[category];
  }

  protected statusTone(status: MessageTemplate['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'paused':
        return 'neutral';
      default:
        return 'info';
    }
  }

  protected async submit(template: MessageTemplate): Promise<void> {
    if (!this.canManage() || this.submittingId()) {
      return;
    }
    this.submittingId.set(template.id);
    try {
      await this.data.submitTemplate(template.id);
      this.notice.set(`“${template.name}” was submitted to Meta for review.`);
    } catch {
      this.error.set('The template could not be submitted.');
    } finally {
      this.submittingId.set(null);
    }
  }
}
