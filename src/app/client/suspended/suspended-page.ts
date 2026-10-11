import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';

/**
 * Suspended workspace lock screen (`/suspended`, wave 5).
 *
 * Suspension is a platform action (`/clients` on the admin host) and the tenant
 * console has no page that can undo it, so this screen explains the state and
 * points at support instead of rendering a console whose every guard would
 * bounce. `tenantSuspendedGuard` sends traffic here; `activeTenantGuard` keeps
 * healthy workspaces out.
 */
@Component({
  selector: 'app-suspended-page',
  templateUrl: './suspended-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuspendedPage {
  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly workspace = inject(WorkspaceContext);

  protected readonly reactivating = signal(false);
  protected readonly notice = signal<string | null>(null);

  protected readonly tenant = computed(() => this.data.currentTenant());
  protected readonly host = computed(() => this.workspace.resolved().host || 'localhost');
  protected readonly reason = computed(
    () => this.data.suspensionReason() ?? 'This workspace is locked pending an account review.',
  );

  protected readonly support = computed(() => {
    const settings = this.data.platformSettings();
    return { email: settings.supportEmail, phone: settings.supportPhone };
  });

  protected signOut(): void {
    this.session.logout();
  }

  /** Dev-only escape hatch; the real reactivation path is the platform console. */
  protected async reactivate(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.reactivating()) {
      return;
    }

    this.reactivating.set(true);
    await this.data.setTenantStatus(tenant.id, 'active');
    this.reactivating.set(false);
    this.notice.set(`${tenant.businessName} is active again — limits and modules are back.`);
    void this.router.navigate(['/']);
  }
}
