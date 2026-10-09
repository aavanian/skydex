import { describe, expect, test } from "vitest";
import { activitiesFrom, activitiesFromFeed } from "../src/activities";

const did = "did:plc:me";
const subject = {
  uri: "at://did:plc:other/app.bsky.feed.post/3abc",
  cid: "bafy",
};

describe("activitiesFrom", () => {
  test("keeps posts and reposts with their type, date and uri", () => {
    const activities = activitiesFrom(did, [
      {
        collection: "app.bsky.feed.post",
        rkey: "1",
        record: { text: "hello", createdAt: "2025-03-01T10:00:00.000Z" },
      },
      {
        collection: "app.bsky.feed.repost",
        rkey: "2",
        record: { subject, createdAt: "2025-03-02T10:00:00.000Z" },
      },
    ]);

    expect(activities).toEqual([
      {
        uri: "at://did:plc:me/app.bsky.feed.post/1",
        type: "organic",
        createdAt: new Date("2025-03-01T10:00:00.000Z"),
        record: { text: "hello", createdAt: "2025-03-01T10:00:00.000Z" },
      },
      {
        uri: "at://did:plc:me/app.bsky.feed.repost/2",
        type: "repost",
        createdAt: new Date("2025-03-02T10:00:00.000Z"),
        record: { subject, createdAt: "2025-03-02T10:00:00.000Z" },
      },
    ]);
  });

  test("ignores other collections", () => {
    const activities = activitiesFrom(did, [
      {
        collection: "app.bsky.feed.like",
        rkey: "1",
        record: { subject, createdAt: "2025-03-01T10:00:00.000Z" },
      },
      {
        collection: "app.bsky.actor.profile",
        rkey: "self",
        record: { displayName: "me" },
      },
    ]);

    expect(activities).toEqual([]);
  });

  test("drops records whose createdAt is missing or unparseable", () => {
    const activities = activitiesFrom(did, [
      { collection: "app.bsky.feed.post", rkey: "1", record: { text: "a" } },
      {
        collection: "app.bsky.feed.post",
        rkey: "2",
        record: { text: "b", createdAt: "not a date" },
      },
    ]);

    expect(activities).toEqual([]);
  });

  test("sorts activities by date, oldest first", () => {
    const activities = activitiesFrom(did, [
      {
        collection: "app.bsky.feed.post",
        rkey: "late",
        record: { text: "b", createdAt: "2025-05-01T00:00:00.000Z" },
      },
      {
        collection: "app.bsky.feed.post",
        rkey: "early",
        record: { text: "a", createdAt: "2024-05-01T00:00:00.000Z" },
      },
    ]);

    expect(activities.map((a) => a.uri)).toEqual([
      "at://did:plc:me/app.bsky.feed.post/early",
      "at://did:plc:me/app.bsky.feed.post/late",
    ]);
  });
});

const me = "did:plc:me";
const own = (rkey: string) => `at://${me}/app.bsky.feed.post/${rkey}`;
const other = "at://did:plc:other/app.bsky.feed.post/x";

const post = (uri: string, author: string, record: object) => ({
  post: { uri, author: { did: author }, record },
});

describe("activitiesFromFeed", () => {
  test("turns author feed items into activities, oldest first", () => {
    const activities = activitiesFromFeed(me, [
      {
        ...post(other, "did:plc:other", {
          text: "theirs",
          createdAt: "2026-01-01T00:00:00Z",
        }),
        reason: {
          $type: "app.bsky.feed.defs#reasonRepost",
          uri: `at://${me}/app.bsky.feed.repost/r1`,
          indexedAt: "2026-03-01T00:00:00Z",
        },
      },
      post(own("2"), me, {
        text: "hi",
        createdAt: "2026-02-01T00:00:00Z",
        reply: { root: { uri: other }, parent: { uri: other } },
      }),
      post(own("1"), me, { text: "hello", createdAt: "2026-01-15T00:00:00Z" }),
    ]);

    expect(activities).toEqual([
      {
        uri: own("1"),
        type: "organic",
        createdAt: new Date("2026-01-15T00:00:00Z"),
        record: { text: "hello", createdAt: "2026-01-15T00:00:00Z" },
      },
      {
        uri: own("2"),
        type: "reply",
        createdAt: new Date("2026-02-01T00:00:00Z"),
        record: {
          text: "hi",
          createdAt: "2026-02-01T00:00:00Z",
          reply: { root: { uri: other }, parent: { uri: other } },
        },
      },
      {
        uri: `at://${me}/app.bsky.feed.repost/r1`,
        type: "repost",
        createdAt: new Date("2026-03-01T00:00:00Z"),
        record: { subject: { uri: other } },
      },
    ]);
  });

  test("skips pinned posts, which repeat an older post at the top", () => {
    const activities = activitiesFromFeed(me, [
      {
        ...post(own("1"), me, {
          text: "pinned",
          createdAt: "2025-01-01T00:00:00Z",
        }),
        reason: { $type: "app.bsky.feed.defs#reasonPin" },
      },
    ]);

    expect(activities).toEqual([]);
  });
});
