/**
 * All "today" logic uses the user's IANA timezone, never the server's.
 * Dates are passed around as YYYY-MM-DD strings ("ymd").
 */

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_TINY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const DEFAULT_TIMEZONE = 'Asia/Riyadh';

function safeTz(tz: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD of the given instant in the given timezone. */
export function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** HH:MM (24h) of the given instant in the given timezone. */
export function hmInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz(tz),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return parts;
}

/** Weekday (0=Sun..6=Sat) of a civil YYYY-MM-DD date. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayInTz(tz: string, now: Date = new Date()): { ymd: string; weekday: number } {
  const ymd = ymdInTz(now, tz);
  return { ymd, weekday: weekdayOfYmd(ymd) };
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Format a civil date for display, e.g. "Thursday 23 October".
 * Hand-rolled (en-GB style, no comma) rather than toLocaleDateString, so the
 * server and every browser produce byte-identical text — locale data differs
 * between ICU builds and that breaks React hydration.
 */
export function formatYmd(
  ymd: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = weekdayOfYmd(ymd);
  const parts: string[] = [];
  if (options.weekday) {
    parts.push(options.weekday === 'short' ? DAY_SHORT[weekday] : DAY_NAMES[weekday]);
  }
  if (options.day) parts.push(String(d));
  if (options.month) {
    parts.push(options.month === 'short' ? MONTH_SHORT[m - 1] : MONTH_NAMES[m - 1]);
  }
  if (options.year) parts.push(String(y));
  return parts.join(' ');
}

/** The ymd of the given weekday within the week containing `ymd` (weeks start Sunday). */
export function ymdOfWeekday(ymd: string, weekday: number): string {
  return addDaysYmd(ymd, weekday - weekdayOfYmd(ymd));
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
