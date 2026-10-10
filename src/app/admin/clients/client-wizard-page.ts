import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { PLAN_TIERS } from '../../core/data/plan.seed';
import type { PlanTier } from '../../core/data/entities';
import { PageHeader } from '../../shared/ui/ui';

const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WIZARD_INDUSTRIES = [
  'Textile, silk and bridal retail',
  'Sweets, bakeries and packaged foods',
  'Diagnostic centres and clinics',
  'Coaching and educational institutes',
  'General retail',
  'Healthcare and wellness',
  'Hospitality and restaurants',
  'Logistics and transport',
];

/**
 * Onboards one tenant (`/clients/new`): business profile, subdomain + tier,
 * then the workspace admin who receives the invite. Postcode 1: the row starts
 * on trial and unconnected — WhatsApp arrives later through Embedded Signup.
 */
@Component({
  selector: 'app-client-wizard-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './client-wizard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWizardPage {
  private readonly router = inject(Router);
  private readonly data = inject(MockDataService);

  protected readonly step = signal(1);
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);

  protected readonly tiers = PLAN_TIERS;
  protected readonly industries = WIZARD_INDUSTRIES;

  protected draft: {
    businessName: string;
    industry: string;
    subdomain: string;
    tier: PlanTier;
    adminName: string;
    adminEmail: string;
  } = {
    businessName: '',
    industry: WIZARD_INDUSTRIES[0]!,
    subdomain: '',
    tier: 'Growth',
    adminName: '',
    adminEmail: '',
  };

  protected readonly takenSubdomains = computed(() =>
    this.data.tenants().map((tenant) => tenant.subdomain.toLowerCase()),
  );

  /**
   * Plain methods, not computeds: `draft` is a template-driven form object, not
   * a signal, so a computed would cache the first keystroke forever. The
   * template re-runs these on every change detection, which ngModel triggers.
   */
  protected subdomainError(): string | null {
    const value = this.draft.subdomain.trim().toLowerCase();

    if (!value) {
      return 'Choose a subdomain for the workspace address.';
    }

    if (!SUBDOMAIN_PATTERN.test(value)) {
      return 'Lowercase letters, numbers and hyphens only.';
    }

    if (this.takenSubdomains().includes(value)) {
      return 'This subdomain is already taken.';
    }

    return null;
  }

  protected stepValid(): boolean {
    switch (this.step()) {
      case 1:
        return this.draft.businessName.trim().length >= 2 && this.draft.industry.trim().length > 0;
      case 2:
        return this.subdomainError() === null;
      default:
        return (
          this.draft.adminName.trim().length >= 2 && EMAIL_PATTERN.test(this.draft.adminEmail.trim())
        );
    }
  }

  protected workspaceUrl(): string {
    const subdomain = this.draft.subdomain.trim().toLowerCase() || '<subdomain>';
    return `${subdomain}.platform.com`;
  }

  protected planHint(): string {
    const plan = this.data.planForTier(this.draft.tier);
    if (!plan) {
      return '';
    }

    const seats = plan.limits.seats === null ? 'unlimited' : `${plan.limits.seats}`;
    const messages =
      plan.limits.messagesPerMonth === null
        ? 'unlimited'
        : plan.limits.messagesPerMonth.toLocaleString('en-IN');
    return `${seats} seats · ${messages} messages / month · ${plan.modules.length} modules`;
  }

  protected next(): void {
    this.attempted.set(true);

    if (!this.stepValid()) {
      this.notice.set('Check the highlighted fields before continuing.');
      return;
    }

    this.notice.set(null);
    this.attempted.set(false);
    this.step.update((current) => Math.min(3, current + 1));
  }

  protected back(): void {
    this.notice.set(null);
    this.attempted.set(false);
    this.step.update((current) => Math.max(1, current - 1));
  }

  protected async submit(): Promise<void> {
    this.attempted.set(true);

    if (this.step() !== 3 || !this.stepValid() || this.saving()) {
      this.notice.set('Check the highlighted fields before creating the workspace.');
      return;
    }

    this.saving.set(true);
    this.notice.set(null);

    try {
      const tenant = await this.data.saveTenant({
        businessName: this.draft.businessName,
        subdomain: this.draft.subdomain,
        industry: this.draft.industry,
        subscriptionTier: this.draft.tier,
      });

      await this.data.saveUser({
        tenantId: tenant.id,
        fullName: this.draft.adminName.trim(),
        email: this.draft.adminEmail.trim(),
        role: 'admin',
        roleId: 'role-admin',
        department: 'Support desk',
      });

      await this.router.navigate(['/clients', tenant.id]);
    } catch {
      this.notice.set('The workspace could not be created. Try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
