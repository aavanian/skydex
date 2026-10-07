import { describe, expect, test } from "vitest";
import { activityType } from "../src/taxonomy";

const createdAt = "2025-01-01T00:00:00.000Z";
const strongRef = {
  uri: "at://did:plc:abc/app.bsky.feed.post/1",
  cid: "bafy",
};

describe("activityType", () => {
  test("repost record is a repost", () => {
    expect(
      activityType("app.bsky.feed.repost", { subject: strongRef, createdAt }),
    ).toBe("repost");
  });

  test("post embedding a record is a quote", () => {
    expect(
      activityType("app.bsky.feed.post", {
        text: "look",
        createdAt,
        embed: { $type: "app.bsky.embed.record", record: strongRef },
      }),
    ).toBe("quote");
  });

  test("post embedding a record with media is a quote", () => {
    expect(
      activityType("app.bsky.feed.post", {
        text: "look",
        createdAt,
        embed: {
          $type: "app.bsky.embed.recordWithMedia",
          record: { record: strongRef },
          media: { $type: "app.bsky.embed.images", images: [] },
        },
      }),
    ).toBe("quote");
  });

  test("post with a reply field is a reply, even when quoting", () => {
    expect(
      activityType("app.bsky.feed.post", {
        text: "yes",
        createdAt,
        reply: { root: strongRef, parent: strongRef },
        embed: { $type: "app.bsky.embed.record", record: strongRef },
      }),
    ).toBe("reply");
  });

  test("plain post, or post with images or link card, is organic", () => {
    expect(activityType("app.bsky.feed.post", { text: "hi", createdAt })).toBe(
      "organic",
    );
    expect(
      activityType("app.bsky.feed.post", {
        text: "hi",
        createdAt,
        embed: { $type: "app.bsky.embed.external", external: {} },
      }),
    ).toBe("organic");
  });
});
