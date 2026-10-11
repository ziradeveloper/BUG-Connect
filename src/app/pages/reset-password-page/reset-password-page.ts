import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { SiteHeader } from '../../shared/site-header/site-header';

type ResetStatus = 'idle' | 'done';

/**
 * Reset-password token handler (`/reset-password?token=…`, wave 5).
 *
 * The token is bound from the query string. A spent, expired or unknown token
 * renders the recovery state instead of a form, and a completed reset registers
 * the chosen password with the session service so it actually signs in.
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink, SiteHeader],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  protected readonly workspace = inject(WorkspaceContext);

  /** Bound from `?token=` through the router's component input binding. */
  readonly token = input('');

  protected password = '';
  protected confirmation = '';
  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<ResetStatus>('idle');

  protected readonly request = computed(() => this.data.resetRequestFor(this.token()));

  /**
   * Methods, not computeds: the field is a plain template-driven property, so a
   * computed would cache its first (empty) read and never re-evaluate.
   */
  protected ruleLength(): boolean {
    return this.password.length >= 8;
  }

  protected ruleMix(): boolean {
    return /[A-Za-z]/.test(this.password) && /\d/.test(this.password);
  }

  protected toggleVisible(): void {
    this.visible.update((value) => !value);
  }

  protected async onSubmit(form: NgForm): Promise<void> {
    this.error.set(null);

    if (form.invalid || !this.ruleLength() || !this.ruleMix()) {
      this.error.set('Use at least 8 characters with a letter and a number.');
      return;
    }

    if (this.password !== this.confirmation) {
      this.error.set('The two passwords do not match.');
      return;
    }

    this.saving.set(true);
    const outcome = await this.data.completePasswordReset(this.token());
    this.saving.set(false);

    if (!outcome.ok || !outcome.request) {
      this.error.set(outcome.message ?? 'That reset link is no longer usable.');
      return;
    }

    this.session.registerCredential(outcome.request.email, this.password);
    this.status.set('done');
  }
}
