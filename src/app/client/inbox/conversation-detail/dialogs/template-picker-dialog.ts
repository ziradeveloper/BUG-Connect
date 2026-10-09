import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import type { MessageTemplate } from '../../../../core/data/entities';
import { MockDataService } from '../../../../core/data/mock-data.service';
import {
  META_LIMITS,
  renderTemplateBody,
  type TemplatePayload,
} from '../../../../core/data/whatsapp';

/**
 * Picks a Meta-approved template, fills its `{{n}}` variables and previews the
 * exact message the contact will receive. Only `approved` templates are listed —
 * sending a pending or rejected one is a 132xxx error from the Cloud API.
 */
@Component({
  selector: 'app-template-picker-dialog',
  standalone: true,
  templateUrl: './template-picker-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePickerDialog {
  private readonly data = inject(MockDataService);

  readonly confirm = output<TemplatePayload>();

  readonly visible = signal(false);
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly values = signal<Record<number, string>>({});
  readonly headerImage = signal(true);

  readonly templates = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.data
      .sendableTemplates()
      .filter(
        (template) =>
          !query ||
          template.name.toLowerCase().includes(query) ||
          template.body.toLowerCase().includes(query),
      );
  });

  readonly selected = computed<MessageTemplate | null>(
    () => this.templates().find((template) => template.id === this.selectedId()) ?? null,
  );

  readonly variables = computed(() => {
    const template = this.selected();
    if (!template) return [];

    return Array.from({ length: template.variables }, (_, index) => ({
      index,
      label: template.variableLabels?.[index] ?? `Variable ${index + 1}`,
      value: this.values()[index] ?? '',
    }));
  });

  readonly previewBody = computed(() => {
    const template = this.selected();
    if (!template) return '';

    return renderTemplateBody(
      template.body,
      this.variables().map((variable) => variable.value),
    );
  });

  readonly missingValues = computed(() =>
    this.variables().filter((variable) => !variable.value.trim()),
  );

  readonly canSend = computed(() => !!this.selected() && this.missingValues().length === 0);

  open(): void {
    this.search.set('');
    this.values.set({});

    const first = this.data.sendableTemplates()[0];
    this.selectedId.set(first?.id ?? null);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  select(template: MessageTemplate): void {
    this.selectedId.set(template.id);
    this.values.set({});
  }

  updateValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, 60);
    this.values.update((map) => ({ ...map, [index]: value }));
  }

  send(): void {
    const template = this.selected();
    if (!template || !this.canSend()) return;

    const payload: TemplatePayload = {
      name: template.name,
      language: template.language,
      category: template.category,
      header: template.header
        ? {
            type: template.header.type,
            text: template.header.text,
            mediaUrl:
              template.header.type === 'image' && this.headerImage()
                ? placeholderHeader(template.name)
                : null,
          }
        : null,
      body: template.body,
      footer: template.footer ?? null,
      buttons: template.buttons ?? [],
      variables: this.variables().map((variable) => variable.value.trim()),
    };

    this.confirm.emit(payload);
    this.close();
  }

  readonly maxVariables = META_LIMITS.bodyChars;
}

/** Deterministic header art, since the demo has no media library. */
function placeholderHeader(name: string): string {
  const hue = (name.length * 47) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240">` +
    `<rect width="480" height="240" fill="hsl(${hue} 46% 66%)"/>` +
    `<circle cx="380" cy="60" r="86" fill="hsl(${hue} 60% 92%)" opacity="0.35"/>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
