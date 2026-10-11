import {
  BODY_MINIMUM,
  TITLE_LIMIT,
  WORKSPACE_TIMEZONE,
  announcementParagraphs,
  announcementState,
  audienceLabel,
  audienceMatches,
  audienceReach,
  fromLocalInput,
  presetInput,
  toLocalInput,
  validateAnnouncement,
} from './announcements';
import type { Announcement, Tenant } from './entities';

/**
 * Announcement rules (wave 6).
 *
 * The point of this module is that one function decides whether a notice is
 * live, who it reaches and why it cannot be sent — so the list, the editor and
 * the write path cannot disagree. Each of those is pinned here by hand.
 */
describe('announcements — state, audience and validation', () => {
  const now = Date.UTC(2026, 9, 8, 12, 0);
  const iso = (offsetDays: number, hour = 9): string =>
    new Date(now + offsetDays * 86_400_000 + hour * 3_600_000).toISOString();

  const notice = (
    overrides: Partial<Announcement> = {},
  ): Announcement => ({
    id: 'ann-1',
    title: 'Scheduled maintenance window',
    body: 'Inbound messages keep arriving; status updates can lag by fifteen minutes.',
    kind: 'maintenance',
    audience: { type: 'everyone', tiers: [], industry: null, tenantIds: [] },
    publishAt: iso(-1),
    expiresAt: iso(3),
    pinned: false,
    status: 'published',
    createdBy: 'Zira Developer',
    createdAt: iso(-2),
    updatedAt: iso(-1),
    views: 3,
    ...overrides,
  });

  const tenants: Tenant[] = [
    {
      id: 'tenant-1',
      subscriptionTier: 'Growth',
      industry: 'Textile, silk and bridal retail',
      seatsUsed: 4,
    },
    {
      id: 'tenant-2',
      subscriptionTier: 'Pilot',
      industry: 'Sweets, bakeries and packaged foods',
      seatsUsed: 2,
    },
    {
      id: 'tenant-3',
      subscriptionTier: 'Scale',
      industry: 'Diagnostic centres and clinics',
      seatsUsed: 7,
    },
  ] as Tenant[];

  it('derives the state from the clock, not from a flag', () => {
    expect(announcementState(notice(), now)).toBe('live');
    expect(announcementState(notice({ publishAt: iso(2) }), now)).toBe('scheduled');
    expect(announcementState(notice({ expiresAt: iso(-1) }), now)).toBe('expired');
    expect(announcementState(notice({ status: 'draft', publishAt: iso(-5) }), now)).toBe('draft');
    expect(announcementState(notice({ status: 'withdrawn' }), now)).toBe('withdrawn');
    // No expiry means it stays live.
    expect(announcementState(notice({ expiresAt: null }), now)).toBe('live');
    // A malformed stamp never makes a published notice vanish.
    expect(announcementState(notice({ publishAt: 'not-a-date' }), now)).toBe('live');
  });

  it('matches an audience by plan, industry or named workspace', () => {
    const growth = tenants[0]!;
    const pilot = tenants[1]!;

    expect(audienceMatches(notice(), growth)).toBe(true);
    expect(
      audienceMatches(notice({ audience: { type: 'tiers', tiers: ['Growth', 'Scale'], industry: null, tenantIds: [] } }), growth),
    ).toBe(true);
    expect(
      audienceMatches(notice({ audience: { type: 'tiers', tiers: ['Scale'], industry: null, tenantIds: [] } }), growth),
    ).toBe(false);
    expect(
      audienceMatches(
        notice({
          audience: {
            type: 'industry',
            tiers: [],
            industry: 'diagnostic centres and clinics',
            tenantIds: [],
          },
        }),
        tenants[2]!,
      ),
    ).toBe(true);
    expect(
      audienceMatches(
        notice({ audience: { type: 'tenants', tiers: [], industry: null, tenantIds: ['tenant-2'] } }),
        growth,
      ),
    ).toBe(false);
    expect(
      audienceMatches(
        notice({ audience: { type: 'tenants', tiers: [], industry: null, tenantIds: ['tenant-2'] } }),
        pilot,
      ),
    ).toBe(true);
    // An audience with nothing selected reaches nobody rather than everybody.
    expect(
      audienceMatches(notice({ audience: { type: 'tiers', tiers: [], industry: null, tenantIds: [] } }), growth),
    ).toBe(false);
  });

  it('counts the workspaces and seats a notice reaches', () => {
    expect(audienceReach(notice(), tenants)).toEqual({
      workspaces: 3,
      seats: 13,
      label: 'Every workspace',
    });
    expect(
      audienceReach(
        notice({ audience: { type: 'tiers', tiers: ['Pilot'], industry: null, tenantIds: [] } }),
        tenants,
      ),
    ).toEqual({ workspaces: 1, seats: 2, label: 'Pilot plans' });
    expect(
      audienceReach(
        notice({ audience: { type: 'tiers', tiers: ['Growth', 'Scale'], industry: null, tenantIds: [] } }),
        tenants,
      ).label,
    ).toBe('Growth + Scale plans');
    expect(
      audienceReach(
        notice({
          audience: { type: 'tenants', tiers: [], industry: null, tenantIds: ['tenant-1', 'tenant-3'] },
        }),
        tenants,
      ),
    ).toEqual({ workspaces: 2, seats: 11, label: '2 named workspaces' });
    expect(audienceLabel(notice({ audience: { type: 'tiers', tiers: [], industry: null, tenantIds: [] } }))).toBe(
      'No tier selected',
    );
  });

  it('says exactly why a notice cannot go out', () => {
    expect(validateAnnouncement(notice(), tenants, now)).toEqual([]);

    expect(validateAnnouncement(notice({ title: '   ' }), tenants, now)).toContain(
      'Give the notice a title.',
    );
    expect(
      validateAnnouncement(notice({ title: 'x'.repeat(TITLE_LIMIT + 1) }), tenants, now)[0],
    ).toContain(`the banner fits ${TITLE_LIMIT}`);
    expect(validateAnnouncement(notice({ body: 'Too short' }), tenants, now)[0]).toContain(
      `${BODY_MINIMUM} characters`,
    );
    expect(
      validateAnnouncement(
        notice({ audience: { type: 'tiers', tiers: [], industry: null, tenantIds: [] } }),
        tenants,
        now,
      ),
    ).toContain('Pick the plan tiers this notice is for.');
    expect(
      validateAnnouncement(
        notice({ audience: { type: 'industry', tiers: [], industry: null, tenantIds: [] } }),
        tenants,
        now,
      ),
    ).toContain('Choose an industry.');
    expect(
      validateAnnouncement(
        notice({ audience: { type: 'tenants', tiers: [], industry: null, tenantIds: [] } }),
        tenants,
        now,
      ),
    ).toContain('Select the workspaces this notice is for.');
    // Expiry before publish is a notice that can never be read.
    expect(
      validateAnnouncement(notice({ publishAt: iso(2), expiresAt: iso(1) }), tenants, now),
    ).toContain('The notice has to expire after it is published.');
    // A window that already closed is refused rather than silently expiring.
    expect(
      validateAnnouncement(notice({ publishAt: iso(-10), expiresAt: iso(-5) }), tenants, now).some(
        (problem) => problem.includes('That window has already passed'),
      ),
    ).toBe(true);
    // Nobody in the audience is a refusal on its own.
    expect(
      validateAnnouncement(
        notice({
          audience: { type: 'tenants', tiers: [], industry: null, tenantIds: ['tenant-99'] },
        }),
        tenants,
        now,
      ),
    ).toContain('No workspace matches that audience.');
  });

  it('splits the body into the paragraphs the banner renders', () => {
    expect(announcementParagraphs('One line\n\nSecond para\n\n\nThird')).toEqual([
      'One line',
      'Second para',
      'Third',
    ]);
    // A single line break inside a paragraph stays a paragraph.
    expect(announcementParagraphs('Wrapped\nline')).toEqual(['Wrapped line']);
    expect(announcementParagraphs('')).toEqual([]);
  });

  it('reads and writes the picker in the workspace timezone', () => {
    expect(WORKSPACE_TIMEZONE).toBe('Asia/Kolkata');
    // 06:30 UTC is 12:00 in IST — the clock formatDateTime shows.
    expect(toLocalInput('2026-10-08T06:30:00.000Z')).toBe('2026-10-08T12:00');
    expect(fromLocalInput('2026-10-08T12:00')).toBe('2026-10-08T06:30:00.000Z');
    // Round trip.
    const original = '2026-11-02T18:30:00.000Z';

    expect(fromLocalInput(toLocalInput(original))).toBe(original);
    // Junk in, nothing out.
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('not-a-time')).toBeNull();
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('not-a-time')).toBe('');
  });

  it('offers scheduling presets on that same clock', () => {
    const tomorrow = presetInput(1, 9, now);

    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
    // 09:00 IST tomorrow is 03:30 UTC tomorrow.
    expect(fromLocalInput(tomorrow)).toBe('2026-10-09T03:30:00.000Z');
    expect(presetInput(0, 18, now)).toMatch(/T18:00$/);
  });
});
