import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { SiteHeader } from '../../shared/site-header/site-header';

type InviteStatus = 'idle' | 'done';

/**
 * Invitation acceptance (`/accept-invite?token=…`, wave 5).
 *
 * The seat already exists — an administrator created it on the Users page, which
 * is what issues the token. Accepting it clears the pending flag, spends the
 * invite and registers the chosen password so the new member can sign in.
 */
@Component({
  selector: 'app-accept-invite-page',
  imports: [FormsModule, RouterLink, SiteHeader],
  templateUrl: './accept-invite-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitePage {
  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  protected readonly permissions = inject(PermissionService);
  protected readonly workspace = inject(WorkspaceContext);

  /** Bound from `?token=` through the router's component input binding. */
  readonly token = input('');

  protected password = '';
  protected confirmation = '';
  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<InviteStatus>('idle');

  protected readonly details = computed(() => this.data.inviteDetails(this.token()));
  protected readonly inviteName = computed(() => this.details()?.user?.fullName ?? '');

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
    const outcome = await this.data.acceptInvite(this.token());
    this.saving.set(false);

    if (!outcome.ok || !outcome.user) {
      this.error.set(outcome.message ?? 'That invitation could not be accepted.');
      return;
    }

    this.session.registerCredential(outcome.user.email, this.password);
    this.status.set('done');
  }
}
