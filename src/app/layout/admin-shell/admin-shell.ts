import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { ShellFrame } from '../shell-frame/shell-frame';

/**
 * The platform console — `admin.localhost:4200`. Deliberately no presence
 * toggle: platform staff do not take customer chats.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, ShellFrame],
  template: `
    <app-shell-frame
      brandName="BUG"
      brandAccent="Connect"
      brandMark="B"
      [menu]="permissions.visibleMenu()"
      [blocked]="permissions.hiddenByRole()"
      [contextLabel]="contextLabel()"
      contextTone="success"
      [showPresence]="false"
      homePath="/"
    >
      <router-outlet />
    </app-shell-frame>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly permissions = inject(PermissionService);
  private readonly data = inject(MockDataService);

  protected readonly contextLabel = computed(() => {
    const tenants = this.data.tenants();
    const active = tenants.filter((tenant) => tenant.status === 'active').length;
    return `${active} of ${tenants.length} workspaces active`;
  });
}
