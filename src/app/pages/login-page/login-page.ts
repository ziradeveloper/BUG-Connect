import { Component, computed, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { labelFromSlug } from '../../core/workspace/subdomain.resolver';
import { SiteHeader } from '../../shared/site-header/site-header';

type LoginStatus = 'success' | 'error' | 'info';

/** The tenant the dev/preview host falls back to so sign-in has somewhere to go. */
const DEFAULT_DEMO_WORKSPACE = 'nazeel';

const DEMO_ACCOUNTS = [
  { id: 'systemadmin', label: 'Platform Admin', note: 'Platform console (admin.localhost)' },
  { id: 'admin', label: 'Workspace Admin', note: 'Tenant workspace (nazeel.localhost)' },
  { id: 'supervisor', label: 'Supervisor', note: 'No WhatsApp or billing' },
  { id: 'agent', label: 'Support agent', note: 'Inbox and contacts only' },
] as const;

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, SiteHeader],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly session = inject(SessionService);
  protected readonly workspace = inject(WorkspaceContext);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected username = '';
  protected password = '';
  protected passwordVisible = false;
  protected statusMessage = '';
  protected statusType: LoginStatus = 'info';

  protected readonly demoAccounts = DEMO_ACCOUNTS;

  protected readonly target = computed(() => {
    const resolved = this.workspace.resolved();

    if (resolved.kind === 'platform') {
      return { label: 'Platform console', detail: 'Administering every workspace', tone: 'success' as const };
    }

    if (resolved.kind === 'client' && resolved.slug) {
      const via = resolved.source === 'dev-override' ? ' via dev override' : '';
      return {
        label: `${labelFromSlug(resolved.slug)} workspace`,
        detail: `Signing in here enters that workspace${via}`,
        tone: resolved.source === 'dev-override' ? ('warning' as const) : ('info' as const),
      };
    }

    return {
      label: 'Public site',
      detail: 'This host has no workspace. Sign in to open the demo workspace.',
      tone: 'neutral' as const,
    };
  });

  protected readonly demoPassword = computed(() => this.session.demoPassword);

  protected togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  protected useAccount(id: string): void {
    this.username = id;
    this.password = this.demoPassword();
    this.statusType = 'info';
    this.statusMessage = `Filled the ${id} demo account. Password is ${this.demoPassword()}.`;
  }

  protected onSubmit(form: NgForm): void {
    this.statusMessage = '';

    if (form.invalid) {
      return;
    }

    const result = this.session.login(this.username, this.password);

    if (!result.ok) {
      this.statusType = 'error';
      this.statusMessage = result.message ?? 'Sign in failed.';
      return;
    }

    this.statusType = 'success';
    this.statusMessage = `Signed in as ${this.session.user()?.roleLabel}. Demo sign-in accepted.`;
    void this.enter();
  }

  /**
   * On a dev or preview host there is no tenant subdomain to come back from, so
   * sign-in selects the demo workspace before navigating. On a real tenant host
   * the resolved workspace is already correct and nothing is overridden.
   */
  private async enter(): Promise<void> {
    const user = this.session.user();
    if (this.workspace.isMarketing() && this.workspace.canOverride()) {
      if (user?.scope === 'platform') {
        this.workspace.setDevWorkspace('admin');
      } else {
        this.workspace.setDevWorkspace(DEFAULT_DEMO_WORKSPACE);
      }
    }

    const next = this.route.snapshot.queryParamMap.get('next');
    await this.router.navigateByUrl(next && next.startsWith('/') ? next : '/');
  }

  protected requestPasswordReset(): void {
    this.statusType = 'info';
    this.statusMessage = 'Password recovery is not available in this demo login yet.';
  }
}
