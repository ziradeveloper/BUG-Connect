import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
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
export class ShellFrame implements OnDestroy {
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
  protected readonly collapsed = signal(this.loadCollapsedState());

  private loadCollapsedState(): boolean {
    try {
      return localStorage.getItem('bugconnect_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  }

  protected toggleCollapse(): void {
    this.hideTooltip();
    this.collapsed.update((v) => {
      const next = !v;
      try {
        localStorage.setItem('bugconnect_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }

  private readonly router = inject(Router);
  private readonly el = inject(ElementRef);

  /** Singleton floating tooltip element appended to <body> */
  private tooltipEl: HTMLDivElement | null = null;
  private tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }

  protected showTooltip(event: MouseEvent, label: string): void {
    if (!this.collapsed()) return;
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const tip = this.getOrCreateTooltip();
    tip.textContent = label;
    // Position: right of the rail element, vertically centered
    tip.style.top = `${rect.top + rect.height / 2}px`;
    tip.style.left = `${rect.right + 12}px`;
    tip.classList.add('shell-tooltip--visible');
  }

  protected hideTooltip(): void {
    this.tooltipHideTimer = setTimeout(() => {
      this.getOrCreateTooltip().classList.remove('shell-tooltip--visible');
    }, 80);
  }

  private getOrCreateTooltip(): HTMLDivElement {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'shell-tooltip';
      document.body.appendChild(this.tooltipEl);
    }
    return this.tooltipEl;
  }

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
