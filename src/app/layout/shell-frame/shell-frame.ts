import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { MENU_GROUPS, type MenuEntry } from '../../core/navigation/menu-catalog';
import { ThemeService } from '../../core/theme/theme';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { labelFromSlug } from '../../core/workspace/subdomain.resolver';

/**
 * The frame both modules share: permission-filtered rail on the left, context
 * and identity on top. Kept presentational so the client and admin shells can
 * diverge (presence for agents, workspace switching for the platform) without
 * forking the markup.
 */
@Component({
  selector: 'app-shell-frame',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell-frame.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellFrame {
  readonly brandName = input.required<string>();
  readonly brandAccent = input('');
  readonly brandMark = input('W');
  readonly contextLabel = input('');
  readonly contextTone = input<'info' | 'warning' | 'success' | 'danger' | 'neutral'>('info');
  readonly menu = input.required<MenuEntry[]>();
  readonly blocked = input<MenuEntry[]>([]);
  readonly showPresence = input(false);
  readonly homePath = input('/');

  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(SessionService);
  protected readonly workspace = inject(WorkspaceContext);
  protected readonly data = inject(MockDataService);

  protected readonly navOpen = signal(false);

  private readonly router = inject(Router);

  protected readonly groups = MENU_GROUPS;

  /** Tenant subdomains a dev can jump between (the Arena preview needs this). */
  protected readonly switchable = this.workspace.canOverride();

  protected entriesFor(group: MenuEntry['group']): MenuEntry[] {
    return this.menu().filter((entry) => entry.group === group);
  }

  protected labelForSlug(slug: string): string {
    return labelFromSlug(slug);
  }

  protected switchTo(slug: string | null): void {
    this.workspace.setDevWorkspace(slug);
    void this.router.navigate(['/']);
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }
}
