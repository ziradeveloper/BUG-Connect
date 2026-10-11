import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { WhatsAppFlowForm } from '../../../core/data/entities';
import {
  categoryLabel,
  FLOW_JSON_VERSION,
  responseShape,
  validateFlow,
} from '../../../core/data/whatsapp-flows';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatNumber, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/**
 * WhatsApp Flows list (`/whatsapp-flows`, wave 6).
 *
 * These are Meta's native in-chat forms — one JSON document per form, rendered
 * inside the chat and posted back in a single response. They sit beside the
 * chat flows on purpose: a chat flow is a conversation tree, this is a form.
 * Rows open the form studio; publish, withdraw and archive run through the
 * same service write path so every change is audited.
 */
@Component({
  selector: 'app-whatsapp-flows-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './whatsapp-flows-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppFlowsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<{ form: WhatsAppFlowForm; action: PendingAction } | null>(
    null,
  );

  protected readonly canManage = computed(() => this.permissions.can('flows.manage', 'edit'));
  protected readonly specVersion = FLOW_JSON_VERSION;

  protected readonly rows = computed(() =>
    [...this.data.whatsappFlows()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  protected readonly summary = computed(() => {
    const forms = this.data.whatsappFlows();
    const published = forms.filter((form) => form.status === 'published');
    const submissions = forms.reduce((total, form) => total + form.submissions30d, 0);
    const screens = forms.reduce((total, form) => total + form.screens.length, 0);
    const completion = published.length
      ? Math.round(
          published.reduce((total, form) => total + form.completionRate, 0) / published.length,
        )
      : 0;

    return {
      total: forms.length,
      published: published.length,
      drafts: forms.filter((form) => form.status === 'draft').length,
      submissions,
      screens,
      completion,
    };
  });

  protected readonly columns: DataColumn<WhatsAppFlowForm>[] = [
    { key: 'name', label: 'Form', sortable: true, cellClass: 'data-table__primary' },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      format: (form) => categoryLabel(form.category),
    },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'screens',
      label: 'Screens',
      sortable: true,
      align: 'center',
      type: 'number',
      value: (form) => form.screens.length,
    },
    {
      key: 'submissions30d',
      label: 'Submissions (30d)',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (form) => formatNumber(form.submissions30d),
    },
    {
      key: 'completionRate',
      label: 'Completion',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (form) => (form.submissions30d ? `${form.completionRate}%` : '—'),
    },
    {
      key: 'updatedAt',
      label: 'Last edited',
      sortable: true,
      value: (form) => form.updatedAt,
      format: (form) => formatRelative(form.updatedAt),
    },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected statusTone(
    form: WhatsAppFlowForm,
  ): 'success' | 'warning' | 'info' | 'neutral' | 'danger' {
    switch (form.status) {
      case 'published':
        return 'success';
      case 'pending':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'info';
    }
  }

  protected statusLabel(form: WhatsAppFlowForm): string {
    switch (form.status) {
      case 'published':
        return 'Published';
      case 'pending':
        return 'In review';
      case 'archived':
        return 'Archived';
      default:
        return 'Draft';
    }
  }

  protected fieldCount(form: WhatsAppFlowForm): number {
    return form.screens.reduce((total, screen) => total + screen.fields.length, 0);
  }

  /** What the form posts, for the row's sub-line. */
  protected postsLabel(form: WhatsAppFlowForm): string {
    const fields = responseShape(form);
    if (fields.length === 0) {
      return 'posts nothing yet';
    }
    return `${fields.length} field${fields.length === 1 ? '' : 's'}`;
  }

  protected linkedLabel(form: WhatsAppFlowForm): string {
    const linked = this.data.linkedFlowFor(form.id);
    return linked ? `sent by ${linked.name}` : 'not attached to a chat flow';
  }

  /** The first publish blocker, so the row explains a disabled publish. */
  protected blocker(form: WhatsAppFlowForm): string | null {
    const errors = validateFlow(form);
    return errors.length ? (errors[0] as string) : null;
  }

  protected ask(form: WhatsAppFlowForm, action: PendingAction): void {
    this.pending.set({ form, action });
  }

  protected dialogTitle(): string {
    const state = this.pending();
    if (!state) {
      return '';
    }
    switch (state.action) {
      case 'publish':
        return `Publish ${state.form.name}?`;
      case 'withdraw':
        return `Withdraw ${state.form.name}?`;
      case 'archive':
        return `Archive ${state.form.name}?`;
      case 'delete':
        return `Delete this draft?`;
    }
  }

  protected dialogBody(): string {
    const state = this.pending();
    if (!state) {
      return '';
    }
    switch (state.action) {
      case 'publish':
        return `Meta receives the flow JSON (${state.form.screens.length} screens) and the form becomes sendable from the composer and any flow that links it.`;
      case 'withdraw':
        return 'The form goes back to draft. Sends that reference it stop until it is published again.';
      case 'archive':
        return 'Archived forms stay on the list for reporting but can no longer be sent or edited.';
      case 'delete':
        return 'The draft and its screens are removed. Published forms cannot be deleted — Meta keeps the flow id.';
    }
  }

  protected dialogConfirm(): string {
    const state = this.pending();
    switch (state?.action) {
      case 'publish':
        return 'Publish';
      case 'withdraw':
        return 'Move to draft';
      case 'archive':
        return 'Archive';
      case 'delete':
        return 'Delete draft';
      default:
        return 'Confirm';
    }
  }

  protected async confirm(): Promise<void> {
    const state = this.pending();
    if (!state) {
      return;
    }

    const { form, action } = state;
    this.error.set(null);

    if (action === 'delete') {
      const removed = await this.data.deleteWhatsAppFlow(form.id);
      this.notice.set(
        removed ? `${form.name} was deleted.` : `${form.name} could not be deleted.`,
      );
      this.pending.set(null);
      return;
    }

    const outcome = await this.data.setWaFormStatus(
      form.id,
      action === 'publish' ? 'published' : action === 'withdraw' ? 'draft' : 'archived',
    );

    if (outcome.error) {
      this.error.set(outcome.error);
      this.pending.set(null);
      return;
    }

    this.notice.set(
      action === 'publish'
        ? `${form.name} is published and sendable.`
        : action === 'withdraw'
          ? `${form.name} is back in draft.`
          : `${form.name} is archived.`,
    );
    this.pending.set(null);
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
  }

  protected async openStudio(form: WhatsAppFlowForm): Promise<void> {
    await this.router.navigate(['/whatsapp-flows', form.id]);
  }
}

type PendingAction = 'publish' | 'withdraw' | 'archive' | 'delete';
