import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type {
  ContactSegment,
  SegmentRule,
  SegmentRuleField,
  SegmentRuleOperator,
} from '../../../core/data/entities';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

type Draft = {
  id: string | null;
  name: string;
  description: string;
  match: ContactSegment['match'];
  rules: SegmentRule[];
};

const EMPTY_DRAFT: Draft = { id: null, name: '', description: '', match: 'all', rules: [] };

const FIELD_META: {
  field: SegmentRuleField;
  label: string;
  operators: { value: SegmentRuleOperator; label: string }[];
  placeholder: string;
  options?: string[];
}[] = [
  {
    field: 'tag',
    label: 'Tag',
    operators: [
      { value: 'has', label: 'has' },
      { value: 'lacks', label: 'lacks' },
    ],
    placeholder: 'VIP-Retail',
  },
  {
    field: 'optIn',
    label: 'Opt-in status',
    operators: [{ value: 'is', label: 'is' }],
    placeholder: '',
    options: ['opted-in', 'opted-out'],
  },
  {
    field: 'conversations',
    label: 'Conversations',
    operators: [
      { value: 'moreThan', label: 'more than' },
      { value: 'fewerThan', label: 'fewer than' },
    ],
    placeholder: '2',
  },
  {
    field: 'name',
    label: 'Name',
    operators: [{ value: 'contains', label: 'contains' }],
    placeholder: 'Search text',
  },
  {
    field: 'inactiveDays',
    label: 'Days since last seen',
    operators: [
      { value: 'moreThan', label: 'more than' },
      { value: 'fewerThan', label: 'fewer than' },
    ],
    placeholder: '30',
  },
];

/**
 * Contact segments (`/contacts/segments`). Saved audiences for future
 * campaigns, evaluated live against the workspace contacts so the count on
 * every card is the truth, not a snapshot.
 */
@Component({
  selector: 'app-segments-page',
  imports: [FormsModule, ConfirmDialog, PageHeader, StatusPill],
  templateUrl: './segments-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly segments = this.data.segments;
  protected readonly canManage = computed(() => this.permissions.can('contacts.manage', 'edit'));

  protected readonly draft = signal<Draft>({ ...EMPTY_DRAFT, rules: [] });
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDelete = signal<ContactSegment | null>(null);

  protected readonly fieldMeta = FIELD_META;

  /** Live evaluation of the draft — the audience before it is even saved. */
  protected readonly preview = computed(() =>
    this.data.evaluateSegment(this.draft().match, this.draft().rules),
  );

  protected matchCount(segment: ContactSegment): number {
    return this.data.evaluateSegment(segment.match, segment.rules).length;
  }

  protected isSelected(segment: ContactSegment): boolean {
    return this.draft().id === segment.id;
  }

  protected operatorsFor(field: SegmentRuleField): { value: SegmentRuleOperator; label: string }[] {
    return FIELD_META.find((meta) => meta.field === field)?.operators ?? [];
  }

  protected metaFor(field: SegmentRuleField): (typeof FIELD_META)[number] {
    return FIELD_META.find((meta) => meta.field === field) ?? FIELD_META[0]!;
  }

  protected newSegment(): void {
    this.draft.set({ ...EMPTY_DRAFT, rules: [{ field: 'tag', operator: 'has', value: '' }] });
    this.error.set(null);
  }

  protected select(segment: ContactSegment): void {
    this.draft.set({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      match: segment.match,
      rules: segment.rules.map((rule) => ({ ...rule })),
    });
    this.error.set(null);
  }

  protected updateDraft(patch: Partial<Draft>): void {
    this.draft.set({ ...this.draft(), ...patch });
  }

  protected addRule(): void {
    this.updateDraft({
      rules: [...this.draft().rules, { field: 'tag', operator: 'has', value: '' }],
    });
  }

  protected removeRule(index: number): void {
    this.updateDraft({ rules: this.draft().rules.filter((_, i) => i !== index) });
  }

  protected updateRule(index: number, patch: Partial<SegmentRule>): void {
    const rules = this.draft().rules.map((rule, i) => {
      if (i !== index) {
        return rule;
      }
      const next = { ...rule, ...patch };
      // A new field resets to its first operator so stale pairs can't persist.
      if (patch.field && patch.field !== rule.field) {
        next.operator = this.operatorsFor(patch.field)[0]!.value;
        next.value = next.value ?? '';
      }
      return next;
    });
    this.updateDraft({ rules });
  }

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving()) {
      return;
    }
    const draft = this.draft();
    if (!draft.name.trim()) {
      this.error.set('The segment needs a name.');
      return;
    }
    if (draft.rules.some((rule) => !rule.value.trim() && rule.field !== 'optIn')) {
      this.error.set('Every rule needs a value before the segment can be saved.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.data.saveSegment({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim(),
        description: draft.description.trim(),
        match: draft.match,
        rules: draft.rules,
      });
      this.select(saved);
      this.notice.set(`“${saved.name}” now matches ${this.matchCount(saved)} contacts.`);
    } catch {
      this.error.set('The segment could not be saved.');
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
    await this.data.deleteSegment(target.id);
    if (this.draft().id === target.id) {
      this.draft.set({ ...EMPTY_DRAFT, rules: [] });
    }
    this.notice.set(`“${target.name}” was deleted.`);
  }
}
