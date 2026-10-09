import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import {
  META_LIMITS,
  type InteractiveButton,
  type InteractivePayload,
  type InteractiveRow,
  type InteractiveSubtype,
} from '../../../../core/data/whatsapp';

interface DraftRow extends InteractiveRow {
  key: string;
}

interface DraftButton extends InteractiveButton {
  key: string;
  url: string;
}

const SUBTYPES: { id: InteractiveSubtype; label: string; hint: string }[] = [
  { id: 'button', label: 'Quick replies', hint: 'Up to 3 tappable reply buttons' },
  { id: 'cta_url', label: 'Call to action', hint: 'Up to 2 buttons that open a URL' },
  { id: 'list', label: 'List picker', hint: 'Up to 10 rows in a single section' },
  { id: 'flow', label: 'WhatsApp Flow', hint: 'Open a native form screen' },
];

/**
 * Builds an interactive message — quick replies, a CTA, a list picker or a
 * WhatsApp Flow — with a live preview of what the contact will see.
 *
 * Enforces Meta's structural limits (3 quick replies, 10 list rows, 20-char
 * button titles) so the draft can always be serialised to a valid request body.
 */
@Component({
  selector: 'app-interactive-builder-dialog',
  standalone: true,
  templateUrl: './interactive-builder-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractiveBuilderDialog {
  readonly confirm = output<InteractivePayload>();

  readonly visible = signal(false);

  readonly subtypes = SUBTYPES;
  readonly limits = META_LIMITS;

  readonly subtype = signal<InteractiveSubtype>('button');
  readonly header = signal('');
  readonly body = signal('');
  readonly footer = signal('');
  readonly actionLabel = signal('View options');
  readonly flowId = signal('appointment_booking');
  readonly flowCta = signal('Book now');
  readonly sectionTitle = signal('Available slots');

  readonly buttons = signal<DraftButton[]>([
    { key: 'btn-1', id: 'reply-1', title: 'Confirm order', url: '' },
    { key: 'btn-2', id: 'reply-2', title: 'Talk to agent', url: '' },
  ]);

  readonly rows = signal<DraftRow[]>([
    { key: 'row-1', id: 'row-1', title: '11:00 AM', description: 'Counter 2' },
    { key: 'row-2', id: 'row-2', title: '4:30 PM', description: 'Counter 1' },
  ]);

  readonly usesButtons = computed(() => {
    const subtype = this.subtype();
    return subtype === 'button' || subtype === 'cta_url';
  });

  readonly maxButtons = computed(() => (this.subtype() === 'cta_url' ? 2 : 3));

  readonly previewButtons = computed(() =>
    this.buttons().map((button, index) => ({
      id: button.id || `reply-${index + 1}`,
      title: button.title || `Button ${index + 1}`,
      prefix: this.subtype() === 'cta_url' ? '🔗' : '',
    })),
  );

  readonly errors = computed<string[]>(() => {
    const errors: string[] = [];

    if (!this.body().trim()) {
      errors.push('Body text is required.');
    }

    if (this.subtype() === 'list') {
      const filled = this.rows().filter((row) => row.title.trim());
      if (filled.length === 0) {
        errors.push('Add at least one list row.');
      }
      for (const row of filled) {
        if (row.title.trim().length > META_LIMITS.rowTitleChars) {
          errors.push(`Row titles are capped at ${META_LIMITS.rowTitleChars} characters.`);
          break;
        }
      }
    }

    if (this.subtype() === 'cta_url') {
      for (const button of this.buttons()) {
        if (button.title.trim() && !/^https?:\/\//i.test(button.url.trim())) {
          errors.push('CTA buttons need a full URL starting with https://');
          break;
        }
      }
    }

    if (this.usesButtons()) {
      const filled = this.buttons().filter((button) => button.title.trim());
      if (filled.length === 0) {
        errors.push('Add at least one button.');
      }
    }

    return errors;
  });

  readonly canSend = computed(() => this.errors().length === 0);

  open(): void {
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  // ── Buttons ───────────────────────────────────────────────────

  addButton(): void {
    if (this.buttons().length >= this.maxButtons()) return;
    const index = this.buttons().length + 1;
    this.buttons.update((items) => [
      ...items,
      { key: `btn-${index}-${Date.now()}`, id: `reply-${index}`, title: '', url: '' },
    ]);
  }

  removeButton(key: string): void {
    this.buttons.update((items) => items.filter((item) => item.key !== key));
  }

  updateButton(key: string, field: 'title' | 'url', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.buttons.update((items) =>
      items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  // ── List rows ─────────────────────────────────────────────────

  addRow(): void {
    if (this.rows().length >= META_LIMITS.listRows) return;
    const index = this.rows().length + 1;
    this.rows.update((items) => [
      ...items,
      { key: `row-${index}-${Date.now()}`, id: `row-${index}`, title: '', description: '' },
    ]);
  }

  removeRow(key: string): void {
    this.rows.update((items) => items.filter((item) => item.key !== key));
  }

  updateRow(key: string, field: 'title' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update((items) =>
      items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  // ── Send ──────────────────────────────────────────────────────

  send(): void {
    if (!this.canSend()) return;

    const subtype = this.subtype();
    const payload: InteractivePayload = {
      subtype,
      header: this.header().trim() ? { type: 'text', text: this.header().trim() } : null,
      body: this.body().trim(),
      footer: this.footer().trim() || null,
      buttons: [],
    };

    if (subtype === 'list') {
      payload.actionLabel = this.actionLabel().trim() || 'View options';
      payload.sections = [
        {
          title: this.sectionTitle().trim(),
          rows: this.rows()
            .filter((row) => row.title.trim())
            .map((row, index) => ({
              id: row.id || `row-${index + 1}`,
              title: row.title.trim().slice(0, META_LIMITS.rowTitleChars),
              description: (row.description ?? '').trim().slice(0, META_LIMITS.rowDescriptionChars),
            })),
        },
      ];
    } else if (subtype === 'flow') {
      payload.buttons = [{ id: 'flow-cta', title: this.flowCta().trim() || 'Open' }];
      payload.flowId = this.flowId().trim();
      payload.flowCta = this.flowCta().trim() || 'Open';
    } else {
      payload.buttons = this.buttons()
        .filter((button) => button.title.trim())
        .map((button, index) => ({
          id: button.id || `reply-${index + 1}`,
          title: button.title.trim().slice(0, META_LIMITS.buttonTitleChars),
          url: subtype === 'cta_url' ? button.url.trim() : undefined,
        }));
    }

    this.confirm.emit(payload);
    this.close();
  }
}
