import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — platform announcements (`/announcements`).
 *
 * The list and the editor are the same module: a notice is written at
 * `/announcements/new` and reopened at `/announcements/:id`. Writing needs
 * `announcements.manage` at edit level; reading the list needs view level, which
 * is what platform operations holds.
 */
export const ANNOUNCEMENT_ROUTES: Routes = [
  {
    path: '',
    title: 'Announcements',
    loadComponent: () =>
      import('./announcements-page/announcements-page').then((page) => page.AnnouncementsPage),
    canActivate: [permissionGuard('announcements.manage')],
  },
  {
    path: 'new',
    title: 'New announcement',
    loadComponent: () =>
      import('./announcement-editor-page/announcement-editor-page').then(
        (page) => page.AnnouncementEditorPage,
      ),
    canActivate: [permissionGuard('announcements.manage', 'edit')],
  },
  {
    path: ':id',
    title: 'Edit announcement',
    loadComponent: () =>
      import('./announcement-editor-page/announcement-editor-page').then(
        (page) => page.AnnouncementEditorPage,
      ),
    canActivate: [permissionGuard('announcements.manage', 'edit')],
  },
];
