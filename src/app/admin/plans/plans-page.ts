import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import type { Plan } from '../../core/data/entities';
import { formatNumber } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/**
 * The tier overview (`/plans`): what each plan meters, which modules it
 * unlocks, and how many workspaces sit on it.
 */
@Component({
  selector: 'app-plans-page',
  imports: [RouterLink, PageHeader, StatusPill],
  templateUrl: './plans-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansPage {
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly canEdit = computed(() => this.permissions.can('plans.manage', 'edit'));

  protected readonly cards = computed(() =>
    this.data.plans().map((plan) => ({
      plan,
      workspaces: this.data.tenants().filter((tenant) => tenant.subscriptionTier === plan.tier).length,
      limits: limitRows(plan),
    })),
  );

  protected price(plan: Plan): string {
    return plan.monthlyPriceInr === null ? 'Custom' : `₹${plan.monthlyPriceInr.toLocaleString('en-IN')} / mo`;
  }

  protected limitValue(value: number | null): string {
    return value === null ? 'Unlimited' : formatNumber(value);
  }
}

function limitRows(plan: Plan): { label: string; value: number | null }[] {
  return [
    { label: 'Seats', value: plan.limits.seats },
    { label: 'WhatsApp numbers', value: plan.limits.whatsappNumbers },
    { label: 'Flows', value: plan.limits.flows },
    { label: 'Campaigns / month', value: plan.limits.campaignsPerMonth },
    { label: 'Contacts', value: plan.limits.contacts },
    { label: 'Messages / month', value: plan.limits.messagesPerMonth },
  ];
}
