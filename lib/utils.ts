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

/** Normalize free-text session types to standard category names */
export function normalizeSessionType(type: string): string {
  if (!type) return 'Other';
  const trimmed = type.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'interval' || lower.startsWith('interval')) return 'Intervals';
  if (lower === 'tempo' || lower.startsWith('tempo')) return 'Tempo';
  if (lower === 'easy' || lower.startsWith('easy')) return 'Easy Run';
  if (lower === 'long' || lower.startsWith('long')) return 'Long Run';
  if (lower === 'recovery' || lower.startsWith('recovery')) return 'Recovery Run';
  if (lower === 'rest' || lower.startsWith('rest')) return 'Rest';
  if (lower === 'strength b' || lower.endsWith('strength b')) return 'Strength B';
  if (lower === 'strength a' || lower.endsWith('strength a')) return 'Strength A';
  if (lower === 'strength' || lower.startsWith('strength')) return 'Strength';
  if (lower === 'mobility' || lower.startsWith('mobility')) return 'Mobility';
  if (lower === 'race' || lower.startsWith('race')) return 'Race';

  return trimmed;
}

/** Session type → display color (vibrant, clearly distinguishable: light mode) */
export const SESSION_COLORS: Record<string, string> = {
  // Interval: Vivid Crimson / Red
  'Interval': '#EF4444',
  'Intervals': '#EF4444',
  // Tempo: Deep Vibrant Orange
  'Tempo': '#EA580C',
  // Easy: Fresh Emerald Green
  'Easy': '#10B981',
  'Easy Run': '#10B981',
  // Long Run: Royal Blue
  'Long Run': '#2563EB',
  'Long': '#2563EB',
  // Recovery: Deep Teal / Turquoise
  'Recovery': '#0891B2',
  'Recovery Run': '#0891B2',
  // Strength: Vivid Purple
  'Strength': '#7C3AED',
  'Strength A': '#7C3AED',
  'Strength B': '#6D28D9',
  // Rest: Cool Slate Gray
  'Rest': '#64748B',
  'rest': '#64748B',
  // Extra categories
  'Mobility': '#DB2777',
  'Race': '#D97706',
};

/** Session type → display color (high-energy neon: dark mode) */
export const SESSION_COLORS_DARK: Record<string, string> = {
  // Interval: Electric Neon Crimson
  'Interval': '#FF3366',
  'Intervals': '#FF3366',
  // Tempo: Electric Amber Orange
  'Tempo': '#FF8800',
  // Easy: Neon Spring Green
  'Easy': '#00E676',
  'Easy Run': '#00E676',
  // Long Run: Electric Sky / Cyan
  'Long Run': '#00B4D8',
  'Long': '#00B4D8',
  // Recovery: Neon Turquoise / Mint
  'Recovery': '#00F5D4',
  'Recovery Run': '#00F5D4',
  // Strength: Neon Violet / Purple
  'Strength': '#B388FF',
  'Strength A': '#B388FF',
  'Strength B': '#9D4EDD',
  // Rest: Cool Slate Gray
  'Rest': '#64748B',
  'rest': '#64748B',
  // Extra categories
  'Mobility': '#FF66B2',
  'Race': '#FFD600',
};

/** Calculate readable contrast text color (black or white) based on background hex color */
export function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#000000';
  let hex = hexColor.replace('#', '');
  if (hex.length === 8) {
    hex = hex.substring(0, 6);
  }
  if (hex.length !== 6) return '#000000';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // YIQ formula: contrast threshold ~135 ensures bright neons (like #00E676, #00F5D4, #FF8800) get crisp black text
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#000000' : '#FFFFFF';
}

export function getSessionColor(type: string, theme: 'light' | 'dark' = 'light'): string {
  if (!type) return theme === 'dark' ? '#6B7280' : '#9CA3AF';
  const map = theme === 'dark' ? SESSION_COLORS_DARK : SESSION_COLORS;

  // 1. Try exact match first
  if (map[type]) return map[type];

  // 2. Try normalized category
  const normalized = normalizeSessionType(type);
  if (map[normalized]) return map[normalized];

  // 3. Case-insensitive fallback
  const targetLower = type.trim().toLowerCase();
  const matchedKey = Object.keys(map).find(key => key.toLowerCase() === targetLower);
  if (matchedKey) return map[matchedKey];

  return theme === 'dark' ? '#6B7280' : '#9CA3AF';
}

export const SESSION_TYPES = [
  'Easy Run', 'Recovery Run', 'Long Run',
  'Tempo', 'Intervals', 'Strength', 'Strength A', 'Strength B',
  'Rest', 'Mobility', 'Race', 'Other'
];

