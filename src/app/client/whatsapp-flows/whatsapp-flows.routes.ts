import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — WhatsApp Flows, Meta's native in-chat forms (`/whatsapp-flows`).
 *
 * Distinct from the chat flows at `/flows`: those are conversation trees the
 * engine walks, these are single JSON documents rendered inside the chat. They
 * share the automation capabilities because the same people own both.
 *
 * Reading a form is a view action; creating or editing one needs `flows.manage`
 * at edit level, which is also what gates every write in the studio.
 */
export const WHATSAPP_FLOW_ROUTES: Routes = [
  {
    path: '',
    title: 'WhatsApp Forms',
    loadComponent: () =>
      import('./whatsapp-flows-page/whatsapp-flows-page').then((page) => page.WhatsAppFlowsPage),
    canActivate: [permissionGuard('flows.view')],
  },
  {
    path: 'new',
    title: 'New WhatsApp form',
    loadComponent: () =>
      import('./whatsapp-form-studio-page/whatsapp-form-studio-page').then(
        (page) => page.WhatsAppFormStudioPage,
      ),
    canActivate: [permissionGuard('flows.manage', 'edit')],
  },
  {
    path: ':id',
    title: 'WhatsApp form studio',
    loadComponent: () =>
      import('./whatsapp-form-studio-page/whatsapp-form-studio-page').then(
        (page) => page.WhatsAppFormStudioPage,
      ),
    canActivate: [permissionGuard('flows.view')],
  },
];
