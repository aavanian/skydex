import { describe, expect, test } from "vitest";
import type { Activity } from "../src/activities";
import { sharedUris } from "../src/shared-posts";

const ref = (n: string) => ({
  uri: `at://did:plc:other/app.bsky.feed.post/${n}`,
  cid: "bafy",
});

function activity(
  type: Activity["type"],
  iso: string,
  record: object,
): Activity {
  return { uri: `at://me/${iso}`, type, createdAt: new Date(iso), record };
}

describe("sharedUris", () => {
  const activities = [
    activity("repost", "2024-01-01T00:00:00Z", { subject: ref("old") }),
    activity("repost", "2025-05-01T00:00:00Z", { subject: ref("r1") }),
    activity("quote", "2025-06-01T00:00:00Z", {
      embed: { $type: "app.bsky.embed.record", record: ref("q1") },
    }),
    activity("quote", "2025-07-01T00:00:00Z", {
      embed: {
        $type: "app.bsky.embed.recordWithMedia",
        record: { record: ref("q2") },
      },
    }),
    activity("organic", "2025-08-01T00:00:00Z", { text: "hi" }),
  ];

  test("lists reposted and quoted post URIs since a date, newest first", () => {
    expect(
      sharedUris(activities, new Date("2025-01-01T00:00:00Z"), 500),
    ).toEqual([ref("q2").uri, ref("q1").uri, ref("r1").uri]);
  });

  test("leaves out quoted records that are not posts, such as starter packs", () => {
    const quotingStarterPack = activity("quote", "2025-09-01T00:00:00Z", {
      embed: {
        $type: "app.bsky.embed.record",
        record: {
          uri: "at://did:plc:other/app.bsky.graph.starterpack/3abc",
          cid: "bafy",
        },
      },
    });

    expect(
      sharedUris([quotingStarterPack], new Date("2025-01-01T00:00:00Z"), 500),
    ).toEqual([]);
  });

  test("keeps at most `max` URIs", () => {
    expect(sharedUris(activities, new Date("2020-01-01T00:00:00Z"), 2)).toEqual(
      [ref("q2").uri, ref("q1").uri],
    );
  });

  test("lists a post shared more than once a single time", () => {
    const twice = [
      activity("repost", "2025-05-01T00:00:00Z", { subject: ref("p") }),
      activity("quote", "2025-06-01T00:00:00Z", {
        embed: { $type: "app.bsky.embed.record", record: ref("p") },
      }),
      activity("repost", "2025-07-01T00:00:00Z", { subject: ref("r") }),
    ];

    expect(sharedUris(twice, new Date("2025-01-01T00:00:00Z"), 3)).toEqual([
      ref("r").uri,
      ref("p").uri,
    ]);
  });
});
