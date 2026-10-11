import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import type { Capability } from '../../core/authorization/role.model';
import { MockDataService } from '../../core/data/mock-data.service';
import { PageHeader } from '../../shared/ui/ui';

type SettingsCard = {
  title: string;
  description: string;
  path: string;
  action: string;
  icon: string;
  status: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  locked: boolean;
};

/**
 * Settings landing screen (`/settings`).
 *
 * The area has several sub-pages (business profile, WhatsApp connection,
 * routing, roles) and no single editable object of its own, so the root renders
 * the directory with live state on each card. It replaced the placeholder that
 * survived wave 3 — a stub that said "built in wave 3 and 4" while the pages
 * underneath it already existed.
 */
@Component({
  selector: 'app-settings-home-page',
  imports: [RouterLink, PageHeader],
  templateUrl: './settings-home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsHomePage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly tenant = computed(() => this.data.currentTenant());
  protected readonly profile = computed(() => this.data.businessProfile());
  protected readonly connected = computed(() => Boolean(this.tenant()?.metaWabaId));
  protected readonly teamCount = computed(() => this.data.teams().length);
  protected readonly replyCount = computed(() => this.data.quickReplies().length);

  protected readonly cards = computed<SettingsCard[]>(() => {
    const cards: (Omit<SettingsCard, 'locked'> & { capability: Capability })[] = [
      {
        title: 'Business profile',
        description: 'Identity, operating hours, greeting and the out-of-hours auto-responder.',
        path: '/settings/business',
        action: 'Edit profile',
        icon: '◉',
        status: this.profile() ? 'Configured' : 'Not configured',
        tone: this.profile() ? 'success' : 'warning',
        capability: 'settings.view',
      },
      {
        title: 'WhatsApp connection',
        description: 'The Business Account, the customer-facing number and sync health.',
        path: '/settings/whatsapp',
        action: 'Open connection',
        icon: '◍',
        status: this.connected() ? 'Connected' : 'Not connected',
        tone: this.connected() ? 'success' : 'warning',
        capability: 'settings.view',
      },
      {
        title: 'Quick replies',
        description: 'The `/` snippets agents expand in the inbox composer.',
        path: '/quick-replies',
        action: 'Manage replies',
        icon: '✎',
        status: `${this.replyCount()} saved`,
        tone: this.replyCount() ? 'info' : 'warning',
        capability: 'settings.view',
      },
      {
        title: 'Teams & routing',
        description: 'Round-robin groups and the weights that decide who gets the next chat.',
        path: '/teams',
        action: 'Manage teams',
        icon: '◭',
        status: `${this.teamCount()} teams`,
        tone: this.teamCount() ? 'info' : 'warning',
        capability: 'teams.view',
      },
      {
        title: 'Roles & menus',
        description: 'Which menus each role reaches, and at what capability level.',
        path: '/roles',
        action: 'Open roles',
        icon: '⚿',
        status: 'Role matrix',
        tone: 'neutral',
        capability: 'roles.view',
      },
      {
        title: 'Staff & invites',
        description: 'Seats, capacities and the pending invites you can resend.',
        path: '/users',
        action: 'Open users',
        icon: '☺',
        status: 'Seat management',
        tone: 'neutral',
        capability: 'users.view',
      },
    ];

    return cards.map(({ capability, ...card }) => ({
      ...card,
      locked: !this.permissions.can(capability),
    }));
  });
}
