import type { Routes } from '@angular/router';

import { authGuard, permissionGuard } from '../core/auth/guards';

/**
 * The tenant console tree. Mounted only when the host resolves to a client
 * subdomain, which is why nothing in here needs an extra tenant path segment —
 * `nazeel.localhost:4200/inbox` is already scoped by the host.
 *
 * Each route names the capability it needs, so the sidebar entry, the guard and
 * the disabled buttons on the page all read one role record.
 */
export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../layout/client-shell/client-shell').then((shell) => shell.ClientShell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard-page').then((page) => page.DashboardPage),
        canActivate: [permissionGuard('dashboard.view')],
      },
      {
        path: 'users',
        title: 'Users',
        loadComponent: () => import('./users/users-page').then((page) => page.UsersPage),
        canActivate: [permissionGuard('users.view')],
      },
      {
        path: 'users/new',
        title: 'Add user',
        loadComponent: () => import('./users/user-form-page').then((page) => page.UserFormPage),
        canActivate: [permissionGuard('users.manage', 'edit')],
      },
      {
        path: 'users/:userId/edit',
        title: 'Edit user',
        loadComponent: () => import('./users/user-form-page').then((page) => page.UserFormPage),
        canActivate: [permissionGuard('users.manage', 'edit')],
      },
      {
        path: 'roles',
        title: 'Roles & menus',
        loadComponent: () => import('./roles/roles-page').then((page) => page.RolesPage),
        canActivate: [permissionGuard('roles.view')],
      },
      {
        path: 'roles/:roleId',
        title: 'Role permissions',
        loadComponent: () => import('./roles/role-detail-page').then((page) => page.RoleDetailPage),
        canActivate: [permissionGuard('roles.view')],
      },
      {
        path: 'inbox',
        title: 'Team Inbox',
        // Wave 2 — Team Inbox split-pane with conversation thread
        loadChildren: () => import('./inbox/inbox.routes').then((m) => m.INBOX_ROUTES),
      },
      {
        path: 'contacts',
        title: 'Contact Hub',
        loadChildren: () => import('./contacts/contacts.routes').then((m) => m.CONTACTS_ROUTES),
      },
      {
        path: 'templates',
        title: 'Template Manager',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.TEMPLATE_ROUTES),
      },
      {
        path: 'teams',
        title: 'Teams & routing',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.TEAMS_ROUTES),
      },
      {
        path: 'flows',
        title: 'Flow Builder',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.FLOW_ROUTES),
      },
      {
        path: 'campaigns',
        title: 'Campaign Manager',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.CAMPAIGN_ROUTES),
      },
      {
        path: 'reports',
        title: 'Analytics & Insights',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.REPORTS_ROUTES),
      },
      {
        path: 'developer',
        title: 'Developer Hub',
        loadChildren: () =>
          import('./later/later.routes').then((routes) => routes.DEVELOPER_ROUTES),
      },
      {
        path: 'billing',
        title: 'Subscription',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.BILLING_ROUTES),
      },
      {
        path: 'audit',
        title: 'Audit log',
        loadChildren: () => import('./later/later.routes').then((routes) => routes.AUDIT_ROUTES),
      },
      {
        path: 'quick-replies',
        title: 'Quick replies',
        loadChildren: () =>
          import('./later/later.routes').then((routes) => routes.QUICK_REPLIES_ROUTES),
      },
      {
        path: 'settings',
        title: 'Workspace settings',
        loadChildren: () => import('./settings/settings.routes').then((routes) => routes.SETTINGS_ROUTES),
      },
      {
        path: 'profile',
        title: 'My account',
        loadComponent: () => import('./profile/profile-page').then((page) => page.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
