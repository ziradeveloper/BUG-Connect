/** Display formatting shared by workspace pages, so "2h ago" reads the same everywhere. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Reference point for the deterministic dummy data. */
const DATA_NOW = Date.UTC(2026, 9, 8, 12, 0);

export function formatRelative(iso: string | null | undefined): string {
  if (!iso || iso === 'never') {
    return 'Never';
  }

  const stamp = Date.parse(iso);

  if (Number.isNaN(stamp)) {
    return iso;
  }

  const delta = DATA_NOW - stamp;

  if (delta < 0) {
    return `in ${formatDuration(-delta)}`;
  }

  return `${formatDuration(delta)} ago`;
}

function formatDuration(ms: number): string {
  if (ms < HOUR) {
    return `${Math.max(1, Math.round(ms / MINUTE))}m`;
  }

  if (ms < DAY) {
    return `${Math.round(ms / HOUR)}h`;
  }

  if (ms < 30 * DAY) {
    return `${Math.round(ms / DAY)}d`;
  }

  return `${Math.round(ms / (30 * DAY))}mo`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso || iso === 'never') {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
