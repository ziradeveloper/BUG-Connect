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
import type { BusinessProfile, DayHours } from '../../../core/data/entities';
import { PageHeader } from '../../../shared/ui/ui';
import { formatDateTime } from '../../../shared/format';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'UTC'];

type Draft = {
  displayName: string;
  about: string;
  address: string;
  email: string;
  timezone: string;
  hours: DayHours[];
  greetingText: string;
  autoResponderEnabled: boolean;
  autoResponderText: string;
};

/**
 * Business profile (`/settings/business`). Identity, operating hours and the
 * out-of-hours auto-responder — flow conditions read the hours from this same
 * record.
 */
@Component({
  selector: 'app-business-settings-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './business-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessSettingsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly timezones = TIMEZONES;
  protected readonly canManage = computed(() => this.permissions.can('settings.manage', 'edit'));

  protected readonly profile = this.data.businessProfile;
  protected readonly draft = signal<Draft | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;

  constructor() {
    const data = this.data;
    effect(() => {
      void data.tenantId();
      this.load();
    });
    effect(() => {
      const profile = this.profile();
      if (profile && !this.draft()) {
        this.draft.set(this.toDraft(profile));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.data.getBusinessProfile().then(
      (profile) => {
        if (profile) {
          this.draft.set(this.toDraft(profile));
        }
        this.loading.set(false);
      },
      () => {
        this.error.set('The business profile could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  private toDraft(profile: BusinessProfile): Draft {
    return {
      displayName: profile.displayName,
      about: profile.about,
      address: profile.address,
      email: profile.email,
      timezone: profile.timezone,
      hours: profile.hours.map((day) => ({ ...day })),
      greetingText: profile.greetingText,
      autoResponderEnabled: profile.autoResponderEnabled,
      autoResponderText: profile.autoResponderText,
    };
  }

  protected update(patch: Partial<Draft>): void {
    const draft = this.draft();
    if (draft) {
      this.draft.set({ ...draft, ...patch });
    }
  }

  protected updateDay(index: number, patch: Partial<DayHours>): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.update({ hours: draft.hours.map((day, i) => (i === index ? { ...day, ...patch } : day)) });
  }

  protected emailError(): string | null {
    const email = this.draft()?.email.trim() ?? '';
    if (!email) {
      return 'Customer replies need a business email.';
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'That email does not look valid.';
  }

  protected hoursError(): string | null {
    const hours = this.draft()?.hours ?? [];
    if (hours.every((day) => !day.open)) {
      return 'Open at least one day — a permanently closed workspace confuses flows.';
    }
    const broken = hours.some((day) => day.open && day.start >= day.end);
    return broken ? 'Opening time must be before closing time on every open day.' : null;
  }

  protected async save(): Promise<void> {
    if (!this.draft() || !this.canManage() || this.saving()) {
      return;
    }
    const emailIssue = this.emailError();
    if (emailIssue) {
      this.error.set(emailIssue);
      return;
    }
    if (!this.draft()!.displayName.trim()) {
      this.error.set('The workspace needs a display name.');
      return;
    }
    const hoursIssue = this.hoursError();
    if (hoursIssue) {
      this.error.set(hoursIssue);
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.data.saveBusinessProfile({
        displayName: this.draft()!.displayName.trim(),
        about: this.draft()!.about.trim(),
        address: this.draft()!.address.trim(),
        email: this.draft()!.email.trim(),
        timezone: this.draft()!.timezone,
        hours: this.draft()!.hours,
        greetingText: this.draft()!.greetingText.trim(),
        autoResponderEnabled: this.draft()!.autoResponderEnabled,
        autoResponderText: this.draft()!.autoResponderText.trim(),
      });
      this.notice.set(
        `Profile saved${saved ? ` at ${formatDateTime(saved.updatedAt)}` : ''}. Flows read the new hours immediately.`,
      );
    } catch {
      this.error.set('The business profile could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
