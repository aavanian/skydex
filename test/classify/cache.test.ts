import { describe, expect, test } from "vitest";
import { AnswerCache } from "../../src/classify/cache";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("AnswerCache", () => {
  test("remembers answers per account and question set", () => {
    const storage = memoryStorage();
    new AnswerCache(storage, "v1").save(
      "did:plc:me",
      new Map([["at://p/1", { snark: 0.7 }]]),
    );

    expect(
      new AnswerCache(storage, "v1").load("did:plc:me").get("at://p/1"),
    ).toEqual({ snark: 0.7 });
    expect(new AnswerCache(storage, "v2").load("did:plc:me").size).toBe(0);
    expect(new AnswerCache(storage, "v1").load("did:plc:you").size).toBe(0);
  });

  test("merges new answers with saved ones", () => {
    const cache = new AnswerCache(memoryStorage(), "v1");
    cache.save("did:plc:me", new Map([["a", { snark: 0.1 }]]));
    cache.save("did:plc:me", new Map([["b", { snark: 0.2 }]]));

    expect([...cache.load("did:plc:me").keys()]).toEqual(["a", "b"]);
  });

  test("works without storage, e.g. when the browser blocks it", () => {
    const cache = new AnswerCache(undefined, "v1");
    cache.save("did:plc:me", new Map([["a", { snark: 0.1 }]]));

    expect(cache.load("did:plc:me").size).toBe(0);
  });

  test("ignores corrupt entries", () => {
    const storage = memoryStorage();
    storage.setItem("answers:v1:did:plc:me", "{not json");

    expect(new AnswerCache(storage, "v1").load("did:plc:me").size).toBe(0);
  });
});
