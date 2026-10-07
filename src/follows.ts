import type { Activity } from "./activities";
import { APPVIEW } from "./repo";
import { DAY_MS, RECENT_DAYS, summarize, type Summary } from "./stats";
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

function toFollow({ did, handle, displayName }: Follow): Follow {
  return displayName ? { did, handle, displayName } : { did, handle };
}

/** An account (`subject`) and everyone it follows. */
export async function fetchFollows(
  actor: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ subject: Follow; follows: Follow[] }> {
  const follows: Follow[] = [];
  let subject: Follow | undefined;
  let cursor: string | undefined;
  do {
    const page = await getJson<{
      subject: Follow;
      follows: Follow[];
      cursor?: string;
    }>(
      fetchFn,
      xrpc("app.bsky.graph.getFollows", {
        actor,
        limit: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      }),
    );
    subject ??= toFollow(page.subject);
    follows.push(...page.follows.map(toFollow));
    cursor = page.cursor;
  } while (cursor);
  return { subject: subject ?? { did: actor, handle: actor }, follows };
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
    .filter((a) => a.type === "organic" || a.type === "quote")
    .at(-1)?.createdAt;
  return {
    ...summarize(recent.activities, now),
    lastOwnPost,
    daysSinceOwnPost: lastOwnPost
      ? Math.floor((now.getTime() - lastOwnPost.getTime()) / DAY_MS)
      : undefined,
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
