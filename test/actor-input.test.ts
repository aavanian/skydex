import { describe, expect, test } from "vitest";
import { actorFromInput } from "../src/actor-input";

describe("actorFromInput", () => {
  test.each([
    ["alice.bsky.social", "alice.bsky.social"],
    ["  @alice.bsky.social ", "alice.bsky.social"],
    ["did:plc:abc123", "did:plc:abc123"],
    ["https://bsky.app/profile/alice.bsky.social", "alice.bsky.social"],
    [
      "https://bsky.app/profile/alice.bsky.social/post/3abc",
      "alice.bsky.social",
    ],
    ["https://deer.social/profile/did:plc:abc123", "did:plc:abc123"],
    ["https://bsky.app/profile/Alice.Example.COM", "alice.example.com"],
  ])("%s -> %s", (input, actor) => {
    expect(actorFromInput(input)).toBe(actor);
  });

  test.each([
    [""],
    ["https://bsky.app/notifications"],
    ["not a handle"],
    ["https://bsky.app/profile/%E0%A4%A"],
  ])("%j is not an actor", (input) => {
    expect(actorFromInput(input)).toBeUndefined();
  });
});
