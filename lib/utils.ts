import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Bangkok';

/** Convert seconds → "MM:SS" string */
export function secondsToMMSS(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format pace (sec/km) → "M:SS/km" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || secPerKm <= 0) return '—';
  return `${secondsToMMSS(secPerKm)}/km`;
}

/** Format duration (seconds) → "Xh Ym" or "Ym Zs" */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Parse "MM:SS" time string → total seconds */
export function mmssToSeconds(mmss: string): number {
  if (!mmss) return 0;
  const parts = mmss.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Convert seconds to "H:MM:SS" or "MM:SS" */
export function secondsToHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format a date string in Thailand timezone */
export function thaiDate(dateStr: string, fmt = 'd MMM yyyy'): string {
  try {
    const date = parseISO(dateStr);
    const zoned = toZonedTime(date, TZ);
    return format(zoned, fmt);
  } catch {
    return dateStr;
  }
}

/** Get today's date in Thailand timezone as YYYY-MM-DD */
export function thaiToday(): string {
  const now = new Date();
  const zoned = toZonedTime(now, TZ);
  return format(zoned, 'yyyy-MM-dd');
}

/** Format distance with 2 decimal places */
export function formatDistance(km: number | null | undefined): string {
  if (!km) return '0.00';
  return km.toFixed(2);
}

/** Session type → display color class */
export const SESSION_COLORS: Record<string, string> = {
  'Easy Run':     '#34D399',
  'Recovery Run': '#6EE7B7',
  'Long Run':     '#60A5FA',
  'Tempo':        '#F97316',
  'tempo':        '#F97316',
  'Intervals':    '#EF4444',
  'Strength A':   '#A78BFA',
  'Strength B':   '#A78BFA',
  'Rest':         '#6B7280',
  'Mobility':     '#94A3B8',
  'Race':         '#FBBF24',
};

export function getSessionColor(type: string): string {
  return SESSION_COLORS[type] ?? '#9CA3AF';
}

export const SESSION_TYPES = [
  'Easy Run', 'Recovery Run', 'Long Run',
  'Tempo', 'Intervals', 'Strength A', 'Strength B',
  'Rest', 'Mobility', 'Race', 'Other'
];
