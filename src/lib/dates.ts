import { format, parseISO, startOfWeek, endOfWeek, subWeeks, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const TIMEZONE = "Asia/Bangkok";

export function nowInBangkok(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function formatDate(dateStr: string, fmt = "d MMM yyyy"): string {
  const d = toZonedTime(parseISO(dateStr), TIMEZONE);
  return format(d, fmt);
}

export function formatDateShort(dateStr: string): string {
  return formatDate(dateStr, "EEE, d MMM");
}

export function todayBangkokISO(): string {
  return format(nowInBangkok(), "yyyy-MM-dd");
}

export function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = toZonedTime(parseISO(birthDate), TIMEZONE);
  const today = nowInBangkok();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getWeekRange(referenceDate: Date = nowInBangkok()): { start: Date; end: Date } {
  const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return { start, end };
}

export function getLastWeekRange(): { start: Date; end: Date } {
  const lastWeek = subWeeks(nowInBangkok(), 1);
  return getWeekRange(lastWeek);
}

export function isDateInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = toZonedTime(parseISO(dateStr), TIMEZONE);
  return isWithinInterval(d, { start, end });
}

export function filterByDateRange<T extends { date: string }>(
  items: T[],
  range: "week" | "month" | "90days" | "all"
): T[] {
  if (range === "all") return items;
  const now = nowInBangkok();
  let start: Date;

  switch (range) {
    case "week":
      start = getWeekRange(now).start;
      break;
    case "month":
      start = startOfMonth(now);
      break;
    case "90days":
      start = subDays(now, 90);
      break;
  }

  return items.filter((item) => {
    const d = toZonedTime(parseISO(item.date), TIMEZONE);
    return d >= start && d <= now;
  });
}

export function filterByDaysBack<T extends { date: string }>(
  items: T[],
  days: number
): T[] {
  const now = nowInBangkok();
  const start = subDays(now, days);
  return items.filter((item) => {
    const d = toZonedTime(parseISO(item.date), TIMEZONE);
    return d >= start && d <= now;
  });
}

export function getWeekKey(dateStr: string): string {
  const d = toZonedTime(parseISO(dateStr), TIMEZONE);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  return format(weekStart, "yyyy-MM-dd");
}

export function getMonthKey(dateStr: string): string {
  const d = toZonedTime(parseISO(dateStr), TIMEZONE);
  return format(d, "yyyy-MM");
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(d, "MMM yyyy");
}

export function formatWeekLabel(weekKey: string): string {
  const d = parseISO(weekKey);
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return `${format(d, "d MMM")} – ${format(end, "d MMM")}`;
}

export function bangkokDateToISO(date: Date): string {
  return format(toZonedTime(date, TIMEZONE), "yyyy-MM-dd");
}

export function parseBangkokDate(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
}

export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = nowInBangkok();
  for (let i = n - 1; i >= 0; i--) {
    months.push(format(subMonths(now, i), "yyyy-MM"));
  }
  return months;
}

export function getLastNWeeks(n: number): string[] {
  const weeks: string[] = [];
  const now = nowInBangkok();
  for (let i = n - 1; i >= 0; i--) {
    const d = subWeeks(now, i);
    weeks.push(format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  }
  return weeks;
}
