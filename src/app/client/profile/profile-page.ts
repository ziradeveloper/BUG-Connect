import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SessionService } from '../../core/auth/session.service';
import { PermissionService } from '../../core/authorization/permission.service';
import { ThemeService } from '../../core/theme/theme';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/** The one page a member can always reach, whatever their role. */
@Component({
  selector: 'app-profile-page',
  imports: [PageHeader, StatusPill],
  template: `
    <div class="workspace-page">
      <app-page-header
        eyebrow="ACCOUNT"
        title="My account"
        description="Who you are in this workspace, and what that role lets you open."
      />

      <section class="surface profile-card">
        <header class="profile-card__head">
          <span class="shell__avatar profile-card__avatar" aria-hidden="true">{{
            user()?.avatarInitials
          }}</span>
          <div>
            <h2>{{ user()?.fullName }}</h2>
            <p class="text-muted">{{ user()?.email }}</p>
          </div>
          @if (user(); as member) {
            <app-status-pill [label]="member.roleLabel" tone="info" />
          }
        </header>

        <dl class="profile-card__facts">
          <dt>Workspace</dt>
          <dd>{{ workspace.displayName() }}</dd>
          <dt>Host</dt>
          <dd>
            <code>{{ workspace.resolved().host || 'unknown' }}</code>
          </dd>
          <dt>Resolved from</dt>
          <dd>{{ sourceLabel() }}</dd>
          <dt>Menus open</dt>
          <dd>{{ permissions.visibleMenu().length }}</dd>
          <dt>Theme</dt>
          <dd>
            <button class="button button-secondary" type="button" (click)="theme.toggleTheme()">
              Switch to {{ theme.isDark() ? 'light' : 'dark' }}
            </button>
          </dd>
        </dl>

        <div class="profile-card__menus">
          <p class="eyebrow">WHAT YOU CAN OPEN</p>
          <ul class="dashboard-chips">
            @for (entry of permissions.visibleMenu(); track entry.key) {
              <li>
                <span aria-hidden="true">{{ entry.icon }}</span
                >{{ entry.label }}
              </li>
            }
          </ul>
          @if (permissions.hiddenByRole().length) {
            <p class="text-muted profile-card__hidden">Hidden by your role: {{ hiddenLabels() }}</p>
          }
        </div>

        <footer class="profile-card__actions">
          <p class="text-muted">
            Dummy session — stored in sessionStorage for navigation only. Real sign-in, tokens and
            the tenant-scoped cookie arrive with the .NET service.
          </p>
          <button class="button button-secondary" type="button" (click)="signOut()">
            Sign out
          </button>
        </footer>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(SessionService);
  protected readonly permissions = inject(PermissionService);
  protected readonly theme = inject(ThemeService);
  protected readonly workspace = inject(WorkspaceContext);

  protected readonly user = this.session.user;

  protected readonly sourceLabel = computed(() => {
    const source = this.workspace.resolved().source;
    return source === 'dev-override'
      ? 'dev override (?ws or the workspace switcher)'
      : source === 'subdomain'
        ? 'subdomain'
        : 'default host';
  });

  protected readonly hiddenLabels = computed(() =>
    this.permissions
      .hiddenByRole()
      .map((entry) => entry.label)
      .join(', '),
  );

  protected signOut(): void {
    this.session.logout();
  }
}
