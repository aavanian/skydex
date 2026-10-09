import { describe, expect, test } from "vitest";
import { fetchHandles, fetchPosts } from "../src/appview";

const ref = (n: string) => ({
  uri: `at://did:plc:other/app.bsky.feed.post/${n}`,
  cid: "bafy",
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

  test("has at most 6 batches in flight at once", async () => {
    const uris = Array.from({ length: 300 }, (_, i) => ref(`p${i}`).uri);
    let inFlight = 0;
    let most = 0;
    const fetchFn: typeof fetch = async (input) => {
      most = Math.max(most, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      const batch = new URL(String(input)).searchParams.getAll("uris");
      return Response.json({
        posts: batch.map((uri) => ({ uri, record: {} })),
      });
    };

    const posts = await fetchPosts(uris, fetchFn);

    expect(posts.size).toBe(300);
    expect(most).toBe(6);
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
