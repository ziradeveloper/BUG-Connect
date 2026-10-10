import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Contact Hub tree (wave 3). `/contacts` is the directory; the detail, segment
 * and opt-out screens are added here as their wave-3 items land.
 */
export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Contact Hub',
    loadComponent: () =>
      import('./contacts-page/contacts-page').then((page) => page.ContactsPage),
    canActivate: [permissionGuard('contacts.view')],
  },
];
