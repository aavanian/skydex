import { runPool } from "./pool";
import { xrpcUrl } from "./xrpc";

/** Bluesky's public AppView, which serves posts and profiles without login. */
export const APPVIEW = "https://public.api.bsky.app";

const BATCH_SIZE = 25;
/** Batches in flight at once, to stay clear of AppView rate limits. */
const BATCH_CONCURRENCY = 6;

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    result.push(items.slice(i, i + BATCH_SIZE));
  }
  return result;
}

/**
 * Runs an XRPC query on values 25 at a time, a few batches at once. With
 * `skipFailedBatches`, a batch the server fails on contributes nothing
 * instead of failing the whole query.
 */
async function batchedQuery<T>(
  method: string,
  param: string,
  values: string[],
  fetchFn: typeof fetch,
  skipFailedBatches = false,
): Promise<T[]> {
  const pages: Record<string, T[]>[] = [];
  const batches = chunks(values).map((chunk, index) => ({ chunk, index }));
  await runPool(batches, BATCH_CONCURRENCY, async ({ chunk, index }) => {
    const response = await fetchFn(
      xrpcUrl(APPVIEW, method, { [param]: chunk }),
    );
    if (!response.ok) {
      if (skipFailedBatches) return;
      throw new Error(`${response.status} from ${method}`);
    }
    pages[index] = (await response.json()) as Record<string, T[]>;
  });
  return pages.flatMap((page) => Object.values(page ?? {}).flat());
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
 * accounts, and accounts in a batch the AppView fails on, are absent
 * from the result.
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
    true,
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
  const profiles = await fetchProfiles(dids, fetchFn);
  return new Map([...profiles].map(([did, p]) => [did, p.handle]));
}
