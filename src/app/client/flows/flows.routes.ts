import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — the Flow Builder (`/flows`).
 *
 * Four screens over one graph: the list, the canvas that edits it, the simulator
 * that walks it and the versions that record every publish. Reading the graph is
 * `flows.view`; changing it needs `flows.manage` at edit level.
 */
export const FLOW_ROUTES: Routes = [
  {
    path: '',
    title: 'Flow Builder',
    loadComponent: () => import('./flows-page/flows-page').then((page) => page.FlowsPage),
    canActivate: [permissionGuard('flows.view')],
  },
  {
    path: ':id/edit',
    title: 'Flow canvas',
    loadComponent: () =>
      import('./flow-canvas-page/flow-canvas-page').then((page) => page.FlowCanvasPage),
    canActivate: [permissionGuard('flows.manage', 'edit')],
  },
  {
    path: ':id/simulate',
    title: 'Flow simulator',
    loadComponent: () =>
      import('./flow-simulator-page/flow-simulator-page').then((page) => page.FlowSimulatorPage),
    canActivate: [permissionGuard('flows.view')],
  },
  {
    path: ':id/versions',
    title: 'Flow versions',
    loadComponent: () =>
      import('./flow-versions-page/flow-versions-page').then((page) => page.FlowVersionsPage),
    canActivate: [permissionGuard('flows.view')],
  },
];
