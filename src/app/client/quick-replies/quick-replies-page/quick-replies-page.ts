import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { QuickReply } from '../../../core/data/entities';
import { ConfirmDialog, PageHeader } from '../../../shared/ui/ui';
import { formatRelative } from '../../../shared/format';

type Draft = {
  id: string | null;
  trigger: string;
  title: string;
  body: string;
};

/**
 * Quick replies (`/quick-replies`). The `/trigger` snippets agents expand in
 * the inbox composer — the same rows the composer's slash matcher reads.
 */
@Component({
  selector: 'app-quick-replies-page',
  imports: [FormsModule, ConfirmDialog, PageHeader],
  templateUrl: './quick-replies-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickRepliesPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly pendingDelete = signal<QuickReply | null>(null);

  protected readonly replies = this.data.quickReplies;
  protected readonly canManage = computed(() => this.permissions.can('settings.manage', 'edit'));

  protected readonly draft = signal<Draft | null>(null);

  protected readonly formatRelative = formatRelative;

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
    this.draft.set(null);
    this.data.listQuickReplies().then(
      () => this.loading.set(false),
      () => {
        this.error.set('The quick replies could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected update(patch: Partial<Draft>): void {
    const draft = this.draft();
    if (draft) {
      this.draft.set({ ...draft, ...patch });
    }
  }

  protected newReply(): void {
    this.error.set(null);
    this.draft.set({ id: null, trigger: '/', title: '', body: '' });
  }

  protected edit(reply: QuickReply): void {
    this.error.set(null);
    this.draft.set({ id: reply.id, trigger: reply.trigger, title: reply.title, body: reply.body });
  }

  protected triggerError(draft: Draft): string | null {
    const trigger = draft.trigger.trim().toLowerCase();
    if (!/^\/[a-z0-9][a-z0-9-_]*$/.test(trigger)) {
      return 'Triggers look like /track — a slash, then letters, numbers, dashes.';
    }
    const clash = this.replies().some(
      (reply) => reply.trigger.toLowerCase() === trigger && reply.id !== draft.id,
    );
    return clash ? 'This workspace already uses that trigger.' : null;
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || !this.canManage() || this.saving()) {
      return;
    }
    const triggerIssue = this.triggerError(draft);
    if (triggerIssue) {
      this.error.set(triggerIssue);
      return;
    }
    if (!draft.body.trim()) {
      this.error.set('The snippet needs a body — that is what the agent sends.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.data.saveQuickReply({
        ...(draft.id ? { id: draft.id } : {}),
        trigger: draft.trigger.trim().toLowerCase(),
        title: draft.title.trim() || draft.trigger.trim().toLowerCase().replace(/^\//, ''),
        body: draft.body.trim(),
      });
      this.draft.set(null);
      this.notice.set(`${draft.trigger.trim().toLowerCase()} is live in the composer.`);
    } catch {
      this.error.set('The snippet could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) {
      return;
    }
    this.pendingDelete.set(null);
    await this.data.deleteQuickReply(target.id);
    if (this.draft()?.id === target.id) {
      this.draft.set(null);
    }
    this.notice.set(`${target.trigger} was deleted from the composer.`);
  }
}
