import type { Activity } from "./activities";
import { APPVIEW } from "./repo";
import { RECENT_DAYS, summarize, type Summary } from "./stats";
import { activityType } from "./taxonomy";

export interface Follow {
  did: string;
  handle: string;
  displayName?: string;
}

interface FeedItem {
  post: { uri: string; author: { did: string }; record: object };
  reason?: { $type?: string; uri?: string; indexedAt?: string };
}

const PAGE_SIZE = 100;

async function getJson<T>(fetchFn: typeof fetch, url: URL): Promise<T> {
  const response = await fetchFn(url.toString());
  if (!response.ok) throw new Error(`${response.status} from ${url.pathname}`);
  return (await response.json()) as T;
}

function xrpc(method: string, params: Record<string, string>): URL {
  const url = new URL(`${APPVIEW}/xrpc/${method}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return url;
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

/** Everyone an account follows. */
export async function fetchFollows(
  actor: string,
  fetchFn: typeof fetch = fetch,
): Promise<Follow[]> {
  const follows: Follow[] = [];
  let cursor: string | undefined;
  do {
    const page = await getJson<{ follows: Follow[]; cursor?: string }>(
      fetchFn,
      xrpc("app.bsky.graph.getFollows", {
        actor,
        limit: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      }),
    );
    for (const { did, handle, displayName } of page.follows) {
      follows.push(
        displayName ? { did, handle, displayName } : { did, handle },
      );
    }
    cursor = page.cursor;
  } while (cursor);
  return follows;
}

export interface RecentActivity {
  activities: Activity[];
  /** True when these are all of the account's activities. */
  complete: boolean;
}

/** An account's latest posts, replies and reposts, one page deep. */
export async function fetchRecentActivity(
  did: string,
  fetchFn: typeof fetch = fetch,
): Promise<RecentActivity> {
  const page = await getJson<{ feed: FeedItem[]; cursor?: string }>(
    fetchFn,
    xrpc("app.bsky.feed.getAuthorFeed", {
      actor: did,
      limit: String(PAGE_SIZE),
      filter: "posts_with_replies",
    }),
  );
  return {
    activities: activitiesFromFeed(did, page.feed),
    complete: !page.cursor,
  };
}

export interface FollowSummary extends Summary {
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
  const recentSince = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return {
    ...summarize(recent.activities, now),
    recentRateIsMinimum:
      !recent.complete &&
      oldest !== undefined &&
      oldest.getTime() >= recentSince,
  };
}
