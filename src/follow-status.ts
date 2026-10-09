import type { RecentActivity } from "./activities";
import {
  DAY_MS,
  daysSince,
  RECENT_DAYS,
  summarize,
  type Summary,
} from "./stats";
import { isOwnPost } from "./taxonomy";

export interface FollowSummary extends Summary {
  /** Latest organic or quote post: something the account wrote itself. */
  lastOwnPost?: Date;
  daysSinceOwnPost?: number;
  /**
   * True when every fetched activity is recent and more exist, so the
   * real recent rate is higher than shown.
   */
  recentRateIsMinimum: boolean;
}

/** Statistics over an account's recent activity. */
export function followSummary(
  recent: RecentActivity,
  now: Date,
): FollowSummary {
  const oldest = recent.activities[0]?.createdAt;
  const recentSince = now.getTime() - RECENT_DAYS * DAY_MS;
  const lastOwnPost = recent.activities
    .filter((a) => isOwnPost(a.type))
    .at(-1)?.createdAt;
  return {
    ...summarize(recent.activities, now),
    lastOwnPost,
    daysSinceOwnPost: lastOwnPost ? daysSince(lastOwnPost, now) : undefined,
    recentRateIsMinimum:
      !recent.complete &&
      oldest !== undefined &&
      oldest.getTime() >= recentSince,
  };
}

export type FollowStatus = "never" | "dormant" | "no-own-posts" | "active";

/**
 * Dormant: nothing at all in the recent window. No own posts: only
 * reposts or replies in that window.
 */
export function followStatus(summary: FollowSummary): FollowStatus {
  if (summary.daysSinceLast === undefined) return "never";
  if (summary.daysSinceLast > RECENT_DAYS) return "dormant";
  return summary.daysSinceOwnPost !== undefined &&
    summary.daysSinceOwnPost <= RECENT_DAYS
    ? "active"
    : "no-own-posts";
}
