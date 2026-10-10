import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Contact Hub tree (wave 3). Static segments come before `:contactId` so
 * `/contacts/segments` never parses as a contact id.
 */
export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Contact Hub',
    loadComponent: () =>
      import('./contacts-page/contacts-page').then((page) => page.ContactsPage),
    canActivate: [permissionGuard('contacts.view')],
  },
  {
    path: 'segments',
    title: 'Contact segments',
    loadComponent: () =>
      import('./segments-page/segments-page').then((page) => page.SegmentsPage),
    canActivate: [permissionGuard('contacts.view')],
  },
  {
    path: 'opt-outs',
    title: 'Opt-out list',
    loadComponent: () =>
      import('./opt-outs-page/opt-outs-page').then((page) => page.OptOutsPage),
    canActivate: [permissionGuard('contacts.view')],
  },
  {
    path: ':contactId',
    title: 'Contact detail',
    loadComponent: () =>
      import('./contact-detail-page/contact-detail-page').then((page) => page.ContactDetailPage),
    canActivate: [permissionGuard('contacts.view')],
  },
];
