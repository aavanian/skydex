import { describe, expect, test } from "vitest";
import type { Activity } from "../src/activities";
import {
  activitiesFromFeed,
  fetchFollows,
  fetchRecentActivity,
  followStatus,
  followSummary,
} from "../src/follows";

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

function pagedFetch(pages: Record<string, unknown>) {
  const urls: URL[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(pages[url.searchParams.get("cursor") ?? ""]);
  };
  return { urls, fetchFn };
}

describe("fetchFollows", () => {
  test("follows every page of an account's follows", async () => {
    const subject = { did: "did:plc:me", handle: "me.test" };
    const { urls, fetchFn } = pagedFetch({
      "": {
        subject,
        follows: [{ did: "did:plc:a", handle: "a.test" }],
        cursor: "next",
      },
      next: {
        subject,
        follows: [{ did: "did:plc:b", handle: "b.test", displayName: "B" }],
      },
    });

    expect(await fetchFollows("did:plc:me", fetchFn)).toEqual({
      subject: { did: "did:plc:me", handle: "me.test" },
      follows: [
        { did: "did:plc:a", handle: "a.test" },
        { did: "did:plc:b", handle: "b.test", displayName: "B" },
      ],
    });
    expect(urls[0]?.pathname).toBe("/xrpc/app.bsky.graph.getFollows");
    expect(urls[0]?.searchParams.get("actor")).toBe("did:plc:me");
    expect(urls[0]?.searchParams.get("limit")).toBe("100");
  });
});

describe("fetchRecentActivity", () => {
  test("reads the latest page of the author feed, replies included", async () => {
    const { urls, fetchFn } = pagedFetch({
      "": {
        feed: [
          post(own("1"), me, { text: "a", createdAt: "2026-01-01T00:00:00Z" }),
        ],
        cursor: "older",
      },
    });

    const recent = await fetchRecentActivity(me, fetchFn);

    expect(urls[0]?.pathname).toBe("/xrpc/app.bsky.feed.getAuthorFeed");
    expect(urls[0]?.searchParams.get("filter")).toBe("posts_with_replies");
    expect(recent.activities).toHaveLength(1);
    expect(recent.complete).toBe(false);
  });

  test("is complete when the feed has no older page", async () => {
    const { fetchFn } = pagedFetch({ "": { feed: [] } });

    expect((await fetchRecentActivity(me, fetchFn)).complete).toBe(true);
  });
});

describe("followSummary", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const at = (iso: string): Activity => ({
    uri: `at://x/${iso}`,
    type: "organic",
    createdAt: new Date(iso),
    record: {},
  });

  test("the recent rate is exact when the fetched page reaches past 90 days", () => {
    const summary = followSummary(
      {
        activities: [at("2026-05-01T00:00:00Z"), at("2026-09-01T00:00:00Z")],
        complete: false,
      },
      now,
    );

    expect(summary.last).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(summary.recentRateIsMinimum).toBe(false);
  });

  test("the recent rate is a minimum when the whole page is recent but more exists", () => {
    expect(
      followSummary(
        { activities: [at("2026-09-01T00:00:00Z")], complete: false },
        now,
      ).recentRateIsMinimum,
    ).toBe(true);
    expect(
      followSummary(
        { activities: [at("2026-09-01T00:00:00Z")], complete: true },
        now,
      ).recentRateIsMinimum,
    ).toBe(false);
  });
});

describe("followStatus", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const at = (type: Activity["type"], iso: string): Activity => ({
    uri: `at://x/${iso}`,
    type,
    createdAt: new Date(iso),
    record: {},
  });
  const status = (activities: Activity[]) =>
    followStatus(followSummary({ activities, complete: true }, now));

  test("never posted", () => {
    expect(status([])).toBe("never");
  });

  test("dormant after 90 days without any activity", () => {
    expect(status([at("organic", "2026-06-01T00:00:00Z")])).toBe("dormant");
  });

  test("active but without own posts in 90 days", () => {
    expect(
      status([
        at("organic", "2026-05-01T00:00:00Z"),
        at("repost", "2026-09-20T00:00:00Z"),
        at("reply", "2026-09-21T00:00:00Z"),
      ]),
    ).toBe("no-own-posts");
  });

  test("active with recent own posts", () => {
    expect(
      status([
        at("repost", "2026-09-20T00:00:00Z"),
        at("quote", "2026-09-21T00:00:00Z"),
      ]),
    ).toBe("active");
  });
});
