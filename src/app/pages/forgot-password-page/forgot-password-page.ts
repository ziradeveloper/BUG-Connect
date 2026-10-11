import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { SiteHeader } from '../../shared/site-header/site-header';

type RequestState = 'idle' | 'sent' | 'unknown';

/**
 * Self-service password recovery (`/forgot-password`, wave 5).
 *
 * The address is looked up across workspaces and platform staff. Because the
 * dummy layer cannot send mail, a hit surfaces the simulated link instead of
 * claiming an email went out — and an unknown address reads the same as a miss
 * would in production.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink, SiteHeader],
  templateUrl: './forgot-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly data = inject(MockDataService);
  protected readonly workspace = inject(WorkspaceContext);

  protected email = '';
  protected readonly sending = signal(false);
  protected readonly status = signal<RequestState>('idle');
  protected readonly result = signal<{ token: string; name: string } | null>(null);

  /** A clickable shortlist so the flow is walkable without knowing the seeds. */
  protected readonly demoAccounts = computed(() => {
    const accounts: { email: string; label: string }[] = [];
    const owner = this.data.platformStaff().find((member) => member.role === 'owner');

    if (owner) {
      accounts.push({ email: owner.email, label: `Platform owner · ${owner.fullName}` });
    }

    for (const tenant of this.data.tenants()) {
      const admin = this.data.usersForTenant(tenant.id).find((user) => user.role === 'admin');
      if (admin) {
        accounts.push({ email: admin.email, label: `${tenant.businessName} · ${admin.fullName}` });
      }
    }

    return accounts;
  });

  protected useAccount(email: string): void {
    this.email = email;
    this.status.set('idle');
    this.result.set(null);
  }

  protected async onSubmit(form: NgForm): Promise<void> {
    if (form.invalid || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.status.set('idle');

    const outcome = await this.data.requestPasswordReset(this.email);
    this.sending.set(false);

    if (outcome.found && outcome.token) {
      this.result.set({ token: outcome.token, name: outcome.name ?? this.email });
      this.status.set('sent');
      return;
    }

    this.result.set(null);
    this.status.set('unknown');
  }
}
