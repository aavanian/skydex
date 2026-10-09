import { describe, expect, test } from "vitest";
import { ACTIVITY_TYPES, activityType, isOwnPost } from "../src/taxonomy";

const me = "did:plc:me";
const createdAt = "2025-01-01T00:00:00.000Z";
const own = (rkey: string) => ({
  uri: `at://${me}/app.bsky.feed.post/${rkey}`,
  cid: "bafy",
});
const strongRef = {
  uri: "at://did:plc:abc/app.bsky.feed.post/1",
  cid: "bafy",
};

describe("activityType", () => {
  test("repost record is a repost", () => {
    expect(
      activityType(me, "app.bsky.feed.repost", {
        subject: strongRef,
        createdAt,
      }),
    ).toBe("repost");
  });

  test("post embedding a record is a quote", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "look",
        createdAt,
        embed: { $type: "app.bsky.embed.record", record: strongRef },
      }),
    ).toBe("quote");
  });

  test("post embedding a record with media is a quote", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
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
      activityType(me, "app.bsky.feed.post", {
        text: "yes",
        createdAt,
        reply: { root: strongRef, parent: strongRef },
        embed: { $type: "app.bsky.embed.record", record: strongRef },
      }),
    ).toBe("reply");
  });

  test("plain post, or post with images or link card, is organic", () => {
    expect(
      activityType(me, "app.bsky.feed.post", { text: "hi", createdAt }),
    ).toBe("organic");
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "hi",
        createdAt,
        embed: { $type: "app.bsky.embed.external", external: {} },
      }),
    ).toBe("organic");
  });

  test("continuing one's own thread is organic, not a reply", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "2/ and another thing",
        createdAt,
        reply: { root: own("1"), parent: own("2") },
      }),
    ).toBe("organic");
  });

  test("a thread continuation quoting a post is a quote", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "3/ see this",
        createdAt,
        reply: { root: own("1"), parent: own("2") },
        embed: { $type: "app.bsky.embed.record", record: strongRef },
      }),
    ).toBe("quote");
  });

  test("answering someone else in one's own thread is a reply", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "thanks!",
        createdAt,
        reply: { root: own("1"), parent: strongRef },
      }),
    ).toBe("reply");
  });

  test("replying to oneself inside someone else's thread is a reply", () => {
    expect(
      activityType(me, "app.bsky.feed.post", {
        text: "also",
        createdAt,
        reply: { root: strongRef, parent: own("2") },
      }),
    ).toBe("reply");
  });
});

describe("isOwnPost", () => {
  test("own writing is organic posts and quote commentary", () => {
    expect(ACTIVITY_TYPES.filter(isOwnPost)).toEqual(["organic", "quote"]);
  });
});
