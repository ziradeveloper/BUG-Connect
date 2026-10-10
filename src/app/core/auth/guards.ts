import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CanActivateFn, CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';

import { PermissionService } from '../authorization/permission.service';
import type { AccessLevel, Capability } from '../authorization/role.model';
import { SessionService } from './session.service';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { WorkspaceKind } from '../workspace/workspace.model';

/**
 * Signed in? Otherwise bounce to /login with the intended URL preserved.
 *
 * SSR note: the guard runs on the server before the browser can restore the
 * session from localStorage. On the server we always return `true` so SSR
 * renders the page shell; the browser re-runs the guard after hydration and
 * either keeps the user on the page (session found) or redirects to /login.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // On the server there is no localStorage — the session cannot be restored,
  // so we let the render proceed. The browser guard will enforce auth.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  session.enforceScope();

  if (session.user()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/**
 * Navigation-level capability check. This is not a security boundary — the data
 * is dummy and the session is client-side. It exists so the menu, the route and
 * the disabled buttons all read the same role record.
 *
 * SSR note: same as `authGuard` — the server cannot see the localStorage
 * session, so it lets the render proceed and the browser re-runs the check
 * after hydration. A strict server check would SSR every guarded route as
 * `/no-access` even for signed-in users.
 */
export function permissionGuard(
  capability: Capability,
  level: AccessLevel = 'view',
): CanActivateFn {
  return () => {
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) {
      return true;
    }

    const permissions = inject(PermissionService);
    const router = inject(Router);

    return permissions.can(capability, level)
      ? true
      : router.createUrlTree(['/no-access'], { queryParams: { need: capability } });
  };
}

/**
 * Route-tree selector by workspace. Keeps `/clients` unreachable on a tenant
 * subdomain and `/inbox` unreachable on the platform host, without duplicating
 * the route table per host.
 */
export function workspaceGuard(...kinds: WorkspaceKind[]): CanMatchFn {
  return () => {
    const workspace = inject(WorkspaceContext);
    return kinds.includes(workspace.kind());
  };
}

/** Marketing hosts (apex, www, preview default) keep the public site. */
export const marketingGuard: CanMatchFn = () => inject(WorkspaceContext).isMarketing();
