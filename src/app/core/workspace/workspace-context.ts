import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, REQUEST, signal } from '@angular/core';
import {
  DEV_WORKSPACE_PARAM,
  DEV_WORKSPACE_STORAGE_KEY,
  type ResolvedWorkspace,
  type WorkspaceKind,
} from './workspace.model';
import { resolveWorkspace, workspaceDisplayName } from './subdomain.resolver';

/**
 * Single source of truth for "whose workspace am I rendering?".
 *
 * On the server the host comes from the SSR `REQUEST` headers, so the correct
 * shell is picked before the first byte of HTML — no flash of the wrong
 * workspace, and hydration matches because the browser resolves from the same
 * hostname. `REQUEST` is documented as null during prerender/SSG, which is why
 * an absent request falls back to the configured default host.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceContext {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly request = inject(REQUEST, { optional: true });

  readonly resolved = signal<ResolvedWorkspace>(this.resolveFromEnvironment());

  readonly kind = computed<WorkspaceKind>(() => this.resolved().kind);
  readonly slug = computed(() => this.resolved().slug);
  readonly isPlatform = computed(() => this.resolved().kind === 'platform');
  readonly isClient = computed(() => this.resolved().kind === 'client');
  readonly isMarketing = computed(() => this.resolved().kind === 'marketing');
  readonly isWorkspace = computed(() => this.resolved().kind !== 'marketing');
  readonly displayName = computed(() => workspaceDisplayName(this.resolved()));

  /** True while the host is a dev host, i.e. the workspace switcher may appear. */
  readonly canOverride = computed(() => canUseDevOverride(this.resolved().host));

  /** Switches the workspace in dev, persisting it so reloads keep working. */
  setDevWorkspace(value: string | null): void {
    if (!this.canOverride()) {
      return;
    }

    if (isPlatformBrowser(this.platformId)) {
      try {
        if (value) {
          this.window?.localStorage.setItem(DEV_WORKSPACE_STORAGE_KEY, value);
        } else {
          this.window?.localStorage.removeItem(DEV_WORKSPACE_STORAGE_KEY);
        }
      } catch {
        // Storage blocked: the override still applies for this page load.
      }
    }

    this.resolved.set(
      resolveWorkspace(this.currentHost(), {
        queryOverride: value,
        storedOverride: null,
      }),
    );
  }

  private get window(): Window | null {
    return isPlatformBrowser(this.platformId) ? (this.document.defaultView as Window) : null;
  }

  private currentHost(): string {
    return this.request?.headers?.get('host') ?? this.window?.location.host ?? '';
  }

  private resolveFromEnvironment(): ResolvedWorkspace {
    const host = this.currentHost();
    const search = this.request?.url
      ? new URL(this.request.url, 'http://localhost').searchParams.get(DEV_WORKSPACE_PARAM)
      : this.window?.location.search
        ? new URL(this.window.location.search, 'http://localhost').searchParams.get(DEV_WORKSPACE_PARAM)
        : null;

    let stored: string | null = null;

    if (isPlatformBrowser(this.platformId)) {
      try {
        stored = this.window?.localStorage.getItem(DEV_WORKSPACE_STORAGE_KEY) ?? null;
      } catch {
        stored = null;
      }
    }

    return resolveWorkspace(host, { queryOverride: search, storedOverride: stored });
  }
}

function canUseDevOverride(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:') ||
    host.endsWith('.e2b.app')
  );
}
