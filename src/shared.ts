import type { Activity } from "./activities";
import { APPVIEW } from "./repo";

const BATCH_SIZE = 25;

interface QuoteEmbed {
  $type?: string;
  record?: { uri?: string; record?: { uri?: string } };
}

/** URI of the post a repost or quote points to. */
export function sharedUri(activity: Activity): string | undefined {
  if (activity.type === "repost") {
    return (activity.record as { subject?: { uri?: string } }).subject?.uri;
  }
  if (activity.type === "quote") {
    const embed = (activity.record as { embed?: QuoteEmbed }).embed;
    return embed?.$type === "app.bsky.embed.recordWithMedia"
      ? embed.record?.record?.uri
      : embed?.record?.uri;
  }
  return undefined;
}

/**
 * URIs of posts the account reposted or quoted since `since`, newest
 * first, at most `max`.
 */
export function sharedUris(
  activities: Activity[],
  since: Date,
  max: number,
): string[] {
  const uris: string[] = [];
  for (let i = activities.length - 1; i >= 0 && uris.length < max; i--) {
    const activity = activities[i];
    if (!activity || activity.createdAt < since) break;
    const uri = sharedUri(activity);
    if (uri) uris.push(uri);
  }
  return uris;
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    result.push(items.slice(i, i + BATCH_SIZE));
  }
  return result;
}

async function batchedQuery<T>(
  method: string,
  param: string,
  values: string[],
  fetchFn: typeof fetch,
): Promise<T[]> {
  const pages = await Promise.all(
    chunks(values).map(async (chunk) => {
      const url = new URL(`${APPVIEW}/xrpc/${method}`);
      for (const value of chunk) url.searchParams.append(param, value);
      const response = await fetchFn(url.toString());
      if (!response.ok) throw new Error(`${response.status} from ${method}`);
      return (await response.json()) as Record<string, T[]>;
    }),
  );
  return pages.flatMap((page) => Object.values(page).flat());
}

/** Fetches post records by URI. Deleted posts are absent from the result. */
export async function fetchPosts(
  uris: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, object>> {
  const posts = await batchedQuery<{ uri: string; record: object }>(
    "app.bsky.feed.getPosts",
    "uris",
    uris,
    fetchFn,
  );
  return new Map(posts.map((p) => [p.uri, p.record]));
}

/** Looks up the current handle of each DID. */
export async function fetchHandles(
  dids: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const profiles = await batchedQuery<{ did: string; handle: string }>(
    "app.bsky.actor.getProfiles",
    "actors",
    dids,
    fetchFn,
  );
  return new Map(profiles.map((p) => [p.did, p.handle]));
}
