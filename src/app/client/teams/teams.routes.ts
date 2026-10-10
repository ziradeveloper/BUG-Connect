import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/** Teams & routing tree (wave 3): one page, inline CRUD. */
export const TEAMS_ROUTES: Routes = [
  {
    path: '',
    title: 'Teams & routing',
    loadComponent: () => import('./teams-page/teams-page').then((page) => page.TeamsPage),
    canActivate: [permissionGuard('teams.view')],
  },
];
