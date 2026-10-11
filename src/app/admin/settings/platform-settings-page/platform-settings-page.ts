import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { PlanTier, PlatformSettings } from '../../../core/data/entities';
import { PLAN_TIERS } from '../../../core/data/plan.seed';
import { formatDateTime } from '../../../shared/format';
import { PageHeader } from '../../../shared/ui/ui';

/**
 * Platform settings (`/settings` on the admin host, wave 5).
 *
 * A plain template-driven form over one record: identity, domains, onboarding
 * defaults and the self-service switches. Saving goes through
 * `savePlatformSettings()`, which stamps the operator and writes the audit row.
 */
@Component({
  selector: 'app-platform-settings-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './platform-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformSettingsPage {
  protected readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);

  protected readonly tiers: PlanTier[] = PLAN_TIERS;

  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Mutable working copy — inputs bind here, `save()` copies it back. */
  protected draft: PlatformSettings = { ...this.data.platformSettings() };

  protected readonly savedAt = computed(() => {
    const stamp = this.data.platformSettings().updatedAt;
    return stamp ? formatDateTime(stamp) : null;
  });

  protected readonly savedBy = computed(() => this.data.platformSettings().updatedBy ?? '');

  protected async save(): Promise<void> {
    this.notice.set(null);
    this.error.set(null);

    const failure = this.validate();
    if (failure) {
      this.error.set(failure);
      return;
    }

    this.saving.set(true);
    await this.data.savePlatformSettings({
      platformName: this.draft.platformName.trim(),
      supportEmail: this.draft.supportEmail.trim(),
      supportPhone: this.draft.supportPhone.trim(),
      defaultTier: this.draft.defaultTier,
      trialDays: Number(this.draft.trialDays),
      sessionTimeoutMinutes: Number(this.draft.sessionTimeoutMinutes),
      apexDomain: this.draft.apexDomain.trim(),
      tenantSuffix: this.draft.tenantSuffix.trim(),
      adminSubdomain: this.draft.adminSubdomain.trim(),
      allowSelfServiceSignup: this.draft.allowSelfServiceSignup,
      allowWhatsAppSelfConnect: this.draft.allowWhatsAppSelfConnect,
      maintenanceMode: this.draft.maintenanceMode,
    });
    this.saving.set(false);
    this.notice.set(
      `Platform settings saved${
        this.session.user() ? ` as ${this.session.user()!.fullName}` : ''
      } — the audit log has the row.`,
    );
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private validate(): string | null {
    if (!this.draft.platformName.trim()) {
      return 'The platform name cannot be empty.';
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.draft.supportEmail.trim())) {
      return 'Enter a valid support email address.';
    }
    if (!this.draft.apexDomain.trim() || !this.draft.tenantSuffix.trim()) {
      return 'Both the apex domain and the tenant suffix are required.';
    }
    if (!Number.isFinite(Number(this.draft.trialDays)) || Number(this.draft.trialDays) < 1) {
      return 'The trial length must be at least one day.';
    }
    return null;
  }
}
