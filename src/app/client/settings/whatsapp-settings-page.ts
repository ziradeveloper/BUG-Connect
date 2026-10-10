import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { formatDateTime, formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/**
 * The workspace's WhatsApp connection (`/settings/whatsapp`): WABA status,
 * the customer-facing number, recent sync health, and the Embedded Signup
 * entry point for workspaces that have not connected yet.
 */
@Component({
  selector: 'app-whatsapp-settings-page',
  imports: [RouterLink, PageHeader, StatusPill],
  templateUrl: './whatsapp-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappSettingsPage {
  private readonly router = inject(Router);
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly tenant = computed(() => this.data.currentTenant());

  protected readonly canManage = computed(() => this.permissions.can('settings.manage', 'edit'));

  protected readonly connected = computed(() => Boolean(this.tenant()?.metaWabaId));

  protected readonly recentEvents = computed(() => {
    const tenant = this.tenant();
    if (!tenant) {
      return [];
    }
    return [...this.data.webhookEventsForTenant(tenant.id)]
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, 5);
  });

  protected readonly failedEvents = computed(
    () => this.recentEvents().filter((event) => event.outcome === 'failed').length,
  );

  protected ago(iso: string | null): string {
    return iso ? formatRelative(iso) : '—';
  }

  protected when(iso: string | null): string {
    return iso ? formatDateTime(iso) : 'Not connected yet';
  }

  /**
   * Simulates Meta's Embedded Signup popup: Meta would redirect back with an
   * authorization code, so this navigates straight to the callback carrying a
   * dummy one.
   */
  protected connect(): void {
    if (!this.canManage()) {
      return;
    }
    const code = `meta-auth-${Date.now().toString(36)}`;
    const state = Math.random().toString(36).slice(2, 10);
    void this.router.navigate(['/settings/whatsapp/callback'], { queryParams: { code, state } });
  }
}
