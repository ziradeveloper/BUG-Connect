import type { Routes } from '@angular/router';

import { authGuard, permissionGuard } from '../core/auth/guards';
import type { Capability } from '../core/authorization/role.model';
import type { PlannedConfig } from '../client/later/planned-module-page';

/**
 * Platform console tree — mounted only when the host is the admin subdomain.
 * Role and menu components are shared with the client module on purpose: the
 * scope comes from the resolved workspace, not from a duplicate page.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../layout/admin-shell/admin-shell').then((shell) => shell.AdminShell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Platform dashboard',
        loadComponent: () =>
          import('../admin/dashboard/admin-dashboard-page').then((page) => page.AdminDashboardPage),
      },
      {
        path: 'clients',
        title: 'Clients',
        loadComponent: () =>
          import('../admin/clients/clients-page').then((page) => page.ClientsPage),
        canActivate: [permissionGuard('clients.view')],
      },
      {
        path: 'users',
        title: 'Platform staff',
        loadComponent: () => import('../admin/staff/staff-page').then((page) => page.StaffPage),
        canActivate: [permissionGuard('users.view')],
      },
      {
        path: 'roles',
        title: 'Roles & menus',
        loadComponent: () => import('../client/roles/roles-page').then((page) => page.RolesPage),
        canActivate: [permissionGuard('roles.view')],
      },
      {
        path: 'roles/:roleId',
        title: 'Role permissions',
        loadComponent: () =>
          import('../client/roles/role-detail-page').then((page) => page.RoleDetailPage),
        canActivate: [permissionGuard('roles.view')],
      },
      {
        path: 'profile',
        title: 'My account',
        loadComponent: () =>
          import('../client/profile/profile-page').then((page) => page.ProfilePage),
      },
      {
        path: 'plans',
        title: 'Plans & features',
        loadChildren: () => import('./admin-later.routes').then((routes) => routes.PLANS_ROUTES),
      },
      {
        path: 'subscriptions',
        title: 'Subscriptions',
        loadChildren: () =>
          import('./admin-later.routes').then((routes) => routes.SUBSCRIPTIONS_ROUTES),
      },
      {
        path: 'meta-config',
        title: 'Meta app & webhook',
        loadChildren: () =>
          import('./admin-later.routes').then((routes) => routes.META_CONFIG_ROUTES),
      },
      {
        path: 'health',
        title: 'Webhook health',
        loadChildren: () => import('./admin-later.routes').then((routes) => routes.HEALTH_ROUTES),
      },
      {
        path: 'analytics',
        title: 'Cross-tenant analytics',
        loadChildren: () =>
          import('./admin-later.routes').then((routes) => routes.ANALYTICS_ROUTES),
      },
      {
        path: 'announcements',
        title: 'Announcements',
        loadChildren: () =>
          import('./admin-later.routes').then((routes) => routes.ANNOUNCEMENTS_ROUTES),
      },
      {
        path: 'audit',
        title: 'Platform audit',
        loadChildren: () =>
          import('./admin-later.routes').then((routes) => routes.PLATFORM_AUDIT_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
