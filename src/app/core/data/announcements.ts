import { DATA_NOW } from '../../shared/format';

import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementKind,
  Tenant,
} from './entities';

/**
 * Platform announcements (wave 6).
 *
 * The editor at `/announcements/new` and the list at `/announcements` share this
 * module, so the state a notice is in, who it reaches and why it cannot be sent
 * are decided in one place — and identically for the preview, the table and the
 * publish check.
 *
 * A notice's state follows the clock rather than a flag: a published notice
 * whose `publishAt` has not arrived is scheduled, and one whose `expiresAt` has
 * passed is expired, with nobody having to remember to update a row.
 */

export type AnnouncementState = 'draft' | 'scheduled' | 'live' | 'expired' | 'withdrawn';

export interface KindOption {
  value: AnnouncementKind;
  label: string;
  hint: string;
}

export const ANNOUNCEMENT_KINDS: KindOption[] = [
  {
    value: 'maintenance',
    label: 'Maintenance',
    hint: 'A window where the console or delivery may be unavailable',
  },
  {
    value: 'release',
    label: 'Release',
    hint: 'Something new landed in the workspace',
  },
  {
    value: 'billing',
    label: 'Billing',
    hint: 'Pricing, invoicing or plan changes',
  },
  { value: 'policy', label: 'Policy', hint: 'Terms, data handling or compliance' },
];

export interface AudienceOption {
  value: AnnouncementAudienceType;
  label: string;
  hint: string;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: 'everyone', label: 'Every workspace', hint: 'All tenants, whatever their plan' },
  { value: 'tiers', label: 'By plan tier', hint: 'Pick the tiers the notice applies to' },
  { value: 'industry', label: 'By industry', hint: 'One industry, across every plan' },
  { value: 'tenants', label: 'Named workspaces', hint: 'Only the workspaces you select' },
];

/** The title is one line in the console banner, so it is capped to match. */
export const TITLE_LIMIT = 90;

/** Long enough to say something useful; short enough to be read. */
export const BODY_MINIMUM = 20;

const DAY = 86_400_000;

/** What the notice is doing right now. */
export function announcementState(
  announcement: Pick<Announcement, 'status' | 'publishAt' | 'expiresAt'>,
  now: number = DATA_NOW,
): AnnouncementState {
  if (announcement.status === 'draft') return 'draft';
  if (announcement.status === 'withdrawn') return 'withdrawn';

  const publishedAt = Date.parse(announcement.publishAt);

  if (!Number.isNaN(publishedAt) && publishedAt > now) return 'scheduled';

  if (announcement.expiresAt) {
    const expiry = Date.parse(announcement.expiresAt);

    if (!Number.isNaN(expiry) && expiry <= now) return 'expired';
  }

  return 'live';
}

/** Whether one workspace is in this notice's audience. */
export function audienceMatches(
  announcement: Pick<Announcement, 'audience'>,
  tenant: Pick<Tenant, 'id' | 'subscriptionTier' | 'industry'>,
): boolean {
  switch (announcement.audience.type) {
    case 'tiers':
      return announcement.audience.tiers.includes(tenant.subscriptionTier);
    case 'industry':
      return (
        announcement.audience.industry !== null &&
        announcement.audience.industry.toLowerCase() === tenant.industry.toLowerCase()
      );
    case 'tenants':
      return announcement.audience.tenantIds.includes(tenant.id);
    default:
      return true;
  }
}

/** How many workspaces and seats a notice would land in. */
export function audienceReach(
  announcement: Pick<Announcement, 'audience'>,
  tenants: Pick<Tenant, 'id' | 'subscriptionTier' | 'industry' | 'seatsUsed'>[],
): { workspaces: number; seats: number; label: string } {
  const matched = tenants.filter((tenant) => audienceMatches(announcement, tenant));

  return {
    workspaces: matched.length,
    seats: matched.reduce((total, tenant) => total + tenant.seatsUsed, 0),
    label: audienceLabel(announcement),
  };
}

/** One line describing the audience, for the table and the editor. */
export function audienceLabel(announcement: Pick<Announcement, 'audience'>): string {
  switch (announcement.audience.type) {
    case 'tiers':
      return announcement.audience.tiers.length
        ? `${announcement.audience.tiers.join(' + ')} plans`
        : 'No tier selected';
    case 'industry':
      return announcement.audience.industry
        ? `${announcement.audience.industry} workspaces`
        : 'No industry selected';
    case 'tenants':
      return announcement.audience.tenantIds.length === 1
        ? 'One named workspace'
        : `${announcement.audience.tenantIds.length} named workspaces`;
    default:
      return 'Every workspace';
  }
}

/**
 * Why this notice cannot go out yet. Empty means it can. Used by the editor to
 * disable the publish button and by the service to refuse a bad write.
 */
export function validateAnnouncement(
  announcement: Pick<
    Announcement,
    'title' | 'body' | 'audience' | 'publishAt' | 'expiresAt'
  >,
  tenants: Pick<Tenant, 'id' | 'subscriptionTier' | 'industry' | 'seatsUsed'>[],
  now: number = DATA_NOW,
): string[] {
  const problems: string[] = [];
  const title = announcement.title.trim();

  if (!title) problems.push('Give the notice a title.');
  else if (title.length > TITLE_LIMIT)
    problems.push(`The title is ${title.length} characters; the banner fits ${TITLE_LIMIT}.`);

  if (announcement.body.trim().length < BODY_MINIMUM)
    problems.push(`Say at least a sentence — ${BODY_MINIMUM} characters or more.`);

  if (announcement.audience.type === 'tiers' && announcement.audience.tiers.length === 0)
    problems.push('Pick the plan tiers this notice is for.');

  if (announcement.audience.type === 'industry' && !announcement.audience.industry)
    problems.push('Choose an industry.');

  if (announcement.audience.type === 'tenants' && announcement.audience.tenantIds.length === 0)
    problems.push('Select the workspaces this notice is for.');

  const publishedAt = Date.parse(announcement.publishAt);

  if (Number.isNaN(publishedAt)) problems.push('The publish time is not a valid date.');

  if (announcement.expiresAt) {
    const expiry = Date.parse(announcement.expiresAt);

    if (Number.isNaN(expiry)) problems.push('The expiry time is not a valid date.');
    else if (!Number.isNaN(publishedAt) && expiry <= publishedAt)
      problems.push('The notice has to expire after it is published.');
  }

  if (!Number.isNaN(publishedAt) && announcement.expiresAt) {
    const expiry = Date.parse(announcement.expiresAt);

    if (!Number.isNaN(expiry) && expiry <= now)
      problems.push('That window has already passed — move the publish time forward.');
  }

  const reach = audienceReach(announcement, tenants);

  if (reach.workspaces === 0) problems.push('No workspace matches that audience.');

  return problems;
}

/** The body split into the paragraphs the console banner renders. */
export function announcementParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The timezone the console renders every timestamp in. */
export const WORKSPACE_TIMEZONE = 'Asia/Kolkata';

const TIMEZONE_OFFSET_MS = 5.5 * 3_600_000;

/**
 * An ISO instant as the value a `datetime-local` input expects, in the workspace
 * timezone — so the picker and `formatDateTime` show the same clock instead of
 * one reading UTC and the other reading IST.
 */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';

  const stamp = Date.parse(iso);

  if (Number.isNaN(stamp)) return '';

  return new Date(stamp)
    .toLocaleString('en-CA', {
      timeZone: WORKSPACE_TIMEZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(', ', 'T')
    .slice(0, 16);
}

/** A `datetime-local` value back to an ISO instant, read in the workspace timezone. */
export function fromLocalInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);

  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  return new Date(utc - TIMEZONE_OFFSET_MS).toISOString();
}

/**
 * A `datetime-local` value for a preset — "in an hour", "tomorrow 09:00" — so
 * scheduling is one click instead of a date-picker exercise.
 */
export function presetInput(offsetDays: number, hour: number, now: number = DATA_NOW): string {
  const shifted = new Date(now + offsetDays * DAY + TIMEZONE_OFFSET_MS);
  const atHour =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      hour,
    ) - TIMEZONE_OFFSET_MS;

  return toLocalInput(new Date(atHour).toISOString());
}
