import {
  activitiesFromFeed,
  type FeedItem,
  type RecentActivity,
} from "./activities";
import { runPool } from "./pool";
import { APPVIEW, fetchProfiles } from "./appview";
import { lastHandle, resolveAccount } from "./repo";
import { getJson, xrpcUrl } from "./xrpc";

export interface Follow {
  did: string;
  handle: string;
  displayName?: string;
  /** The follow record itself, when read from the follower's repo. */
  followUri?: string;
  /** For an unavailable account: the handle its DID document last declared. */
  lastHandle?: string;
  /** Why the account can no longer be seen, if it cannot. */
  unavailable?: "deactivated" | "suspended" | "deleted";
  /**
   * A block hides this follow: the account blocks you, you block it,
   * or a block list does (or a block too deep in their records to find,
   * or in records that could not be read).
   */
  block?: "blocks-you" | "you-block" | "hidden";
}

const PAGE_SIZE = 100;

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
      xrpcUrl(APPVIEW, "app.bsky.graph.getFollows", {
        actor,
        limit: String(PAGE_SIZE),
        cursor,
      }),
    );
    subject ??= toFollow(page.subject);
    follows.push(...page.follows.map(toFollow));
    cursor = page.cursor;
  } while (cursor);
  return { subject: subject ?? { did: actor, handle: actor }, follows };
}

/** An account's latest posts, replies and reposts, one page deep. */
export async function fetchRecentActivity(
  did: string,
  fetchFn: typeof fetch = fetch,
): Promise<RecentActivity> {
  const page = await getJson<{ feed: FeedItem[]; cursor?: string }>(
    fetchFn,
    xrpcUrl(APPVIEW, "app.bsky.feed.getAuthorFeed", {
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

/** Most block records read per account when looking for a block. */
const MAX_BLOCK_PAGES = 50;

/**
 * Bluesky's follow list may not yet list a follow this recent, so its
 * absence there says nothing about blocks.
 */
const NEW_FOLLOW_MS = 10 * 60 * 1000;

interface SubjectRecord {
  uri: string;
  subject: string;
  /** When the record says it was created, in milliseconds. */
  createdAt: number;
}

async function listSubjects(
  pds: string,
  repo: string,
  collection: string,
  fetchFn: typeof fetch,
  maxPages = Infinity,
): Promise<SubjectRecord[]> {
  const found: SubjectRecord[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const url = xrpcUrl(pds, "com.atproto.repo.listRecords", {
      repo,
      collection,
      limit: String(PAGE_SIZE),
      cursor,
    });
    const page = await getJson<{
      records: {
        uri: string;
        value: { subject?: string; createdAt?: string };
      }[];
      cursor?: string;
    }>(fetchFn, url);
    for (const r of page.records) {
      if (r.value.subject) {
        found.push({
          uri: r.uri,
          subject: r.value.subject,
          createdAt: Date.parse(r.value.createdAt ?? ""),
        });
      }
    }
    cursor = page.records.length ? page.cursor : undefined;
  } while (cursor && ++pages < maxPages);
  return found;
}

const UNAVAILABLE: Record<string, Follow["unavailable"]> = {
  AccountDeactivated: "deactivated",
  AccountTakedown: "suspended",
};

/**
 * Why an account missing from profile lists can no longer be seen, or
 * undefined if it can be, or if the AppView could not tell (rate limit,
 * server error, no connection).
 */
async function unavailableReason(
  did: string,
  fetchFn: typeof fetch,
): Promise<Follow["unavailable"]> {
  try {
    const response = await fetchFn(
      xrpcUrl(APPVIEW, "app.bsky.actor.getProfile", { actor: did }),
    );
    if (response.status !== 400) return undefined;
    const { error } = (await response.json()) as { error?: string };
    if (error === "InvalidRequest") return "deleted";
    return UNAVAILABLE[error ?? ""];
  } catch {
    return undefined;
  }
}

/**
 * Whether `did` blocks `you`, read from its own records. False when its
 * identity or data server cannot be reached.
 */
async function blocksYou(
  did: string,
  you: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  try {
    const { pds } = await resolveAccount(did, fetchFn);
    const blocked = await listSubjects(
      pds,
      did,
      "app.bsky.graph.block",
      fetchFn,
      MAX_BLOCK_PAGES,
    );
    return blocked.some((b) => b.subject === you);
  } catch {
    return false;
  }
}

/**
 * Every account `actor` follows, read from its own follow records so
 * that accounts the AppView leaves out of follow lists are included:
 * deactivated, suspended or deleted ones, and ones hidden by a block.
 */
export async function fetchFollowing(
  actor: string,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ subject: Follow; follows: Follow[] }> {
  const account = await resolveAccount(actor, fetchFn);
  const followRecords = new Map<string, SubjectRecord>();
  for (const record of await listSubjects(
    account.pds,
    account.did,
    "app.bsky.graph.follow",
    fetchFn,
  )) {
    if (!followRecords.has(record.subject)) {
      followRecords.set(record.subject, record);
    }
  }
  const subjects = [...followRecords.keys()];
  const [profiles, visible, ownBlocks] = await Promise.all([
    fetchProfiles([account.did, ...subjects], fetchFn),
    fetchFollows(account.did, fetchFn),
    listSubjects(account.pds, account.did, "app.bsky.graph.block", fetchFn),
  ]);
  const listed = new Set(visible.follows.map((f) => f.did));
  const blocked = new Set(ownBlocks.map((b) => b.subject));

  const follows: Follow[] = subjects.map((did) => {
    const profile = profiles.get(did);
    return {
      ...(profile ? toFollow(profile) : { did, handle: did }),
      followUri: followRecords.get(did)?.uri,
    };
  });
  await runPool(follows, 6, async (follow) => {
    if (!profiles.has(follow.did)) {
      follow.unavailable = await unavailableReason(follow.did, fetchFn);
      const handle = await lastHandle(follow.did, fetchFn);
      if (handle) follow.lastHandle = handle;
    } else if (!listed.has(follow.did)) {
      const isNew =
        now - (followRecords.get(follow.did)?.createdAt ?? 0) < NEW_FOLLOW_MS;
      if (blocked.has(follow.did)) follow.block = "you-block";
      else if (await blocksYou(follow.did, account.did, fetchFn)) {
        follow.block = "blocks-you";
      } else if (!isNew) follow.block = "hidden";
    }
  });

  const self = profiles.get(account.did);
  return {
    subject: self
      ? toFollow(self)
      : { did: account.did, handle: account.handle },
    follows,
  };
}
