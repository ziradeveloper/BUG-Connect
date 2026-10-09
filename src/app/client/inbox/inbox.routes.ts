import type { Routes } from '@angular/router';

import { authGuard, permissionGuard } from '../../core/auth/guards';

/**
 * Wave 2 — Team Inbox routes.
 * Mounted under /inbox by client.routes.ts.
 *
 * Layout:
 *   /inbox                   → InboxShell (split pane)
 *     (default child)        → InboxEmpty (select-a-conversation placeholder)
 *     /:conversationId       → ConversationDetailPage (message thread)
 */
export const INBOX_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./inbox-shell').then((m) => m.InboxShellComponent),
    canActivate: [authGuard, permissionGuard('inbox.view')],
    children: [
      {
        path: '',
        title: 'Team Inbox',
        loadComponent: () => import('./inbox-empty').then((m) => m.InboxEmptyComponent),
      },
      {
        path: ':conversationId',
        title: 'Conversation',
        loadComponent: () =>
          import('./conversation-detail/conversation-detail-page').then(
            (m) => m.ConversationDetailPageComponent,
          ),
      },
    ],
  },
];
