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

/** Human file size — used on attachment chips and document bubbles. */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `03:24` for audio, voice notes and video duration badges. */
export function formatClock(totalSeconds: number | undefined | null): string {
  if (!totalSeconds || Number.isNaN(totalSeconds)) {
    return '0:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Wall-clock time for a message bubble: `14:05`. */
export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso || iso === 'never') {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Day separator for a message thread: "Today", "Yesterday", then the date.
 * Uses the seeded dataset clock so the demo reads consistently.
 */
export function dayLabel(iso: string, reference: Date | string | number = DATA_NOW): string {
  const stamp = Date.parse(iso);
  if (Number.isNaN(stamp)) {
    return '';
  }

  const refStamp = typeof reference === 'object' ? reference.getTime() : Date.parse(String(reference));
  const startOf = (value: number): number => new Date(value).setHours(0, 0, 0, 0);

  const dayDiff = Math.round((startOf(refStamp) - startOf(stamp)) / DAY);

  if (dayDiff === 0) {
    return 'Today';
  }

  if (dayDiff === 1) {
    return 'Yesterday';
  }

  return new Date(stamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
