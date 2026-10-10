import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import type { MessageTemplate } from '../../../core/data/entities';
import type { TemplateButtonPayload } from '../../../core/data/whatsapp';
import { PageHeader } from '../../../shared/ui/ui';

type Draft = {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  headerType: 'none' | 'text' | 'image' | 'video' | 'document';
  headerText: string;
  body: string;
  footer: string;
  buttons: { type: TemplateButtonPayload['type']; text: string; url: string }[];
  samples: Record<string, string>;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  category: 'UTILITY',
  language: 'en',
  headerType: 'none',
  headerText: '',
  body: '',
  footer: '',
  buttons: [],
  samples: {},
};

const LANGUAGES = [
  { value: 'en', label: 'English (en)' },
  { value: 'ta', label: 'Tamil (ta)' },
  { value: 'hi', label: 'Hindi (hi)' },
  { value: 'en_US', label: 'English US (en_US)' },
];

/**
 * Template editor (`/templates/new`, `/templates/:templateId`). Builds the
 * Meta structure — header, body with `{{n}}` variables, footer, buttons —
 * with a live phone preview. Only drafts are editable; anything Meta has seen
 * renders a locked notice instead of the form.
 */
@Component({
  selector: 'app-template-editor-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './template-editor-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditorPage {
  private readonly data = inject(MockDataService);
  private readonly router = inject(Router);

  /** Present when reopening a draft; absent on `/new`. */
  readonly templateId = input<string | null>(null);

  protected readonly languages = LANGUAGES;

  protected readonly existing = computed(() => {
    const id = this.templateId();
    return id ? (this.data.templates().find((template) => template.id === id) ?? null) : null;
  });

  protected readonly locked = computed(() => {
    const template = this.existing();
    return template !== null && template.status !== 'draft';
  });

  protected readonly draft = signal<Draft>({ ...EMPTY_DRAFT, buttons: [], samples: {} });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Sorted unique `{{n}}` placeholders found in the body. */
  protected readonly detectedVars = computed(() => {
    const matches = this.draft().body.match(/\{\{(\d+)\}\}/g) ?? [];
    return [...new Set(matches.map((match) => match.slice(2, -2)))].sort(
      (a, b) => Number(a) - Number(b),
    );
  });

  protected readonly previewBody = computed(() => {
    let body = this.draft().body || 'Your message body appears here…';
    for (const variable of this.detectedVars()) {
      const sample = this.draft().samples[variable]?.trim() || `{{${variable}}}`;
      body = body.split(`{{${variable}}}`).join(sample);
    }
    return body;
  });

  constructor() {
    effect(() => {
      const template = this.existing();
      if (template && template.status === 'draft') {
        this.draft.set({
          name: template.name,
          category: template.category,
          language: template.language,
          headerType: template.header?.type ?? 'none',
          headerText: template.header?.text ?? '',
          body: template.body,
          footer: template.footer ?? '',
          buttons: (template.buttons ?? []).map((button) => ({
            type: button.type,
            text: button.text,
            url: button.url ?? '',
          })),
          samples: Object.fromEntries(
            (template.variableLabels ?? []).map((label, index) => [String(index + 1), label]),
          ),
        });
      }
    });
  }

  protected update(patch: Partial<Draft>): void {
    this.draft.set({ ...this.draft(), ...patch });
  }

  protected updateButton(index: number, patch: Partial<Draft['buttons'][number]>): void {
    this.draft.set({
      ...this.draft(),
      buttons: this.draft().buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)),
    });
  }

  protected addButton(): void {
    if (this.draft().buttons.length >= 3) {
      return;
    }
    this.update({ buttons: [...this.draft().buttons, { type: 'QUICK_REPLY', text: '', url: '' }] });
  }

  protected removeButton(index: number): void {
    this.update({ buttons: this.draft().buttons.filter((_, i) => i !== index) });
  }

  protected sampleFor(variable: string): string {
    return this.draft().samples[variable] ?? '';
  }

  protected updateSample(variable: string, value: string): void {
    this.update({ samples: { ...this.draft().samples, [variable]: value } });
  }

  protected nameError(): string | null {
    const name = this.draft().name.trim();
    if (!name) {
      return 'The template needs a name.';
    }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      return 'Use lowercase letters, numbers and underscores, starting with a letter.';
    }
    const clash = this.data
      .templates()
      .some((template) => template.name === name && template.id !== this.templateId());
    return clash ? 'This workspace already has a template with that name.' : null;
  }

  protected bodyError(): string | null {
    const body = this.draft().body.trim();
    if (!body) {
      return 'The body cannot be empty.';
    }
    // Meta numbers placeholders sequentially from {{1}} — a gap fails review.
    const numbers = this.detectedVars().map(Number);
    const sequential = numbers.every((number, index) => number === index + 1);
    return sequential ? null : 'Variables must run {{1}}, {{2}}, … with no gaps.';
  }

  protected buttonsError(): string | null {
    const buttons = this.draft().buttons;
    if (buttons.some((button) => !button.text.trim())) {
      return 'Every button needs a label.';
    }
    if (buttons.some((button) => button.type === 'URL' && !/^https?:\/\/.+/.test(button.url.trim()))) {
      return 'URL buttons need a full https:// link.';
    }
    const urls = buttons.filter((button) => button.type === 'URL').length;
    return urls > 2 ? 'Meta allows at most two URL buttons.' : null;
  }

  protected valid(): boolean {
    return (
      this.nameError() === null &&
      this.bodyError() === null &&
      this.buttonsError() === null &&
      (this.draft().headerType !== 'text' || this.draft().headerText.trim().length > 0)
    );
  }

  private toPayload(): Partial<MessageTemplate> & { name: string; body: string } {
    const draft = this.draft();
    return {
      ...(this.templateId() ? { id: this.templateId()! } : {}),
      name: draft.name.trim(),
      category: draft.category,
      language: draft.language,
      body: draft.body.trim(),
      header:
        draft.headerType === 'none'
          ? null
          : draft.headerType === 'text'
            ? { type: 'text', text: draft.headerText.trim() }
            : { type: draft.headerType },
      footer: draft.footer.trim() || null,
      buttons: draft.buttons.map((button) => ({
        type: button.type,
        text: button.text.trim(),
        ...(button.type === 'URL' ? { url: button.url.trim() } : {}),
      })),
      variableLabels: this.detectedVars().map((variable) => draft.samples[variable]?.trim() || ''),
    };
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.valid()) {
      this.error.set('Fix the highlighted problems before saving.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.data.saveTemplate(this.toPayload());
      await this.router.navigate(['/templates', saved.id]);
    } catch {
      this.error.set('The template could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveAndSubmit(): Promise<void> {
    if (this.saving() || !this.valid()) {
      this.error.set('Fix the highlighted problems before submitting.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.data.saveTemplate(this.toPayload());
      await this.data.submitTemplate(saved.id);
      await this.router.navigate(['/templates']);
    } catch {
      this.error.set('The template could not be submitted.');
    } finally {
      this.saving.set(false);
    }
  }
}
