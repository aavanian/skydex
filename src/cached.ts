import type { Activity } from "./activities";
import { fetchRecentActivity, type RecentActivity } from "./follows";
import { downloadRepo, type Account } from "./repo";
import type { Store } from "./store";

/** Store operations never break an analysis: on failure, nothing is cached. */
async function quietly<T>(op: () => Promise<T>): Promise<T | undefined> {
  try {
    return await op();
  } catch {
    return undefined;
  }
}

async function latestRev(
  account: Account,
  fetchFn: typeof fetch,
): Promise<string | undefined> {
  try {
    const response = await fetchFn(
      `${account.pds}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(account.did)}`,
    );
    if (!response.ok) return undefined;
    return ((await response.json()) as { rev?: string }).rev;
  } catch {
    return undefined;
  }
}

/**
 * The account's repository, from the cache when its revision is still
 * current (one small request instead of a full download), or when the
 * revision cannot be checked.
 */
export async function cachedRepo(
  account: Account,
  store: Store | undefined,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ car: Uint8Array; fromCache: boolean; savedAt: number }> {
  const [cached, rev] = await Promise.all([
    store ? quietly(() => store.getRepo(account.did)) : undefined,
    latestRev(account, fetchFn),
  ]);
  if (cached && (rev === undefined || cached.rev === rev)) {
    return { car: cached.car, fromCache: true, savedAt: cached.savedAt };
  }
  const car = await downloadRepo(account, fetchFn);
  if (store && rev) {
    await quietly(() =>
      store.putRepo({ did: account.did, rev, savedAt: now, car }),
    );
  }
  return { car, fromCache: false, savedAt: now };
}

/**
 * An account's recent activity for the follows scan, from the cache
 * when younger than `maxAgeMs`. Only each activity's type and time are
 * kept, which is all the scan uses.
 */
export async function cachedRecentActivity(
  did: string,
  store: Store | undefined,
  maxAgeMs: number,
  now = Date.now(),
  fetchFn: typeof fetch = fetch,
): Promise<{ recent: RecentActivity; fromCache: boolean; savedAt: number }> {
  const cached = store ? await quietly(() => store.getRecent(did)) : undefined;
  if (cached && now - cached.savedAt < maxAgeMs) {
    return {
      recent: {
        complete: cached.complete,
        activities: cached.items.map(({ type, at }): Activity => ({
          uri: "",
          type,
          createdAt: new Date(at),
          record: {},
        })),
      },
      fromCache: true,
      savedAt: cached.savedAt,
    };
  }
  const recent = await fetchRecentActivity(did, fetchFn);
  if (store) {
    await quietly(() =>
      store.putRecent({
        did,
        savedAt: now,
        complete: recent.complete,
        items: recent.activities.map((a) => ({
          type: a.type,
          at: a.createdAt.getTime(),
        })),
      }),
    );
  }
  return { recent, fromCache: false, savedAt: now };
}
