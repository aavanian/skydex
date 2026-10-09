import type { Activity } from "./activities";
import { APPVIEW } from "./repo";

const BATCH_SIZE = 25;

interface QuoteEmbed {
  $type?: string;
  record?: { uri?: string; record?: { uri?: string } };
}

const POST_COLLECTION = "app.bsky.feed.post";

/**
 * URI of the post a post record quotes, if any. Record embeds can also
 * point at starter packs, lists or feeds, which are not posts and are
 * left out.
 */
export function quotedUri(record: object): string | undefined {
  const embed = (record as { embed?: QuoteEmbed }).embed;
  const uri =
    embed?.$type === "app.bsky.embed.recordWithMedia"
      ? embed.record?.record?.uri
      : embed?.$type === "app.bsky.embed.record"
        ? embed.record?.uri
        : undefined;
  return uri?.split("/")[3] === POST_COLLECTION ? uri : undefined;
}

/** URI of the post a repost or quote points to. */
export function sharedUri(activity: Activity): string | undefined {
  if (activity.type === "repost") {
    return (activity.record as { subject?: { uri?: string } }).subject?.uri;
  }
  if (activity.type === "quote") return quotedUri(activity.record);
  return undefined;
}

/**
 * URIs of posts the account reposted or quoted since `since`, newest
 * first, each once, at most `max`.
 */
export function sharedUris(
  activities: Activity[],
  since: Date,
  max: number,
): string[] {
  const uris = new Set<string>();
  for (let i = activities.length - 1; i >= 0 && uris.size < max; i--) {
    const activity = activities[i];
    if (!activity || activity.createdAt < since) break;
    const uri = sharedUri(activity);
    if (uri) uris.add(uri);
  }
  return [...uris];
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    result.push(items.slice(i, i + BATCH_SIZE));
  }
  return result;
}

/**
 * Runs an XRPC query on values 25 at a time. With `skipFailedBatches`,
 * a batch the server fails on contributes nothing instead of failing
 * the whole query.
 */
async function batchedQuery<T>(
  method: string,
  param: string,
  values: string[],
  fetchFn: typeof fetch,
  skipFailedBatches = false,
): Promise<T[]> {
  const pages = await Promise.all(
    chunks(values).map(async (chunk) => {
      const url = new URL(`${APPVIEW}/xrpc/${method}`);
      for (const value of chunk) url.searchParams.append(param, value);
      const response = await fetchFn(url.toString());
      if (!response.ok) {
        if (skipFailedBatches) return {};
        throw new Error(`${response.status} from ${method}`);
      }
      return (await response.json()) as Record<string, T[]>;
    }),
  );
  return pages.flatMap((page) => Object.values(page).flat());
}

/**
 * Fetches post records by URI. Deleted posts, and posts in a batch the
 * AppView fails on, are absent from the result.
 */
export async function fetchPosts(
  uris: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, object>> {
  const posts = await batchedQuery<{ uri: string; record: object }>(
    "app.bsky.feed.getPosts",
    "uris",
    uris,
    fetchFn,
    true,
  );
  return new Map(posts.map((p) => [p.uri, p.record]));
}

export interface Profile {
  did: string;
  handle: string;
  displayName?: string;
}

/**
 * Profiles of the given DIDs. Deactivated, suspended and deleted
 * accounts are absent from the result.
 */
export async function fetchProfiles(
  dids: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, Profile>> {
  const profiles = await batchedQuery<Profile>(
    "app.bsky.actor.getProfiles",
    "actors",
    dids,
    fetchFn,
  );
  return new Map(profiles.map((p) => [p.did, p]));
}

/**
 * Looks up the current handle of each DID. DIDs of unavailable accounts,
 * and DIDs in a batch the AppView fails on, are absent from the result.
 */
export async function fetchHandles(
  dids: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const profiles = await batchedQuery<Profile>(
    "app.bsky.actor.getProfiles",
    "actors",
    dids,
    fetchFn,
    true,
  );
  return new Map(profiles.map((p) => [p.did, p.handle]));
}
