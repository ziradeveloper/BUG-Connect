import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { PermissionService } from '../../../core/authorization/permission.service';
import { DashboardPage } from '../../dashboard/dashboard-page';
import { RoleDetailPage } from '../../roles/role-detail-page';
import { UsersPage } from '../users-page/users-page';

describe('client workspace pages', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  beforeEach(() => {
    localStorage.setItem('bugconnect-dev-workspace', 'nazeel');
  });

  afterEach(() => localStorage.clear());

  async function render(
    component: unknown,
    options: { as?: string; inputs?: Record<string, unknown> } = {},
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SessionService).loginAs(options.as ?? 'admin');

    const fixture = TestBed.createComponent(component as never);
    const ref = fixture.componentRef as { setInput(name: string, value: unknown): void };

    for (const [key, value] of Object.entries(options.inputs ?? {})) {
      ref.setInput(key, value);
    }

    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('lists tenant members in the shared data table', async () => {
    const { html } = await render(UsersPage);
    const rows = html.querySelectorAll('tbody .data-table__row');

    expect(rows.length).toBeGreaterThan(0);
    expect(html.querySelector('thead')?.textContent).toContain('Presence');
    expect(rows[0]?.textContent).toMatch(/@/);
  });

  it('gives a manager row actions and withholds them from a role without rights', async () => {
    const manager = await render(UsersPage, { as: 'admin' });
    expect(manager.html.querySelectorAll('tbody button').length).toBeGreaterThan(0);

    const agent = await render(UsersPage, { as: 'agent' });
    expect(agent.html.textContent).toMatch(/@/);
    expect(agent.html.querySelectorAll('tbody button').length).toBe(0);
  });

  it('ticks the menus a role owns in the permission matrix', async () => {
    const { html } = await render(RoleDetailPage, { inputs: { roleId: 'role-supervisor' } });
    const boxes = Array.from(html.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const checked = boxes.filter((box) => box.checked).length;

    const permissions = TestBed.inject(PermissionService);
    const role = permissions.roleFor('role-supervisor');

    expect(role?.menus).toContain('inbox');
    expect(role?.menus).not.toContain('billing');
    expect(boxes.length).toBe(permissions.catalogue().length);
    expect(checked).toBe(role?.menus.length);
  });

  it('renders the client dashboard from the resolved workspace', async () => {
    const { html } = await render(DashboardPage);

    expect(html.textContent).toMatch(/Nazeel/);
    expect(html.querySelectorAll('.metric').length).toBeGreaterThan(0);
  });
});
