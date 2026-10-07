import { describe, expect, test } from "vitest";
import { activitiesFrom } from "../src/activities";

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
