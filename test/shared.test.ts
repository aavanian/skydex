import { describe, expect, test } from "vitest";
import type { Activity } from "../src/activities";
import { fetchHandles, fetchPosts, sharedUris } from "../src/shared";

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

function recordingFetch(respond: (url: URL) => unknown) {
  const urls: URL[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(respond(url));
  };
  return { urls, fetchFn };
}

describe("fetchPosts", () => {
  test("fetches records 25 URIs at a time and maps them by URI", async () => {
    const uris = Array.from({ length: 30 }, (_, i) => ref(String(i)).uri);
    const { urls, fetchFn } = recordingFetch((url) => ({
      posts: url.searchParams
        .getAll("uris")
        .map((uri) => ({ uri, record: { text: `text of ${uri}` } })),
    }));

    const posts = await fetchPosts(uris, fetchFn);

    expect(urls.map((u) => u.searchParams.getAll("uris").length)).toEqual([
      25, 5,
    ]);
    expect(urls[0]?.pathname).toBe("/xrpc/app.bsky.feed.getPosts");
    expect(posts.size).toBe(30);
    expect(posts.get(ref("7").uri)).toEqual({
      text: `text of ${ref("7").uri}`,
    });
  });

  test("treats a batch the AppView fails on as unavailable posts", async () => {
    const uris = Array.from({ length: 30 }, (_, i) => ref(String(i)).uri);
    const fetchFn: typeof fetch = async (input) => {
      const batch = new URL(String(input)).searchParams.getAll("uris");
      return batch.length === 25
        ? new Response("boom", { status: 500 })
        : Response.json({
            posts: batch.map((uri) => ({ uri, record: { text: "ok" } })),
          });
    };

    const posts = await fetchPosts(uris, fetchFn);

    expect(posts.size).toBe(5);
  });

  test("returns nothing for deleted posts the AppView omits", async () => {
    const { fetchFn } = recordingFetch(() => ({ posts: [] }));

    expect((await fetchPosts([ref("gone").uri], fetchFn)).size).toBe(0);
  });
});

describe("fetchHandles", () => {
  test("maps DIDs to handles, 25 at a time", async () => {
    const dids = Array.from({ length: 26 }, (_, i) => `did:plc:${i}`);
    const { urls, fetchFn } = recordingFetch((url) => ({
      profiles: url.searchParams
        .getAll("actors")
        .map((did) => ({ did, handle: `${did.slice(8)}.example.com` })),
    }));

    const handles = await fetchHandles(dids, fetchFn);

    expect(urls.map((u) => u.pathname)).toEqual([
      "/xrpc/app.bsky.actor.getProfiles",
      "/xrpc/app.bsky.actor.getProfiles",
    ]);
    expect(handles.get("did:plc:3")).toBe("3.example.com");
    expect(handles.size).toBe(26);
  });

  test("leaves out DIDs in a batch the AppView fails on", async () => {
    const dids = Array.from({ length: 26 }, (_, i) => `did:plc:${i}`);
    const fetchFn: typeof fetch = async (input) => {
      const actors = new URL(String(input)).searchParams.getAll("actors");
      return actors.length === 25
        ? Response.json({ error: "InvalidRequest" }, { status: 400 })
        : Response.json({
            profiles: actors.map((did) => ({ did, handle: "last.example" })),
          });
    };

    const handles = await fetchHandles(dids, fetchFn);

    expect([...handles]).toEqual([["did:plc:25", "last.example"]]);
  });
});
