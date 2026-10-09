import { inject } from '@angular/core';
import type { CanActivateFn, CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';

import { PermissionService } from '../authorization/permission.service';
import type { AccessLevel, Capability } from '../authorization/role.model';
import { SessionService } from './session.service';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { WorkspaceKind } from '../workspace/workspace.model';

/** Signed in? Otherwise bounce to /login with the intended URL preserved. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const workspace = inject(WorkspaceContext);

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
 */
export function permissionGuard(
  capability: Capability,
  level: AccessLevel = 'view',
): CanActivateFn {
  return () => {
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
