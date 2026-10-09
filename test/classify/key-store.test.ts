import { describe, expect, test } from "vitest";
import { KeyStore } from "../../src/classify/key-store";
import { memoryStorage } from "../support/memory-storage";

describe("KeyStore", () => {
  test("keeps the key for the session only unless asked to remember it", () => {
    const session = memoryStorage();
    const local = memoryStorage();
    new KeyStore(session, local).set("sk-1", false);

    expect(new KeyStore(session, local).get()).toBe("sk-1");
    expect(new KeyStore(memoryStorage(), local).get()).toBe("");
    expect(new KeyStore(session, local).remembered()).toBe(false);
  });

  test("a remembered key survives a new session", () => {
    const local = memoryStorage();
    new KeyStore(memoryStorage(), local).set("sk-2", true);

    const store = new KeyStore(memoryStorage(), local);
    expect(store.get()).toBe("sk-2");
    expect(store.remembered()).toBe(true);
  });

  test("switching to session-only removes the remembered copy", () => {
    const session = memoryStorage();
    const local = memoryStorage();
    new KeyStore(session, local).set("sk-3", true);
    new KeyStore(session, local).set("sk-3", false);

    expect(new KeyStore(memoryStorage(), local).get()).toBe("");
    expect(new KeyStore(session, local).get()).toBe("sk-3");
  });

  test("clear forgets the key everywhere", () => {
    const session = memoryStorage();
    const local = memoryStorage();
    const store = new KeyStore(session, local);
    store.set("sk-4", true);
    store.clear();

    expect(new KeyStore(session, local).get()).toBe("");
  });

  test("without storage the key lasts only as long as the object", () => {
    const store = new KeyStore(undefined, undefined);
    store.set("sk-5", true);

    expect(store.get()).toBe("sk-5");
  });
});
