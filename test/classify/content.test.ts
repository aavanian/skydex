import { describe, expect, test } from "vitest";
import type { Activity } from "../../src/activities";
import { contentItems, tagSummary } from "../../src/classify/content";

const quoted = "at://did:plc:other/app.bsky.feed.post/q";

function activity(
  type: Activity["type"],
  iso: string,
  record: object,
): Activity {
  return {
    uri: `at://did:plc:me/app.bsky.feed.post/${iso}`,
    type,
    createdAt: new Date(iso),
    record,
  };
}

describe("contentItems", () => {
  const activities = [
    activity("organic", "2024-01-01T00:00:00Z", { text: "too old" }),
    activity("organic", "2025-03-01T00:00:00Z", { text: "my new book" }),
    activity("reply", "2025-03-02T00:00:00Z", { text: "a reply" }),
    activity("repost", "2025-03-03T00:00:00Z", {}),
    activity("organic", "2025-03-04T00:00:00Z", { text: "" }),
    activity("quote", "2025-03-05T00:00:00Z", {
      text: "lol ok",
      embed: { $type: "app.bsky.embed.record", record: { uri: quoted } },
    }),
  ];
  const sharedPosts = new Map([[quoted, { text: "the quoted take" }]]);
  const since = new Date("2025-01-01T00:00:00Z");

  test("takes organic and quote posts with text since a date, newest first", () => {
    expect(contentItems(activities, sharedPosts, since, 500)).toEqual([
      {
        id: activities[5]?.uri,
        state: { post: "lol ok", quoted_post: "the quoted take" },
      },
      { id: activities[1]?.uri, state: { post: "my new book" } },
    ]);
  });

  test("keeps at most `max` items", () => {
    expect(contentItems(activities, sharedPosts, since, 1)).toHaveLength(1);
  });

  test("omits quoted text that could not be fetched", () => {
    expect(contentItems(activities, new Map(), since, 1)[0]?.state).toEqual({
      post: "lol ok",
    });
  });
});

describe("tagSummary", () => {
  const answers = new Map([
    ["a", { promotional: 0.9, snark: 0.2 }],
    ["b", { promotional: 0.6, snark: 0.7 }],
    ["c", { promotional: 0.1, snark: 0.3 }],
    ["d", { promotional: 0.4, snark: Number.NaN }],
  ]);

  test("counts items at or above the threshold per tag", () => {
    const summary = tagSummary(answers, ["promotional", "snark"], 0.5);

    expect(summary.promotional).toMatchObject({
      count: 2,
      total: 4,
      share: 0.5,
    });
    expect(summary.snark).toMatchObject({ count: 1, total: 3, share: 1 / 3 });
  });

  test("lists the most confident examples first", () => {
    const summary = tagSummary(answers, ["promotional"], 0.5, 2);

    expect(summary.promotional?.examples).toEqual([
      { id: "a", probability: 0.9 },
      { id: "b", probability: 0.6 },
    ]);
  });
});
