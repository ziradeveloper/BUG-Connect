import type { Routes } from '@angular/router';

import { marketingGuard, workspaceGuard } from './core/auth/guards';

/**
 * One route table, three mutually exclusive trees.
 *
 * `canMatch` runs against the host resolved in `core/workspace`, so a client
 * workspace never even registers `/clients` and the platform console never
 * registers `/inbox`. Shared paths (`/login`, `/no-access`) sit above the trees
 * because every host needs them.
 *
 * Order matters: the more specific tree first, marketing last, wildcard always
 * final.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in',
    loadComponent: () => import('./pages/login-page/login-page').then((page) => page.LoginPage),
  },
  {
    path: 'no-access',
    title: 'No access',
    loadComponent: () => import('./pages/errors/error-pages').then((pages) => pages.NoAccessPage),
  },
  {
    // Self-service auth (wave 5). Shared across hosts: an invite or a reset
    // link has to open whether it was sent from the platform or a workspace.
    path: 'forgot-password',
    title: 'Forgot password',
    loadComponent: () =>
      import('./pages/forgot-password-page/forgot-password-page').then(
        (page) => page.ForgotPasswordPage,
      ),
  },
  {
    path: 'reset-password',
    title: 'Reset password',
    loadComponent: () =>
      import('./pages/reset-password-page/reset-password-page').then(
        (page) => page.ResetPasswordPage,
      ),
  },
  {
    path: 'accept-invite',
    title: 'Accept invitation',
    loadComponent: () =>
      import('./pages/accept-invite-page/accept-invite-page').then(
        (page) => page.AcceptInvitePage,
      ),
  },
  {
    path: '',
    canMatch: [workspaceGuard('platform')],
    loadChildren: () => import('./admin/admin.routes').then((routes) => routes.ADMIN_ROUTES),
  },
  {
    path: '',
    canMatch: [workspaceGuard('client')],
    loadChildren: () => import('./client/client.routes').then((routes) => routes.CLIENT_ROUTES),
  },
  {
    path: '',
    pathMatch: 'full',
    canMatch: [marketingGuard],
    loadComponent: () =>
      import('./pages/landing-page/landing-page').then((page) => page.LandingPage),
  },
  {
    path: '**',
    title: 'Not found',
    loadComponent: () => import('./pages/errors/error-pages').then((pages) => pages.NotFoundPage),
  },
];
