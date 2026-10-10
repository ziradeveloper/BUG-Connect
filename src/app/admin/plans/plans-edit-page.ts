import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import type { PlanLimits, PlanTier } from '../../core/data/entities';
import { PLAN_TIERS } from '../../core/data/plan.seed';
import { PageHeader } from '../../shared/ui/ui';

type LimitKey = keyof PlanLimits;

const LIMIT_FIELDS: { key: LimitKey; label: string; hint: string; min: number; step: number }[] = [
  { key: 'seats', label: 'Seats', hint: 'Staff members per workspace.', min: 1, step: 1 },
  { key: 'whatsappNumbers', label: 'WhatsApp numbers', hint: 'Connected numbers per workspace.', min: 1, step: 1 },
  { key: 'flows', label: 'Flows', hint: 'Saved automation flows.', min: 0, step: 1 },
  { key: 'campaignsPerMonth', label: 'Campaigns / month', hint: 'Broadcasts a workspace may send.', min: 0, step: 1 },
  { key: 'contacts', label: 'Contacts', hint: 'Customers in the Contact Hub.', min: 0, step: 500 },
  { key: 'messagesPerMonth', label: 'Messages / month', hint: 'Metered sends, both directions.', min: 0, step: 1000 },
];

/**
 * The tier limits editor (`/plans/edit?tier=`). Each row is a number or
 * "Unlimited" — the same shape `PlanLimits` stores, so the form cannot write
 * a value the usage meters cannot read.
 */
@Component({
  selector: 'app-plans-edit-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './plans-edit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansEditPage {
  /** Bound from `?tier=` — unknown values fall back to the first tier. */
  readonly tier = input<string>('Pilot');

  private readonly data = inject(MockDataService);

  protected readonly tiers = PLAN_TIERS;
  protected readonly fields = LIMIT_FIELDS;

  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly draft = signal<PlanLimits | null>(null);

  protected readonly activeTier = computed<PlanTier>(() => {
    const wanted = this.tier();
    return (PLAN_TIERS as string[]).includes(wanted) ? (wanted as PlanTier) : 'Pilot';
  });

  protected readonly plan = computed(() => this.data.planForTier(this.activeTier()));

  constructor() {
    effect(() => {
      const plan = this.plan();
      this.draft.set(plan ? { ...plan.limits } : null);
      this.notice.set(null);
    });
  }

  protected isUnlimited(key: LimitKey): boolean {
    return this.draft()?.[key] === null;
  }

  protected toggleUnlimited(key: LimitKey, unlimited: boolean): void {
    this.draft.update((current) => {
      if (!current) {
        return current;
      }
      if (unlimited) {
        return { ...current, [key]: null };
      }
      const field = LIMIT_FIELDS.find((entry) => entry.key === key)!;
      return { ...current, [key]: field.key === 'whatsappNumbers' ? 1 : field.min };
    });
  }

  protected setValue(key: LimitKey, raw: string): void {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    this.draft.update((current) => (current ? { ...current, [key]: Math.floor(parsed) } : current));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.saving()) {
      return;
    }

    this.saving.set(true);
    try {
      await this.data.savePlanLimits(this.activeTier(), draft);
      this.notice.set(`${this.activeTier()} limits saved. Usage meters re-read them immediately.`);
    } finally {
      this.saving.set(false);
    }
  }
}
