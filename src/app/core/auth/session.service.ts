import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MockDataService } from '../data/mock-data.service';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { PlatformStaffUser, WorkspaceUser } from '../data/entities';

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleLabel: string;
  avatarInitials: string;
  /** Which console the session belongs to — a client admin cannot open /clients. */
  scope: 'client' | 'platform';
  department?: string;
  online?: boolean;
};

const DEMO_PASSWORD = 'admin@123';
/** localStorage key — scoped to avoid collisions with other apps on localhost. */
const SESSION_KEY = 'bugconnect-session-v2';

/**
 * Dummy session only. It proves role, menu and guard behaviour; it is not a
 * security boundary and the UI says so wherever a session is created.
 *
 * Storage strategy: localStorage (not sessionStorage) so the session survives
 * a browser refresh. The restore() call is guarded by isPlatformBrowser so it
 * never tries to read localStorage during SSR where window does not exist.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly data = inject(MockDataService);
  private readonly workspace = inject(WorkspaceContext);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly user = signal<SessionUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  constructor() {
    // Only restore from storage in the browser — localStorage does not exist on
    // the SSR server, and calling it there would throw or silently return null.
    if (isPlatformBrowser(this.platformId)) {
      this.restore();
    }
  }

  /** Demo IDs: `systemadmin` (platform owner), `admin` (workspace admin), `supervisor`, `agent`. */
  loginAs(demoId: string): { ok: boolean; message?: string } {
    const user = this.resolveUser(demoId);

    if (!user) {
      return {
        ok: false,
        message: 'Unknown user. Use systemadmin for platform, or admin/supervisor/agent for workspace.',
      };
    }

    this.user.set(user);
    this.persist(user);
    return { ok: true };
  }

  login(username: string, password: string): { ok: boolean; message?: string } {
    if (password !== DEMO_PASSWORD) {
      return {
        ok: false,
        message: 'Username or password is incorrect. Check your details and try again.',
      };
    }

    return this.loginAs(username);
  }

  get demoPassword(): string {
    return DEMO_PASSWORD;
  }

  logout(): void {
    this.user.set(null);

    try {
      this.window?.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignored: the in-memory session is already cleared.
    }

    void this.router.navigate(['/login']);
  }

  /**
   * Keeps an already-signed-in user when the subdomain changes scope, otherwise
   * signs out — a client admin must not silently appear inside /clients.
   */
  enforceScope(): void {
    const user = this.user();
    if (!user) {
      return;
    }

    const expected = this.workspace.isPlatform() ? 'platform' : 'client';

    if (user.scope !== expected) {
      this.user.set(null);
    }
  }

  private resolveUser(identifier: string): SessionUser | null {
    const wanted = identifier.trim().toLowerCase();

    if (wanted === 'systemadmin' || wanted === 'system-admin' || wanted === 'platform') {
      return this.fromStaff(this.matchStaff(wanted));
    }

    if (this.workspace.isPlatform()) {
      return this.fromStaff(this.matchStaff(wanted));
    }

    const match = this.matchWorkspaceUser(wanted);
    return match ? this.fromWorkspaceUser(match) : null;
  }

  private matchStaff(wanted: string): PlatformStaffUser {
    const staff = this.data.platformStaff();

    if (
      wanted === 'systemadmin' ||
      wanted === 'system-admin' ||
      wanted === 'platform' ||
      wanted === 'admin' ||
      wanted === 'owner'
    ) {
      return staff.find((member) => member.role === 'owner') ?? staff[0]!;
    }

    return (
      staff.find(
        (member) =>
          member.email.toLowerCase() === wanted ||
          member.fullName.toLowerCase() === wanted ||
          member.role === wanted,
      ) ?? staff[0]!
    );
  }

  private matchWorkspaceUser(wanted: string): WorkspaceUser | null {
    const users = this.data.users();

    if (wanted === 'admin' || wanted === 'administrator' || wanted === 'systemadmin') {
      return users.find((user) => user.role === 'admin') ?? null;
    }

    if (wanted === 'supervisor' || wanted === 'agent' || wanted === 'developer') {
      return users.find((user) => user.role === wanted) ?? null;
    }

    return (
      users.find(
        (user) =>
          user.email.toLowerCase() === wanted ||
          user.fullName.toLowerCase() === wanted ||
          user.id === wanted,
      ) ?? null
    );
  }

  private fromWorkspaceUser(user: WorkspaceUser): SessionUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      roleLabel: labelFor(user.role),
      avatarInitials: initials(user.fullName),
      scope: 'client',
      department: user.department,
      online: user.isOnline,
    };
  }

  private fromStaff(staff: PlatformStaffUser): SessionUser {
    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      roleId: staff.roleId,
      roleLabel: staff.role === 'owner' ? 'Platform Owner' : 'Platform Operations',
      avatarInitials: initials(staff.fullName),
      scope: 'platform',
    };
  }

  private get window(): Window | null {
    return this.document.defaultView as Window | null;
  }

  private persist(user: SessionUser): void {
    try {
      this.window?.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      // Storage blocked (e.g. private mode with storage disabled): session lives
      // in memory only for this visit — the user will need to log in again after
      // a refresh, but the app will not crash.
    }
  }

  private restore(): void {
    try {
      const raw = this.window?.localStorage.getItem(SESSION_KEY);
      if (raw) {
        this.user.set(JSON.parse(raw) as SessionUser);
      }
    } catch {
      // Corrupted / blocked storage — start with no session.
      this.user.set(null);
    }
  }
}

function labelFor(role: WorkspaceUser['role']): string {
  switch (role) {
    case 'admin':
      return 'Workspace Administrator';
    case 'supervisor':
      return 'Supervisor';
    case 'developer':
      return 'Integration User';
    default:
      return 'Support Agent';
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
