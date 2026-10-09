import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../auth/session.service';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { PermissionService } from './permission.service';
import { MENU_CAPABILITY, type Role } from './role.model';

/**
 * The permission service is the single source for "can this person open this?".
 * These tests pin the three things every page depends on: role menus drive the
 * sidebar, a plan gate hides a menu *and* its route, and edits round-trip.
 */
describe('PermissionService', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  // Mirrors the real context's shape: every reader uses signals, so the fake
  // exposes computeds rather than methods.
  const fakeWorkspace = {
    resolved: resolution.asReadonly(),
    kind: computed(() => resolution().kind),
    slug: computed(() => resolution().slug),
    isPlatform: computed(() => resolution().kind === 'platform'),
    isClient: computed(() => resolution().kind === 'client'),
    isMarketing: computed(() => resolution().kind === 'marketing'),
    isWorkspace: computed(() => resolution().kind !== 'marketing'),
    displayName: computed(() => resolution().slug ?? 'Platform console'),
    canOverride: computed(() => false),
    setDevWorkspace: () => {},
  } as unknown as WorkspaceContext;

  let permissions: PermissionService;
  let session: SessionService;

  function configure() {
    // A signed-in user from another test lives in sessionStorage; sign-in state
    // is read at construction, so start every case from a clean slate.
    sessionStorage.clear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceContext, useValue: fakeWorkspace },
        // SessionService navigates on logout; this suite has no route table.
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });

    permissions = TestBed.inject(PermissionService);
    session = TestBed.inject(SessionService);
    return permissions;
  }

  it('shows only the menus the active role owns', () => {
    configure();
    session.loginAs('agent');

    const keys = permissions.menu().map((entry) => entry.key);

    expect(keys).toContain('inbox');
    expect(keys).not.toContain('whatsapp');
    expect(keys).not.toContain('billing');
  });

  it('hides what the role has but the plan does not include', () => {
    configure();
    session.loginAs('admin');

    const gated = permissions.deniedByPlan();

    expect(permissions.menu().length).toBe(permissions.visibleMenu().length + gated.length);
    for (const entry of gated) {
      expect(permissions.visibleMenu().some((menu) => menu.key === entry.key)).toBe(false);
    }
  });

  it('gates depth of access separately from the menu', () => {
    configure();
    session.loginAs('supervisor');

    // Seeded as users.view: 'full' and users.manage: 'edit' — a supervisor edits
    // staff but cannot hand out full control.
    expect(permissions.can('inbox.view', 'full')).toBe(true);
    expect(permissions.can('users.view', 'edit')).toBe(true);
    expect(permissions.can('users.manage', 'edit')).toBe(true);
    expect(permissions.can('users.manage', 'full')).toBe(false);
    expect(permissions.can('billing.view', 'view')).toBe(false);
  });

  it('fails closed with no session at all', () => {
    configure();

    expect(permissions.activeRole()).toBeNull();
    expect(permissions.levelFor('inbox.view')).toBe('none');
    expect(permissions.can('inbox.view', 'view')).toBe(false);
    expect(permissions.can('users.view', 'view')).toBe(false);
  });

  it('toggling a menu off removes its route permission too', () => {
    configure();
    session.loginAs('admin');

    const role = permissions.activeRole();
    const capability = MENU_CAPABILITY.inbox;
    expect(role).toBeTruthy();
    expect(permissions.can(capability, 'view')).toBe(true);

    permissions.toggleMenu(role!.id, 'inbox');

    expect(permissions.can(capability, 'view')).toBe(false);
    expect(permissions.visibleMenu().some((entry) => entry.key === 'inbox')).toBe(false);
  });

  it('lowers an access level without hiding the menu', () => {
    configure();
    session.loginAs('admin');

    const role = permissions.activeRole()!;
    permissions.setLevel(role.id, 'campaigns.manage', 'view');

    expect(permissions.levelFor('campaigns.manage')).toBe('view');
    expect(permissions.can('campaigns.manage', 'view')).toBe(true);
    expect(permissions.can('campaigns.manage', 'edit')).toBe(false);
  });

  it('saves a new role scoped to the current workspace', () => {
    configure();
    session.loginAs('admin');

    const draft = permissions.newRole('client');
    const role: Role = {
      ...draft,
      name: 'Read only reviewer',
      menus: ['dashboard', 'inbox', 'contacts'],
    };

    permissions.saveRole(role);

    expect(permissions.roles().some((candidate) => candidate.name === 'Read only reviewer')).toBe(
      true,
    );
    expect(permissions.assignableRoles().some((candidate) => candidate.id === role.id)).toBe(true);
  });

  it('refuses to delete a system role', () => {
    configure();
    session.loginAs('admin');

    const result = permissions.deleteRole('role-admin');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('system role');
    expect(permissions.roleFor('role-admin')).toBeTruthy();
  });

  it('counts members live so a busy role cannot be deleted', () => {
    configure();
    session.loginAs('admin');

    // Same id as the seeded agent role, but no longer a system role: the people
    // already assigned to it must block the delete.
    permissions.saveRole({
      id: 'role-agent',
      name: 'Support desk',
      description: 'Custom role replacing the seeded agent.',
      scope: 'client',
      menus: ['dashboard', 'inbox'],
      capabilities: { 'inbox.view': 'full', 'dashboard.view': 'view' },
      system: false,
      memberCount: 0,
    });

    const listed = permissions.rolesWithCounts().find((role) => role.id === 'role-agent');
    expect(listed?.memberCount).toBeGreaterThan(0);

    const result = permissions.deleteRole('role-agent');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('member');
  });

  it('deletes a custom role nobody is on', () => {
    configure();
    session.loginAs('admin');

    const role = { ...permissions.newRole('client'), name: 'Temp auditor' };
    permissions.saveRole(role);
    expect(permissions.deleteRole(role.id).ok).toBe(true);
    expect(permissions.roleFor(role.id)).toBeNull();
  });

  it('switches the catalogue when the host is the platform console', () => {
    resolution.set({ kind: 'platform', slug: null, host: 'admin.localhost', source: 'subdomain' });
    configure();

    expect(permissions.scope()).toBe('platform');
    expect(permissions.catalogue().map((entry) => entry.key)).toContain('clients');

    resolution.set({
      kind: 'client',
      slug: 'nazeel',
      host: 'nazeel.localhost',
      source: 'subdomain',
    });
  });
});
