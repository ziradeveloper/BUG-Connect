import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import {
  ANNOUNCEMENT_KINDS,
  AUDIENCE_OPTIONS,
  BODY_MINIMUM,
  TITLE_LIMIT,
  announcementParagraphs,
  announcementState,
  audienceLabel,
  fromLocalInput,
  presetInput,
  toLocalInput,
} from '../../../core/data/announcements';
import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementKind,
} from '../../../core/data/entities';
import { MockDataService } from '../../../core/data/mock-data.service';
import { PLAN_TIERS } from '../../../core/data/plan.seed';
import { DATA_NOW, formatDateTime } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/**
 * Announcement editor (`/announcements/new`, also `/announcements/:id`, wave 6).
 *
 * Writes the notice and shows what it will do before it does it: who it reaches
 * (counted against the live tenant list, not a stored number), what the banner
 * looks like in a workspace, and why it cannot go out yet. Saving as a draft
 * never validates — half-written copy is the point of a draft — but publishing
 * runs the same checks the panel shows, so the button and the write path cannot
 * disagree.
 *
 * Times are read and written in the workspace timezone, the same clock
 * `formatDateTime` renders, so the picker and the list agree.
 */
@Component({
  selector: 'app-announcement-editor-page',
  imports: [RouterLink, FormsModule, PageHeader, StatusPill, ConfirmDialog],
  templateUrl: './announcement-editor-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementEditorPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  readonly id = input('');

  protected readonly kinds = ANNOUNCEMENT_KINDS;
  protected readonly audiences = AUDIENCE_OPTIONS;
  protected readonly tiersAvailable = PLAN_TIERS;
  protected readonly titleLimit = TITLE_LIMIT;
  protected readonly bodyMinimum = BODY_MINIMUM;
  protected readonly formatDateTime = formatDateTime;

  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly kind = signal<AnnouncementKind>('release');
  protected readonly audienceType = signal<AnnouncementAudienceType>('everyone');
  protected readonly tiers = signal<string[]>([]);
  protected readonly industry = signal<string | null>(null);
  protected readonly tenantIds = signal<string[]>([]);
  protected readonly publishAtLocal = signal(presetInput(0, 9));
  protected readonly expiresAtLocal = signal('');
  protected readonly pinned = signal(false);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** What the last publish attempt refused, if it refused. */
  protected readonly refused = signal<string[]>([]);
  protected readonly pendingWithdraw = signal(false);
  protected readonly pendingDelete = signal(false);

  protected readonly canManage = computed(() =>
    this.permissions.can('announcements.manage', 'edit'),
  );

  protected readonly existing = computed(() => this.data.announcementById(this.id()));
  protected readonly isNew = computed(() => !this.existing());
  protected readonly tenants = computed(() => this.data.tenants());
  protected readonly industries = computed(() =>
    [...new Set(this.data.tenants().map((tenant) => tenant.industry))].sort(),
  );

  /** The notice as the form currently describes it. */
  protected readonly draft = computed(() => ({
    title: this.title(),
    body: this.body(),
    kind: this.kind(),
    audience: {
      type: this.audienceType(),
      tiers: [...this.tiers()],
      industry: this.industry(),
      tenantIds: [...this.tenantIds()],
    },
    publishAt: fromLocalInput(this.publishAtLocal()) ?? new Date(DATA_NOW).toISOString(),
    expiresAt: this.expiresAtLocal() ? fromLocalInput(this.expiresAtLocal()) : null,
  }));

  /** Why it cannot go out yet — recomputed as the form changes. */
  protected readonly issues = computed(() => this.data.announcementProblems(this.draft()));

  /** Who it reaches, counted against the live tenant list. */
  protected readonly reach = computed(() => this.data.announcementReach(this.draft()));

  protected readonly audienceSummary = computed(() => audienceLabel(this.draft()));

  protected readonly state = computed(() =>
    announcementState({
      status: this.existing()?.status ?? 'draft',
      publishAt: this.draft().publishAt,
      expiresAt: this.draft().expiresAt,
    }),
  );

  protected stateLabel(): string {
    switch (this.state()) {
      case 'scheduled':
        return 'Scheduled';
      case 'live':
        return 'Live';
      case 'expired':
        return 'Expired';
      case 'withdrawn':
        return 'Withdrawn';
      default:
        return 'Draft';
    }
  }

  protected stateTone(): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (this.state()) {
      case 'live':
        return 'success';
      case 'scheduled':
        return 'info';
      case 'expired':
        return 'warning';
      case 'withdrawn':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /** The banner as a workspace would see it. */
  protected readonly paragraphs = computed(() => announcementParagraphs(this.body()));

  /** The workspaces the current audience resolves to, for the preview panel. */
  protected readonly matched = computed(() =>
    this.data.tenants().filter((tenant) => this.matches(tenant.id)),
  );

  /** Scheduling presets, in the workspace's own clock. */
  protected readonly presets = [
    { label: 'Now', value: presetInput(0, new Date(DATA_NOW + 5.5 * 3_600_000).getUTCHours()) },
    { label: 'Tomorrow 09:00', value: presetInput(1, 9) },
    { label: 'In 7 days, 09:00', value: presetInput(7, 9) },
  ];

  /** Which notice the form was loaded from, so the effect loads it exactly once. */
  private readonly loadedFor = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();

      // Load once per notice: re-running on every dataset write would throw away
      // what the operator is typing.
      if (this.loadedFor() === id) return;

      this.loadedFor.set(id);

      const existing = this.data.announcementById(id);

      this.title.set(existing?.title ?? '');
      this.body.set(existing?.body ?? '');
      this.kind.set(existing?.kind ?? 'release');
      this.audienceType.set(existing?.audience.type ?? 'everyone');
      this.tiers.set(existing ? [...existing.audience.tiers] : []);
      this.industry.set(existing?.audience.industry ?? null);
      this.tenantIds.set(existing ? [...existing.audience.tenantIds] : []);
      this.publishAtLocal.set(toLocalInput(existing?.publishAt ?? null) || presetInput(0, 9));
      this.expiresAtLocal.set(toLocalInput(existing?.expiresAt ?? null));
      this.pinned.set(existing?.pinned ?? false);
      this.refused.set([]);
      this.notice.set(null);
      this.error.set(null);
    });
  }

  private matches(tenantId: string): boolean {
    const draft = this.draft();

    switch (draft.audience.type) {
      case 'tiers': {
        const tenant = this.data.tenantById(tenantId);

        return !!tenant && draft.audience.tiers.includes(tenant.subscriptionTier);
      }
      case 'industry':
        return (
          !!this.data.tenantById(tenantId) &&
          this.data.tenantById(tenantId)!.industry === draft.audience.industry
        );
      case 'tenants':
        return draft.audience.tenantIds.includes(tenantId);
      default:
        return true;
    }
  }

  protected matchesTenant(tenantId: string): boolean {
    return this.matches(tenantId);
  }

  protected toggleTier(tier: string): void {
    this.tiers.update((current) =>
      current.includes(tier) ? current.filter((entry) => entry !== tier) : [...current, tier],
    );
  }

  protected toggleTenant(tenantId: string): void {
    this.tenantIds.update((current) =>
      current.includes(tenantId)
        ? current.filter((entry) => entry !== tenantId)
        : [...current, tenantId],
    );
  }

  protected setAudience(type: AnnouncementAudienceType): void {
    this.audienceType.set(type);
  }

  protected applyPreset(value: string): void {
    this.publishAtLocal.set(value);
  }

  protected applyExpiryPreset(days: number): void {
    this.expiresAtLocal.set(presetInput(days, 18));
  }

  // ── writes ─────────────────────────────────────────────────────────

  protected async saveDraft(): Promise<void> {
    await this.save(false);
  }

  protected async publish(): Promise<void> {
    await this.save(true);
  }

  private async save(publish: boolean): Promise<void> {
    if (!this.canManage()) {
      this.error.set('Your role can read announcements but not change them.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.refused.set([]);

    try {
      const draft = this.draft();
      const result = await this.data.saveAnnouncement({
        id: this.id() || null,
        title: draft.title,
        body: draft.body,
        kind: draft.kind,
        audience: draft.audience,
        publishAt: draft.publishAt,
        expiresAt: draft.expiresAt,
        pinned: this.pinned(),
        publish,
      });

      if (result.problems.length) {
        this.refused.set(result.problems);
        this.error.set('Fix these before it goes out.');
        return;
      }

      const saved = result.announcement;

      this.notice.set(
        publish
          ? `“${saved?.title}” is ${this.state() === 'scheduled' ? 'scheduled' : 'published'} for ${this.reach().workspaces} workspaces.`
          : 'Draft saved.',
      );

      // Point the URL at the saved notice so a reload edits it instead of
      // starting a new one.
      if (saved && this.id() !== saved.id) {
        await this.router.navigate(['/announcements', saved.id], { replaceUrl: true });
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected askWithdraw(): void {
    this.pendingWithdraw.set(true);
  }

  protected async confirmWithdraw(): Promise<void> {
    this.pendingWithdraw.set(false);

    const existing = this.existing();

    if (!existing) return;

    this.loading.set(true);
    const withdrawn = await this.data.withdrawAnnouncement(existing.id);

    this.loading.set(false);
    this.notice.set(
      withdrawn ? 'Withdrawn. Workspaces stop seeing it immediately.' : 'Already withdrawn.',
    );
  }

  protected askDelete(): void {
    this.pendingDelete.set(true);
  }

  protected async confirmDelete(): Promise<void> {
    this.pendingDelete.set(false);

    const existing = this.existing();

    if (!existing) return;

    this.loading.set(true);
    const deleted = await this.data.deleteAnnouncement(existing.id);

    this.loading.set(false);

    if (deleted) {
      await this.router.navigate(['/announcements']);
      return;
    }

    this.error.set('Only a draft can be deleted.');
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
