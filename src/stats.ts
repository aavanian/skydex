import type { Activity } from "./activities";
import { ACTIVITY_TYPES, type ActivityType } from "./taxonomy";

export type CountsByType = Record<ActivityType, number>;

export interface Summary {
  total: number;
  counts: CountsByType;
  shares: CountsByType;
  first?: Date;
  last?: Date;
  lastOrganic?: Date;
  daysSinceLast?: number;
  perWeek: number;
  /** Activities per week over the last {@link RECENT_DAYS} days. */
  recentPerWeek: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_DAYS = 90;

function zeroCounts(): CountsByType {
  return { organic: 0, quote: 0, reply: 0, repost: 0 };
}

/** Overall statistics for activities sorted oldest first. */
export function summarize(activities: Activity[], now: Date): Summary {
  const counts = zeroCounts();
  let lastOrganic: Date | undefined;
  let recent = 0;
  const recentSince = now.getTime() - RECENT_DAYS * DAY_MS;
  for (const a of activities) {
    counts[a.type]++;
    if (a.createdAt.getTime() >= recentSince) recent++;
    if (a.type === "organic") lastOrganic = a.createdAt;
  }

  const total = activities.length;
  const shares = zeroCounts();
  for (const type of ACTIVITY_TYPES) {
    shares[type] = total ? counts[type] / total : 0;
  }

  const first = activities[0]?.createdAt;
  const last = activities.at(-1)?.createdAt;
  const weeks = first ? (now.getTime() - first.getTime()) / (7 * DAY_MS) : 0;

  return {
    total,
    counts,
    shares,
    first,
    last,
    lastOrganic,
    daysSinceLast: last
      ? Math.floor((now.getTime() - last.getTime()) / DAY_MS)
      : undefined,
    perWeek: weeks > 0 ? total / weeks : 0,
    recentPerWeek: recent / (RECENT_DAYS / 7),
  };
}

export interface MonthMix extends CountsByType {
  /** UTC calendar month, formatted YYYY-MM. */
  month: string;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Activity counts per type for every month from the first activity to
 * `until` (default: the last activity), including months without any.
 */
export function monthlyMix(activities: Activity[], until?: Date): MonthMix[] {
  const first = activities[0]?.createdAt;
  const last = until ?? activities.at(-1)?.createdAt;
  if (!first || !last) return [];

  const byMonth = new Map<string, MonthMix>();
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();
  const endKey = monthKey(last.getUTCFullYear(), last.getUTCMonth());
  for (;;) {
    const key = monthKey(year, month);
    byMonth.set(key, { month: key, ...zeroCounts() });
    if (key === endKey) break;
    month = (month + 1) % 12;
    if (month === 0) year++;
  }

  for (const a of activities) {
    const key = monthKey(
      a.createdAt.getUTCFullYear(),
      a.createdAt.getUTCMonth(),
    );
    const bucket = byMonth.get(key);
    if (bucket) bucket[a.type]++;
  }
  return [...byMonth.values()];
}
