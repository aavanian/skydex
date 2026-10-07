import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { cachedRecentActivity, cachedRepo } from "../src/cached";
import type { Account } from "../src/repo";
import { Store } from "../src/store";

let n = 0;
const fresh = () => Store.open(`cached-test-${n++}`);
const account: Account = {
  did: "did:plc:a",
  handle: "a.test",
  pds: "https://pds.example",
};

function pds(rev: string | undefined, car: number[]) {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname.endsWith("getLatestCommit")) {
      return rev
        ? Response.json({ cid: "c", rev })
        : new Response("down", { status: 503 });
    }
    return new Response(new Uint8Array(car));
  };
  return { calls, fetchFn };
}

describe("cachedRepo", () => {
  test("downloads and remembers a repository the first time", async () => {
    const store = await fresh();
    const { calls, fetchFn } = pds("r1", [1, 2]);

    const result = await cachedRepo(account, store, fetchFn, 100);

    expect([...result.car]).toEqual([1, 2]);
    expect(result.fromCache).toBe(false);
    expect(calls).toContain("/xrpc/com.atproto.sync.getRepo");
    expect((await store.getRepo("did:plc:a"))?.rev).toBe("r1");
  });

  test("reuses the cached repository while its revision is current", async () => {
    const store = await fresh();
    await cachedRepo(account, store, pds("r1", [1, 2]).fetchFn, 100);
    const { calls, fetchFn } = pds("r1", [9]);

    const result = await cachedRepo(account, store, fetchFn, 200);

    expect([...result.car]).toEqual([1, 2]);
    expect(result.fromCache).toBe(true);
    expect(result.savedAt).toBe(100);
    expect(calls).toEqual(["/xrpc/com.atproto.sync.getLatestCommit"]);
  });

  test("downloads again when the account has new commits", async () => {
    const store = await fresh();
    await cachedRepo(account, store, pds("r1", [1, 2]).fetchFn, 100);

    const result = await cachedRepo(
      account,
      store,
      pds("r2", [3]).fetchFn,
      200,
    );

    expect([...result.car]).toEqual([3]);
    expect(result.fromCache).toBe(false);
  });

  test("falls back to the cache when the revision cannot be checked", async () => {
    const store = await fresh();
    await cachedRepo(account, store, pds("r1", [1, 2]).fetchFn, 100);

    const result = await cachedRepo(
      account,
      store,
      pds(undefined, [9]).fetchFn,
      200,
    );

    expect([...result.car]).toEqual([1, 2]);
    expect(result.fromCache).toBe(true);
  });

  test("works without a store, e.g. when the browser blocks storage", async () => {
    const result = await cachedRepo(
      account,
      undefined,
      pds("r1", [7]).fetchFn,
      1,
    );

    expect([...result.car]).toEqual([7]);
  });
});

describe("cachedRecentActivity", () => {
  const feedFetch = (createdAt: string) => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls++;
      return Response.json({
        feed: [
          {
            post: {
              uri: "at://did:plc:a/app.bsky.feed.post/1",
              author: { did: "did:plc:a" },
              record: { text: "hi", createdAt },
            },
          },
        ],
        cursor: "more",
      });
    };
    return { fetchFn, count: () => calls };
  };

  test("fetches and remembers type and time of recent activities", async () => {
    const store = await fresh();
    const { fetchFn } = feedFetch("2026-01-01T00:00:00Z");

    const result = await cachedRecentActivity(
      "did:plc:a",
      store,
      1000,
      50,
      fetchFn,
    );

    expect(result.fromCache).toBe(false);
    expect(result.recent.complete).toBe(false);
    expect(result.recent.activities.map((a) => [a.type, a.createdAt])).toEqual([
      ["organic", new Date("2026-01-01T00:00:00Z")],
    ]);
    expect(await store.getRecent("did:plc:a")).toEqual({
      did: "did:plc:a",
      savedAt: 50,
      complete: false,
      items: [{ type: "organic", at: Date.parse("2026-01-01T00:00:00Z") }],
    });
  });

  test("reuses remembered activity younger than the maximum age", async () => {
    const store = await fresh();
    await cachedRecentActivity(
      "did:plc:a",
      store,
      1000,
      50,
      feedFetch("2026-01-01T00:00:00Z").fetchFn,
    );
    const later = feedFetch("2026-02-01T00:00:00Z");

    const result = await cachedRecentActivity(
      "did:plc:a",
      store,
      1000,
      900,
      later.fetchFn,
    );

    expect(later.count()).toBe(0);
    expect(result.fromCache).toBe(true);
    expect(result.savedAt).toBe(50);
    expect(result.recent.activities[0]?.createdAt).toEqual(
      new Date("2026-01-01T00:00:00Z"),
    );
  });

  test("refetches once the remembered activity is too old", async () => {
    const store = await fresh();
    await cachedRecentActivity(
      "did:plc:a",
      store,
      1000,
      50,
      feedFetch("2026-01-01T00:00:00Z").fetchFn,
    );
    const later = feedFetch("2026-02-01T00:00:00Z");

    const result = await cachedRecentActivity(
      "did:plc:a",
      store,
      1000,
      2000,
      later.fetchFn,
    );

    expect(later.count()).toBe(1);
    expect(result.recent.activities[0]?.createdAt).toEqual(
      new Date("2026-02-01T00:00:00Z"),
    );
  });
});
