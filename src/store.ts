import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ActivityType } from "./taxonomy";

/** An account's full repository as downloaded, with its revision. */
export interface CachedRepo {
  did: string;
  /** Repository revision at download time; a new commit changes it. */
  rev: string;
  savedAt: number;
  car: Uint8Array;
}

/** The type and time of an account's latest activities, for the follows scan. */
export interface CachedRecent {
  did: string;
  savedAt: number;
  complete: boolean;
  items: { type: ActivityType; at: number }[];
}

interface Schema extends DBSchema {
  repos: { key: string; value: CachedRepo; indexes: { savedAt: number } };
  recent: { key: string; value: CachedRecent };
}

/** Repositories can be large; only the most recently saved are kept. */
const MAX_REPOS = 20;

/**
 * Browser-side cache (IndexedDB) of data fetched from Bluesky, so that
 * revisiting an account or rescanning follows is fast. It only ever
 * holds public data.
 */
export class Store {
  private constructor(
    private readonly db: IDBPDatabase<Schema>,
    private readonly maxRepos: number,
  ) {}

  static async open(
    name = "skydex",
    { maxRepos = MAX_REPOS }: { maxRepos?: number } = {},
  ): Promise<Store> {
    const db = await openDB<Schema>(name, 1, {
      upgrade(db) {
        db.createObjectStore("repos", { keyPath: "did" }).createIndex(
          "savedAt",
          "savedAt",
        );
        db.createObjectStore("recent", { keyPath: "did" });
      },
    });
    return new Store(db, maxRepos);
  }

  getRepo(did: string): Promise<CachedRepo | undefined> {
    return this.db.get("repos", did);
  }

  async putRepo(repo: CachedRepo): Promise<void> {
    const tx = this.db.transaction("repos", "readwrite");
    await tx.store.put(repo);
    const excess = (await tx.store.count()) - this.maxRepos;
    if (excess > 0) {
      let cursor = await tx.store.index("savedAt").openCursor();
      for (let i = 0; i < excess && cursor; i++) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  }

  getRecent(did: string): Promise<CachedRecent | undefined> {
    return this.db.get("recent", did);
  }

  async putRecent(recent: CachedRecent): Promise<void> {
    await this.db.put("recent", recent);
  }

  async clear(): Promise<void> {
    await Promise.all([this.db.clear("repos"), this.db.clear("recent")]);
  }
}
