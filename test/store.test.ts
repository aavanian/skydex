import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { Store } from "../src/store";

let n = 0;
const fresh = (maxRepos?: number) => Store.open(`test-${n++}`, { maxRepos });

describe("Store", () => {
  test("keeps a downloaded repository with its revision", async () => {
    const store = await fresh();
    await store.putRepo({
      did: "did:plc:a",
      rev: "3abc",
      savedAt: 1000,
      car: new Uint8Array([1, 2, 3]),
    });

    const repo = await store.getRepo("did:plc:a");

    expect(repo?.rev).toBe("3abc");
    expect([...(repo?.car ?? [])]).toEqual([1, 2, 3]);
    expect(await store.getRepo("did:plc:b")).toBeUndefined();
  });

  test("keeps only the most recently saved repositories", async () => {
    const store = await fresh(2);
    for (const [did, savedAt] of [
      ["did:plc:old", 1],
      ["did:plc:mid", 2],
      ["did:plc:new", 3],
    ] as const) {
      await store.putRepo({ did, rev: "r", savedAt, car: new Uint8Array() });
    }

    expect(await store.getRepo("did:plc:old")).toBeUndefined();
    expect(await store.getRepo("did:plc:mid")).toBeDefined();
    expect(await store.getRepo("did:plc:new")).toBeDefined();
  });

  test("keeps an account's recent activity", async () => {
    const store = await fresh();
    const recent = {
      did: "did:plc:a",
      savedAt: 5,
      complete: false,
      items: [{ type: "organic" as const, at: 123 }],
    };
    await store.putRecent(recent);

    expect(await store.getRecent("did:plc:a")).toEqual(recent);
  });

  test("clear forgets everything", async () => {
    const store = await fresh();
    await store.putRepo({
      did: "d",
      rev: "r",
      savedAt: 1,
      car: new Uint8Array(),
    });
    await store.putRecent({ did: "d", savedAt: 1, complete: true, items: [] });
    await store.clear();

    expect(await store.getRepo("d")).toBeUndefined();
    expect(await store.getRecent("d")).toBeUndefined();
  });
});
