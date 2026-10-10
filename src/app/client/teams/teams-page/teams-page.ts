import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Team, WorkspaceUser } from '../../../core/data/entities';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';
import { initials } from '../../../shared/format';

const TEAM_ICONS = ['☎', '◭', '▤', '✦', '⚙', '◉'];

type Draft = {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  weight: number;
  isDefault: boolean;
  memberUserIds: string[];
};

/**
 * Teams & routing (`/teams`). Routing groups for the weighted round-robin:
 * members, relative weights and the default fallback team.
 */
@Component({
  selector: 'app-teams-page',
  imports: [FormsModule, ConfirmDialog, PageHeader, StatusPill],
  templateUrl: './teams-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly pendingDelete = signal<Team | null>(null);

  protected readonly teams = this.data.teams;
  protected readonly users = this.data.users;
  protected readonly canManage = computed(() => this.permissions.can('teams.manage', 'edit'));

  protected readonly icons = TEAM_ICONS;
  protected readonly draft = signal<Draft | null>(null);

  protected readonly initials = initials;

  protected readonly weightTotal = computed(() =>
    this.teams().reduce((sum, team) => sum + team.weight, 0),
  );

  constructor() {
    const data = this.data;
    effect(() => {
      void data.tenantId();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.draft.set(null);
    this.data.listTeams().then(
      () => this.loading.set(false),
      () => {
        this.error.set('The teams could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected membersOf(team: Team): WorkspaceUser[] {
    const users = this.users();
    return team.memberUserIds
      .map((id) => users.find((user) => user.id === id))
      .filter((user): user is WorkspaceUser => !!user);
  }

  protected shareOf(team: Team): number {
    const total = this.weightTotal();
    return total === 0 ? 0 : Math.round((team.weight / total) * 100);
  }

  protected update(patch: Partial<Draft>): void {
    const draft = this.draft();
    if (draft) {
      this.draft.set({ ...draft, ...patch });
    }
  }

  protected newTeam(): void {
    this.error.set(null);
    this.draft.set({
      id: null,
      name: '',
      description: '',
      icon: TEAM_ICONS[0]!,
      weight: 1,
      isDefault: this.teams().length === 0,
      memberUserIds: [],
    });
  }

  protected edit(team: Team): void {
    this.error.set(null);
    this.draft.set({
      id: team.id,
      name: team.name,
      description: team.description,
      icon: team.icon,
      weight: team.weight,
      isDefault: team.isDefault,
      memberUserIds: [...team.memberUserIds],
    });
  }

  protected toggleMember(userId: string): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const selected = draft.memberUserIds.includes(userId);
    this.update({
      memberUserIds: selected
        ? draft.memberUserIds.filter((id) => id !== userId)
        : [...draft.memberUserIds, userId],
    });
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || !this.canManage() || this.saving()) {
      return;
    }
    if (!draft.name.trim()) {
      this.error.set('The team needs a name.');
      return;
    }
    if (draft.memberUserIds.length === 0) {
      this.error.set('Assign at least one member — an empty team receives no chats.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.data.saveTeam({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim(),
        description: draft.description.trim(),
        icon: draft.icon,
        weight: draft.weight,
        isDefault: draft.isDefault,
        memberUserIds: draft.memberUserIds,
      });
      this.draft.set(null);
      this.notice.set(`“${draft.name.trim()}” saved — routing weights updated.`);
    } catch {
      this.error.set('The team could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) {
      return;
    }
    this.pendingDelete.set(null);
    await this.data.deleteTeam(target.id);
    if (this.draft()?.id === target.id) {
      this.draft.set(null);
    }
    this.notice.set(
      target.isDefault
        ? `“${target.name}” deleted — the default moved to the next team.`
        : `“${target.name}” deleted.`,
    );
  }
}
