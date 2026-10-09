import { describe, expect, test } from "vitest";
import { MemoryStore } from "../../src/auth/memory-store";

describe("MemoryStore", () => {
  test("keeps values until deleted", async () => {
    const store = new MemoryStore<string, { a: number }>();
    await store.set("k", { a: 1 });

    expect(await store.get("k")).toEqual({ a: 1 });
    await store.del("k");
    expect(await store.get("k")).toBeUndefined();
  });
});
