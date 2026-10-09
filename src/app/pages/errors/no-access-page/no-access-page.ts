import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { PermissionService } from '../../../core/authorization/permission.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { PlannedState } from '../../../shared/ui/planned-state/planned-state';

@Component({
  selector: 'app-no-access-page',
  imports: [PageHeader, PlannedState],
  templateUrl: './no-access-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAccessPage {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  private readonly workspace = inject(WorkspaceContext);
  protected readonly permissions = inject(PermissionService);

  protected readonly missing = computed(() => this.route.snapshot.queryParamMap.get('need'));

  protected readonly title = computed(() =>
    this.workspace.isPlatform() ? 'Platform console access required' : 'Workspace access required',
  );

  protected readonly description = computed(
    () =>
      `Signed in as ${this.session.user()?.fullName ?? 'a guest member'} on ${
        this.workspace.resolved().host || 'an unknown host'
      }. Ask an administrator to enable this module for your role, or change it under Roles & Menus.`,
  );

  protected readonly hints = computed(() => [
    this.missing()
      ? `Missing capability: ${this.missing()}`
      : 'The route did not name a capability',
    `Menus open for you: ${this.permissions.visibleMenu().length}`,
    'Roles & Menus → pick a role → tick the menu',
  ]);
}
