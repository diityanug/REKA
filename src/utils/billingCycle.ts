export interface BillingCycleConfig {
  /**
   * 1 = Standard calendar month (1st to end of month).
   * 2..28 = Custom payday cycle start day (e.g. 24).
   */
  startDay: number;
  /**
   * When startDay > 1 and the payday falls on Saturday or Sunday,
   * shift the payday backward to Friday (Sat -> -1 day, Sun -> -2 days).
   */
  adjustWeekendToFriday: boolean;
}

export const DEFAULT_BILLING_CYCLE: BillingCycleConfig = {
  startDay: 1,
  adjustWeekendToFriday: true,
};

export interface BillingCycleRange {
  periodKey: string;
  start: Date;
  end: Date;
  startDateStr: string;
  endDateStr: string;
  totalDays: number;
}

const SHORT_MONTHS = [
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
];

export function normalizeBillingCycleConfig(
  raw?: Partial<BillingCycleConfig> | null
): BillingCycleConfig {
  const rawDay = Number(raw?.startDay);
  const startDay =
    Number.isFinite(rawDay) && rawDay >= 1 && rawDay <= 28
      ? Math.floor(rawDay)
      : 1;
  return {
    startDay,
    adjustWeekendToFriday:
      raw?.adjustWeekendToFriday !== undefined
        ? Boolean(raw.adjustWeekendToFriday)
        : true,
  };
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const parts = (monthKey || '').split('-');
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function shiftPeriodKey(periodKey: string, deltaMonths: number): string {
  const parsed = parseMonthKey(periodKey);
  if (!parsed) return periodKey;
  const d = new Date(parsed.year, parsed.month - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns the local midnight Date when payday occurs for a given calendar (year, month 1..12).
 * If adjustWeekendToFriday is enabled and startDay > 1:
 *   Saturday (6) -> Friday (-1 day)
 *   Sunday (0)   -> Friday (-2 days)
 */
export function getEffectivePaydayDate(
  year: number,
  month1Based: number,
  config: BillingCycleConfig
): Date {
  const daysInMonth = new Date(year, month1Based, 0).getDate();
  const clampedDay = Math.min(Math.max(1, Math.floor(config.startDay)), daysInMonth);
  const d = new Date(year, month1Based - 1, clampedDay, 0, 0, 0, 0);

  if (config.startDay > 1 && config.adjustWeekendToFriday) {
    const dow = d.getDay();
    if (dow === 6) {
      d.setDate(d.getDate() - 1);
    } else if (dow === 0) {
      d.setDate(d.getDate() - 2);
    }
  }
  return d;
}

/**
 * Computes the exact [start, end] date range for a given periodKey ("YYYY-MM").
 *
 * Conventions:
 * - startDay === 1: Standard calendar month (1st .. last day of month).
 * - startDay >= 16 (late-month payday e.g. 24, 25, 28):
 *     Period "2026-11" starts on Oct's effective payday and ends the day before Nov's effective payday.
 *     Example (startDay = 24, weekend->Fri): Oct 24 2026 is Sat -> starts Fri Oct 23, ends Mon Nov 23.
 * - 2 <= startDay <= 15 (early-month payday e.g. 5):
 *     Period "2026-11" starts on Nov's effective payday and ends the day before Dec's effective payday.
 */
export function getBillingCycleRange(
  periodKey: string,
  rawConfig?: BillingCycleConfig
): BillingCycleRange {
  const config = normalizeBillingCycleConfig(rawConfig);
  const parsed = parseMonthKey(periodKey);
  const now = new Date();
  const year = parsed ? parsed.year : now.getFullYear();
  const month = parsed ? parsed.month : now.getMonth() + 1;
  const resolvedKey = `${year}-${String(month).padStart(2, '0')}`;

  let start: Date;
  let nextStart: Date;

  if (config.startDay <= 1) {
    start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    nextStart = new Date(year, month, 1, 0, 0, 0, 0);
  } else if (config.startDay >= 16) {
    const prevDate = new Date(year, month - 2, 1);
    start = getEffectivePaydayDate(prevDate.getFullYear(), prevDate.getMonth() + 1, config);
    nextStart = getEffectivePaydayDate(year, month, config);
  } else {
    const nextDate = new Date(year, month, 1);
    start = getEffectivePaydayDate(year, month, config);
    nextStart = getEffectivePaydayDate(nextDate.getFullYear(), nextDate.getMonth() + 1, config);
  }

  const end = new Date(nextStart.getTime() - 1);
  const totalDays = Math.max(
    1,
    Math.round((nextStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    periodKey: resolvedKey,
    start,
    end,
    startDateStr: toLocalDateStr(start),
    endDateStr: toLocalDateStr(end),
    totalDays,
  };
}

/**
 * Resolves which periodKey ("YYYY-MM") owns a given Date under the active BillingCycleConfig.
 */
export function getPeriodKeyForDate(
  date: Date,
  rawConfig?: BillingCycleConfig
): string {
  const config = normalizeBillingCycleConfig(rawConfig);
  const calKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (config.startDay <= 1) return calKey;

  const ts = date.getTime();
  const candidates = [calKey, shiftPeriodKey(calKey, 1), shiftPeriodKey(calKey, -1)];
  for (const key of candidates) {
    const range = getBillingCycleRange(key, config);
    if (ts >= range.start.getTime() && ts <= range.end.getTime()) {
      return key;
    }
  }
  return calKey;
}

export function getPeriodKeyForTimestamp(
  timestamp: string,
  rawConfig?: BillingCycleConfig
): string | null {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;
  return getPeriodKeyForDate(d, rawConfig);
}

export function getCurrentPeriodKey(
  rawConfig?: BillingCycleConfig,
  now: Date = new Date()
): string {
  return getPeriodKeyForDate(now, rawConfig);
}

export function isTimestampInPeriod(
  timestamp: string,
  periodKey: string,
  rawConfig?: BillingCycleConfig
): boolean {
  if (periodKey === 'all') return true;
  const resolved = getPeriodKeyForTimestamp(timestamp, rawConfig);
  return resolved === periodKey;
}

/**
 * Returns a concise human-readable range badge (e.g. "23 Oct – 23 Nov") when using a custom payday cycle,
 * or an empty string when using standard calendar months (startDay === 1).
 */
export function formatCycleRangeShort(
  periodKey: string,
  rawConfig?: BillingCycleConfig
): string {
  const config = normalizeBillingCycleConfig(rawConfig);
  if (config.startDay <= 1 || periodKey === 'all') return '';
  const range = getBillingCycleRange(periodKey, config);
  const sDay = range.start.getDate();
  const sMonth = SHORT_MONTHS[range.start.getMonth()];
  const eDay = range.end.getDate();
  const eMonth = SHORT_MONTHS[range.end.getMonth()];
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

const FULL_MONTHS = [
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
];

export function formatPeriodLabelWithCycle(
  periodKey: string,
  rawConfig?: BillingCycleConfig
): string {
  if (periodKey === 'all') return 'All Time';
  const parsed = parseMonthKey(periodKey);
  const base = parsed ? `${FULL_MONTHS[parsed.month - 1]} ${parsed.year}` : periodKey;
  const shortRange = formatCycleRangeShort(periodKey, rawConfig);
  return shortRange ? `${base} (${shortRange})` : base;
}

/**
 * Returns the remaining days (including today, minimum 1) in a billing cycle for safe daily spend pacing.
 */
export function getRemainingDaysInPeriod(
  periodKey: string,
  rawConfig?: BillingCycleConfig,
  now: Date = new Date()
): number {
  const range = getBillingCycleRange(periodKey, rawConfig);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endMidnight = new Date(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate(),
    0,
    0,
    0,
    0
  );
  const diffDays = Math.round(
    (endMidnight.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.max(1, diffDays + 1);
}
