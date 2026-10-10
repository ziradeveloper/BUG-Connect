import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Template Manager tree (wave 3). The editor handles both `/new` and drafts
 * reopened via `:templateId`; submitted templates are read-only by status.
 */
export const TEMPLATES_ROUTES: Routes = [
  {
    path: '',
    title: 'Template Manager',
    loadComponent: () =>
      import('./templates-page/templates-page').then((page) => page.TemplatesPage),
    canActivate: [permissionGuard('templates.view')],
  },
  {
    path: 'new',
    title: 'New template',
    loadComponent: () =>
      import('./template-editor-page/template-editor-page').then((page) => page.TemplateEditorPage),
    canActivate: [permissionGuard('templates.manage', 'edit')],
  },
  {
    path: ':templateId',
    title: 'Edit template',
    loadComponent: () =>
      import('./template-editor-page/template-editor-page').then((page) => page.TemplateEditorPage),
    canActivate: [permissionGuard('templates.manage', 'edit')],
  },
];
