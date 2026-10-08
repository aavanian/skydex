import { describe, expect, test } from "vitest";
import { routeFrom, searchFor } from "../src/route";

describe("routes", () => {
  test.each([
    ["", { mode: "actor" }],
    ["?actor=alice.test", { mode: "actor", actor: "alice.test" }],
    ["?follows=alice.test", { mode: "follows", actor: "alice.test" }],
    ["?follows=", { mode: "follows" }],
    ["?settings", { mode: "settings" }],
    ["?code=x&state=y", { mode: "actor" }],
  ])("%j is %j", (search, route) => {
    expect(routeFrom(search)).toEqual(route);
  });

  test.each([
    [{ mode: "actor" as const }, "?"],
    [{ mode: "actor" as const, actor: "did:plc:a" }, "?actor=did%3Aplc%3Aa"],
    [{ mode: "follows" as const, actor: "alice.test" }, "?follows=alice.test"],
    [{ mode: "follows" as const }, "?follows="],
    [{ mode: "settings" as const }, "?settings"],
  ])("%j is written %j", (route, search) => {
    expect(searchFor(route)).toBe(search);
    expect(routeFrom(search)).toEqual(route);
  });
});
