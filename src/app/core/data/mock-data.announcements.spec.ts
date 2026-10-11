import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { announcementState } from './announcements';
import { DATA_NOW } from '../../shared/format';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { buildDataset } from './mock-data';
import { MockDataService } from './mock-data.service';

/**
 * Wave 6 data layer: the platform notices and their write path.
 *
 * The seeded set covers every state so the list is never empty in a demo, and
 * the service refuses a publish the editor would have flagged — the two have to
 * agree, or the button lies.
 */
describe('MockDataService (Announcements / wave 6)', () => {
  let data: MockDataService;

  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: computed(() => resolution().kind),
            slug: computed(() => resolution().slug),
            isPlatform: computed(() => resolution().kind === 'platform'),
            isClient: computed(() => resolution().kind === 'client'),
            isMarketing: computed(() => resolution().kind === 'marketing'),
            isWorkspace: computed(() => resolution().kind !== 'marketing'),
            displayName: computed(() => 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
    data = TestBed.inject(MockDataService);
  });

  const state = (id: string): string =>
    announcementState(data.announcementById(id)!, DATA_NOW);

  it('seeds a notice in every state, and nothing else moves', () => {
    const dataset = buildDataset();
    const states = dataset.announcements.map((item) =>
      announcementState(item, DATA_NOW),
    );

    expect(dataset.announcements.length).toBe(6);
    expect(states).toContain('live');
    expect(states).toContain('scheduled');
    expect(states).toContain('expired');
    expect(states).toContain('draft');
    expect(states).toContain('withdrawn');
    // Every audience kind is represented, so the editor's radio group is honest.
    const kinds = new Set(dataset.announcements.map((item) => item.audience.type));

    expect(kinds).toEqual(new Set(['everyone', 'tiers', 'industry', 'tenants']));
    // The author is a real seeded platform user, not a name that exists nowhere.
    const staff = new Set(dataset.platformStaff.map((person) => person.fullName));

    expect(dataset.announcements.every((item) => staff.has(item.createdBy))).toBe(true);
    // The announcement block runs last, on its own stream.
    expect(buildDataset().announcements.map((item) => item.id)).toEqual(
      dataset.announcements.map((item) => item.id),
    );
    expect(buildDataset().messages.length).toBe(dataset.messages.length);
    expect(buildDataset().apiKeys.length).toBe(dataset.apiKeys.length);
  });

  it('lists next-to-go-out first and counts the reach of each', () => {
    const rows = data.announcements();

    expect(rows.length).toBe(6);
    for (let index = 1; index < rows.length; index += 1) {
      expect(Date.parse(rows[index - 1]!.publishAt)).toBeGreaterThanOrEqual(
        Date.parse(rows[index]!.publishAt),
      );
    }

    const reach = data.announcementReach(rows.find((row) => row.id === 'ann-maintenance')!);

    expect(reach.workspaces).toBe(data.tenants().length);
    expect(reach.label).toBe('Every workspace');
    expect(state('ann-flow-builder')).toBe('live');
    expect(state('ann-invoices')).toBe('scheduled');
    expect(state('ann-trial-billing')).toBe('expired');
    expect(state('ann-residency')).toBe('draft');
    expect(state('ann-withdrawn')).toBe('withdrawn');
  });

  it('saves a half-written draft without complaining', async () => {
    const before = data.announcements().length;

    const result = await data.saveAnnouncement({
      id: null,
      title: 'Half a thought',
      body: '',
      kind: 'release',
      audience: { type: 'tiers', tiers: [], industry: null, tenantIds: [] },
      publishAt: new Date(DATA_NOW + 86_400_000).toISOString(),
      expiresAt: null,
      pinned: false,
      publish: false,
    });

    expect(result.problems).toEqual([]);
    expect(result.announcement?.status).toBe('draft');
    expect(data.announcements()).toHaveLength(before + 1);
    expect(data.announcementById(result.announcement!.id)).not.toBeNull();
    expect(data.platformAudit()[0]?.action).toContain('draft');
  });

  it('refuses to publish what the editor would have flagged, and writes nothing', async () => {
    const before = data.announcements().length;

    const result = await data.saveAnnouncement({
      id: null,
      title: '',
      body: 'short',
      kind: 'policy',
      audience: { type: 'tiers', tiers: [], industry: null, tenantIds: [] },
      publishAt: new Date(DATA_NOW + 86_400_000).toISOString(),
      expiresAt: null,
      pinned: false,
      publish: true,
    });

    expect(result.announcement).toBeNull();
    expect(result.problems).toContain('Give the notice a title.');
    expect(result.problems).toContain('Pick the plan tiers this notice is for.');
    expect(data.announcements()).toHaveLength(before);
  });

  it('publishes, then updates the same notice instead of adding another', async () => {
    const draft = {
      title: 'Pricing page refresh on 20 October',
      body: 'The pricing page moves to per-seat billing language. Nothing changes in what you pay.',
      kind: 'billing' as const,
      audience: {
        type: 'tiers' as const,
        tiers: ['Pilot'],
        industry: null,
        tenantIds: [],
      },
      publishAt: new Date(DATA_NOW + 2 * 86_400_000).toISOString(),
      expiresAt: null,
      pinned: false,
    };
    const created = await data.saveAnnouncement({ ...draft, id: null, publish: true });

    expect(created.announcement?.status).toBe('published');
    // Two days out, so it is scheduled rather than live.
    expect(announcementState(created.announcement!, DATA_NOW)).toBe('scheduled');
    expect(data.announcementReach(created.announcement!).workspaces).toBe(
      data.tenants().filter((tenant) => tenant.subscriptionTier === 'Pilot').length,
    );

    const updated = await data.saveAnnouncement({
      ...draft,
      id: created.announcement!.id,
      title: 'Pricing page refresh moved to 27 October',
      publish: true,
    });

    expect(updated.announcement?.id).toBe(created.announcement!.id);
    expect(updated.announcement?.title).toContain('27 October');
    // One row, edited — not a second notice.
    expect(data.announcements().filter((row) => row.id === created.announcement!.id)).toHaveLength(
      1,
    );
    expect(data.platformAudit()[0]?.area).toBe('platform');
  });

  it('withdraws a notice once and deletes drafts only', async () => {
    expect(await data.withdrawAnnouncement('ann-maintenance')).toBe(true);
    expect(data.announcementById('ann-maintenance')?.status).toBe('withdrawn');
    // The row stays, so the record shows it went out and came back.
    expect(data.announcements().some((row) => row.id === 'ann-maintenance')).toBe(true);
    expect(await data.withdrawAnnouncement('ann-maintenance')).toBe(false);

    // A published notice cannot be deleted.
    expect(await data.deleteAnnouncement('ann-flow-builder')).toBe(false);
    expect(data.announcementById('ann-flow-builder')).not.toBeNull();

    // A draft can.
    expect(await data.deleteAnnouncement('ann-residency')).toBe(true);
    expect(data.announcementById('ann-residency')).toBeNull();
    expect(await data.deleteAnnouncement('never-existed')).toBe(false);
  });

  it('pins and unpins without touching the copy', async () => {
    const before = data.announcementById('ann-flow-builder')!;

    expect(before.pinned).toBe(false);
    expect(await data.setAnnouncementPinned('ann-flow-builder', true)).toBe(true);
    expect(data.announcementById('ann-flow-builder')?.pinned).toBe(true);
    expect(data.announcementById('ann-flow-builder')?.title).toBe(before.title);
    expect(await data.setAnnouncementPinned('never-existed', true)).toBe(false);
  });
});
