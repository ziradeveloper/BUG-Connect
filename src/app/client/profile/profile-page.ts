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
  styles: `
    .profile-card {
      max-inline-size: 46rem;
      padding: clamp(1.2rem, 2.4vw, 1.8rem);
    }

    .profile-card__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.9rem;
    }

    .profile-card__avatar {
      inline-size: 2.75rem;
      block-size: 2.75rem;
      font-size: 0.95rem;
    }

    .profile-card__head h2 {
      margin: 0;
      color: var(--theme-text-primary);
      font-size: 1.1rem;
      font-weight: 730;
      letter-spacing: -0.04em;
    }

    .profile-card__head p {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
    }

    .profile-card__head app-status-pill {
      margin-inline-start: auto;
    }

    .profile-card__facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 0.9rem;
      margin: 1.35rem 0 0;
      padding-block-start: 1.1rem;
      border-block-start: 1px solid var(--theme-border);
    }

    .profile-card__facts dt {
      color: var(--theme-text-secondary);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .profile-card__facts dd {
      margin: 0.3rem 0 0;
      color: var(--theme-text-primary);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .profile-card__facts code {
      font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
      font-size: 0.75rem;
    }

    .profile-card__menus {
      margin-block-start: 1.35rem;
    }

    .profile-card__hidden {
      margin: 0.7rem 0 0;
      font-size: 0.75rem;
      line-height: 1.6;
    }

    .profile-card__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-block-start: 1.4rem;
      padding-block-start: 1.1rem;
      border-block-start: 1px solid var(--theme-border);
    }

    .profile-card__actions p {
      margin: 0;
      max-inline-size: 30rem;
      font-size: 0.75rem;
      line-height: 1.6;
    }

    .dashboard-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0.6rem 0 0;
      padding: 0;
      list-style: none;
    }

    .dashboard-chips li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid var(--theme-border);
      border-radius: 999px;
      padding: 0.3rem 0.6rem;
      color: var(--theme-text-primary);
      font-size: 0.72rem;
      font-weight: 600;
    }
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
