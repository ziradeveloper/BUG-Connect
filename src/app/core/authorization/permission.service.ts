import { computed, inject, Injectable, signal } from '@angular/core';

import { MockDataService } from '../data/mock-data.service';
import { SessionService } from '../auth/session.service';
import { WorkspaceContext } from '../workspace/workspace-context';
import {
  CLIENT_MENU,
  MENU_BY_KEY,
  PLATFORM_MENU,
  type MenuEntry,
} from '../navigation/menu-catalog';
import { DEFAULT_PLAN_MODULES, PLAN_MODULES, SEED_ROLES } from './role.seed';
import {
  atLeast,
  CAPABILITY_MENUS,
  type AccessLevel,
  type Capability,
  type MenuKey,
  type Role,
} from './role.model';

/**
 * The only place that answers "can this person see/open this?".
 *
 * Sidebar = role().menus ∩ plan modules. Routes use the same capability check,
 * so a menu that is visible always has a route that opens, and vice versa.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly session = inject(SessionService);
  private readonly data = inject(MockDataService);
  private readonly workspace = inject(WorkspaceContext);

  /** Editable copy of the seeded matrix — the Roles & Menus page writes here. */
  readonly roles = signal<Role[]>(SEED_ROLES.map((role) => ({ ...role, menus: [...role.menus] })));

  readonly activeRole = computed<Role | null>(() => {
    const user = this.session.user();
    if (!user) {
      return null;
    }
    return this.roles().find((role) => role.id === user.roleId) ?? null;
  });

  /**
   * Members per role, counted from the live user list rather than the stored
   * `memberCount` field — a seeded zero must never let a role with people on it
   * be deleted. `rolesWithCounts` and `deleteRole` read the same number.
   */
  private memberCountFor(roleId: string, scope: 'client' | 'platform'): number {
    const users = scope === 'platform' ? this.data.platformStaff() : this.data.users();
    return users.filter((user) => user.roleId === roleId).length;
  }

  readonly rolesWithCounts = computed<Role[]>(() => {
    const scope = this.scope();

    return this.roles()
      .filter((role) => role.scope === scope)
      .map((role) => ({ ...role, memberCount: this.memberCountFor(role.id, scope) }));
  });

  readonly menu = computed<MenuEntry[]>(() => {
    const role = this.activeRole();
    const catalogue = (this.workspace.isPlatform() ? PLATFORM_MENU : CLIENT_MENU).filter(
      (entry) => !entry.hidden,
    );

    if (!role) {
      return catalogue;
    }

    const allowed = new Set<string>(role.menus);

    return catalogue.filter((entry) => allowed.has(entry.key) && !entry.hidden);
  });

  /** Which console is rendering: platform menus or tenant menus. */
  readonly scope = computed<'platform' | 'client'>(() =>
    this.workspace.isPlatform() ? 'platform' : 'client',
  );

  /** The full catalogue for this scope, whether or not the role can open it. */
  readonly catalogue = computed<MenuEntry[]>(() =>
    this.workspace.isPlatform() ? PLATFORM_MENU : CLIENT_MENU,
  );

  /**
   * Catalogue entries the current role cannot reach. The rail shows these as
   * locked so a missing menu item is explained instead of silently absent.
   */
  readonly hiddenByRole = computed<MenuEntry[]>(() => {
    const role = this.activeRole();
    const catalogue = this.workspace.isPlatform() ? PLATFORM_MENU : CLIENT_MENU;

    if (!role) {
      return [];
    }

    const allowed = new Set<string>(role.menus);
    return catalogue.filter((entry) => !allowed.has(entry.key) && !entry.hidden);
  });

  /** Plan gating is layered on top of role gating (Admin owns plans). */
  readonly planModules = computed<Set<MenuKey>>(() => {
    if (this.workspace.isPlatform()) {
      return new Set(PLATFORM_MENU.map((entry) => entry.key));
    }

    const tier = this.data.currentTenant()?.subscriptionTier ?? 'Pilot';
    return new Set<MenuKey>(PLAN_MODULES[tier] ?? DEFAULT_PLAN_MODULES);
  });

  readonly visibleMenu = computed<MenuEntry[]>(() => {
    const plan = this.planModules();
    return this.menu().filter((entry) => plan.has(entry.key));
  });

  readonly deniedByPlan = computed<MenuEntry[]>(() => {
    const plan = this.planModules();
    return this.menu().filter((entry) => !plan.has(entry.key));
  });

  can(capability: Capability, required: AccessLevel = 'view'): boolean {
    const role = this.activeRole();

    console.log('[PermissionService.can]', capability, { role, menus: role?.menus, cap: role?.capabilities[capability], required });

    if (!role) {
      // Unauthenticated or unknown role: allow nothing beyond what the catalogue
      // leaves open, so the guard sends the user to /no-access.
      return false;
    }

    // The menu entry and its capability are one decision: untick `Inbox` on a
    // role and the route stops resolving as well as the sidebar link disappearing.
    const menus = CAPABILITY_MENUS.get(capability);

    if (menus?.length && !menus.some((key) => role.menus.includes(key))) {
      console.log('[PermissionService.can] Failed menu check', menus);
      return false;
    }

    const level = atLeast(role.capabilities[capability], required);
    console.log('[PermissionService.can] atLeast:', level);
    return level;
  }

  levelFor(capability: Capability): AccessLevel {
    return this.activeRole()?.capabilities[capability] ?? 'none';
  }

  canOpen(entry: MenuEntry): boolean {
    return this.can(entry.capability) && this.planModules().has(entry.key);
  }

  roleFor(id: string | null | undefined): Role | null {
    if (!id) {
      return null;
    }
    return this.roles().find((role) => role.id === id) ?? null;
  }

  labelFor(id: string | null | undefined): string {
    return this.roleFor(id)?.name ?? 'Unassigned role';
  }

  menuLabel(key: string): string {
    return MENU_BY_KEY[key as MenuKey]?.label ?? key;
  }

  /** Roles assignable to workspace staff, in the current scope. */
  assignableRoles(): Role[] {
    const scope = this.workspace.isPlatform() ? 'platform' : 'client';
    return this.roles().filter((role) => role.scope === scope);
  }

  saveRole(role: Role): void {
    const exists = this.roles().some((candidate) => candidate.id === role.id);

    this.roles.update((roles) =>
      exists
        ? roles.map((candidate) => (candidate.id === role.id ? role : candidate))
        : [...roles, role],
    );
  }

  toggleMenu(roleId: string, key: MenuKey): void {
    this.roles.update((roles) =>
      roles.map((role) => {
        if (role.id !== roleId) {
          return role;
        }

        const menus = role.menus.includes(key)
          ? role.menus.filter((entry) => entry !== key)
          : [...role.menus, key];

        return { ...role, menus };
      }),
    );
  }

  setLevel(roleId: string, capability: Capability, level: AccessLevel): void {
    this.roles.update((roles) =>
      roles.map((role) =>
        role.id === roleId
          ? { ...role, capabilities: { ...role.capabilities, [capability]: level } }
          : role,
      ),
    );
  }

  deleteRole(id: string): { ok: boolean; message?: string } {
    const role = this.roleFor(id);

    if (!role) {
      return { ok: false, message: 'Role not found.' };
    }

    if (role.system) {
      return { ok: false, message: `${role.name} is a system role and cannot be deleted.` };
    }

    const members = this.memberCountFor(role.id, role.scope);

    if (members > 0) {
      return {
        ok: false,
        message: `Reassign the ${members} member(s) on ${role.name} before deleting it.`,
      };
    }

    this.roles.update((roles) => roles.filter((candidate) => candidate.id !== id));
    return { ok: true };
  }

  newRole(scope: 'client' | 'platform'): Role {
    return {
      id: `role-custom-${Math.random().toString(36).slice(2, 8)}`,
      name: 'New role',
      description: 'Describe what this role is allowed to do.',
      scope,
      menus: ['dashboard', 'profile'],
      capabilities: { 'dashboard.view': 'view', 'profile.manage': 'edit' },
      system: false,
      memberCount: 0,
    };
  }
}
