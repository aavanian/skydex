import { fromUint8Array } from "@atcute/repo";
import { activityType, type ActivityType } from "./taxonomy";

/** A record as read from a repository, before interpretation. */
export interface RepoRecord {
  collection: string;
  rkey: string;
  record: unknown;
}

/** One post or repost made by the account. */
export interface Activity {
  uri: string;
  type: ActivityType;
  createdAt: Date;
  record: object;
}

const ACTIVITY_COLLECTIONS = new Set([
  "app.bsky.feed.post",
  "app.bsky.feed.repost",
]);

/**
 * Extracts the account's posts and reposts, oldest first. Records
 * without a usable createdAt cannot be placed on a timeline and are
 * dropped.
 */
export function activitiesFrom(
  did: string,
  entries: Iterable<RepoRecord>,
): Activity[] {
  const activities: Activity[] = [];
  for (const { collection, rkey, record } of entries) {
    if (!ACTIVITY_COLLECTIONS.has(collection)) continue;
    if (typeof record !== "object" || record === null) continue;
    const createdAt = new Date(
      (record as { createdAt?: unknown }).createdAt as string,
    );
    if (Number.isNaN(createdAt.getTime())) continue;
    activities.push({
      uri: `at://${did}/${collection}/${rkey}`,
      type: activityType(did, collection, record),
      createdAt,
      record,
    });
  }
  return activities.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/** Extracts activities from a repository CAR export. */
export function activitiesFromCar(did: string, car: Uint8Array): Activity[] {
  return activitiesFrom(did, fromUint8Array(car));
}
