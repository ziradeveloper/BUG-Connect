import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { labelFromSlug } from '../../core/workspace/subdomain.resolver';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { PlannedState } from '../../shared/ui/ui';
import { ShellFrame } from '../shell-frame/shell-frame';

/** The tenant console — `nazeel.localhost:4200`. */
@Component({
  selector: 'app-client-shell',
  imports: [RouterOutlet, ShellFrame, PlannedState],
  template: `
    @if (usable()) {
      <app-shell-frame
        brandName="BUG"
        brandAccent="Connect"
        brandMark="B"
        [menu]="permissions.visibleMenu()"
        [blocked]="permissions.hiddenByRole()"
        [contextLabel]="contextLabel()"
        [contextTone]="contextTone()"
        [showPresence]="true"
        homePath="/"
      >
        <router-outlet />
      </app-shell-frame>
    } @else {
      <main class="shell--orphan">
        <app-planned-state
          icon="⌀"
          phase="Workspace not provisioned"
          [title]="unknownTitle()"
          [description]="unknownDescription()"
          [includes]="unknownHints()"
          back="/"
        />
      </main>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientShell {
  protected readonly permissions = inject(PermissionService);
  protected readonly workspace = inject(WorkspaceContext);

  private readonly data = inject(MockDataService);

  protected readonly tenant = computed(() => this.data.currentTenant());

  /** A client host with no matching tenant is a provisioning problem, not a 404. */
  protected readonly usable = computed(
    () => this.data.tenants().length === 0 || this.tenant() !== null,
  );

  protected readonly contextLabel = computed(() => {
    const tenant = this.tenant();
    return tenant ? `${tenant.businessName} · ${tenant.subscriptionTier}` : 'Workspace';
  });

  protected readonly contextTone = computed<'info' | 'warning'>(() =>
    this.tenant()?.status === 'active' ? 'info' : 'warning',
  );

  protected readonly unknownTitle = computed(() => {
    const slug = this.workspace.slug();
    return slug ? `No workspace named “${labelFromSlug(slug)}” yet` : 'No workspace selected';
  });

  protected readonly unknownDescription = computed(
    () =>
      'The subdomain resolved a workspace label, but no tenant is provisioned for it. Onboarding creates the tenant first, then the number connects.',
  );

  protected readonly unknownHints = computed(() => [
    'Known dev subdomains',
    ...this.data.tenants().map((tenant) => `${tenant.subdomain} — ${tenant.businessName}`),
  ]);
}
