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

export interface FeedItem {
  post: { uri: string; author: { did: string }; record: object };
  reason?: { $type?: string; uri?: string; indexedAt?: string };
}

/**
 * Turns author feed items into activities, oldest first. Reposts are
 * dated when the AppView saw them, since the feed does not carry the
 * repost record's own date. Pinned posts are skipped: they repeat an
 * older post at the top of the feed.
 */
export function activitiesFromFeed(did: string, feed: FeedItem[]): Activity[] {
  const activities: Activity[] = [];
  for (const { post, reason } of feed) {
    if (reason?.$type === "app.bsky.feed.defs#reasonRepost") {
      if (!reason.uri || !reason.indexedAt) continue;
      activities.push({
        uri: reason.uri,
        type: "repost",
        createdAt: new Date(reason.indexedAt),
        record: { subject: { uri: post.uri } },
      });
      continue;
    }
    if (reason || post.author.did !== did) continue;
    const createdAt = new Date(
      (post.record as { createdAt?: string }).createdAt ?? "",
    );
    if (Number.isNaN(createdAt.getTime())) continue;
    activities.push({
      uri: post.uri,
      type: activityType(did, "app.bsky.feed.post", post.record),
      createdAt,
      record: post.record,
    });
  }
  return activities.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export interface RecentActivity {
  activities: Activity[];
  /** True when these are all of the account's activities. */
  complete: boolean;
}
