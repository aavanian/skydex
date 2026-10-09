import { describe, expect, test } from "vitest";
import {
  fetchFollowing,
  fetchFollows,
  fetchRecentActivity,
} from "../src/follows";

const me = "did:plc:me";
const own = (rkey: string) => `at://${me}/app.bsky.feed.post/${rkey}`;

const post = (uri: string, author: string, record: object) => ({
  post: { uri, author: { did: author }, record },
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

describe("fetchFollowing", () => {
  const pds = "https://pds.example";
  const theirPds = "https://their.example";

  const ok = { did: "did:plc:ok", handle: "ok.test", displayName: "OK" };
  const blocksMe = { did: "did:plc:blocker", handle: "blocker.test" };
  const iBlock = { did: "did:plc:blocked", handle: "blocked.test" };
  const listHidden = { did: "did:plc:listed", handle: "listed.test" };
  const deactivated = "did:plc:deactivated";
  const deleted = "did:plc:deleted";
  const suspended = "did:plc:suspended";

  const didDoc = (endpoint: string) => ({
    service: [{ id: "#atproto_pds", serviceEndpoint: endpoint }],
    alsoKnownAs: [],
  });

  const follows = [ok, blocksMe, iBlock, listHidden]
    .map((f) => f.did)
    .concat([deactivated, deleted, suspended]);

  /** When each follow record was created; others are old. */
  const followedAt: Record<string, string> = {
    [listHidden.did]: "2026-06-01T12:00:00.000Z",
  };

  function records(subjects: string[], repo = "did:plc:x") {
    return subjects.map((subject) => ({
      uri: `at://${repo}/app.bsky.graph.follow/f-${subject.split(":").at(-1)}`,
      value: {
        subject,
        createdAt: followedAt[subject] ?? "2025-01-01T00:00:00.000Z",
      },
    }));
  }
  const followUri = (did: string) =>
    `at://${me}/app.bsky.graph.follow/f-${did.split(":").at(-1)}`;

  const profileErrors: Record<string, [string, string]> = {
    [deactivated]: ["AccountDeactivated", "Account is deactivated"],
    [deleted]: ["InvalidRequest", "Profile not found"],
    [suspended]: ["AccountTakedown", "Account has been suspended"],
  };

  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const q = url.searchParams;
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status });

    if (url.hostname === "plc.directory") {
      const did = url.pathname.slice(1);
      const doc = didDoc(did === me ? pds : theirPds);
      return json(
        did === deactivated ? { ...doc, alsoKnownAs: ["at://gone.test"] } : doc,
      );
    }
    switch (url.pathname) {
      case "/xrpc/com.atproto.repo.listRecords": {
        const repo = q.get("repo");
        const collection = q.get("collection");
        if (repo === me && collection === "app.bsky.graph.follow") {
          return q.get("cursor")
            ? json({ records: records(follows.slice(4), me) })
            : json({ records: records(follows.slice(0, 4), me), cursor: "p2" });
        }
        if (repo === me && collection === "app.bsky.graph.block") {
          return json({ records: records([iBlock.did]) });
        }
        if (repo === blocksMe.did) return json({ records: records([me]) });
        return json({ records: records(["did:plc:someone-else"]) });
      }
      case "/xrpc/app.bsky.actor.getProfiles":
        return json({
          profiles: [
            ok,
            blocksMe,
            iBlock,
            listHidden,
            { did: me, handle: "me.test" },
          ].filter((p) => q.getAll("actors").includes(p.did)),
        });
      case "/xrpc/app.bsky.actor.getProfile": {
        const [error, message] = profileErrors[q.get("actor") ?? ""] ?? [];
        return json({ error, message }, 400);
      }
      case "/xrpc/app.bsky.graph.getFollows":
        return json({ subject: { did: me, handle: "me.test" }, follows: [ok] });
    }
    return json({ error: "NotFound" }, 404);
  };

  test("lists every followed account from the follow records, with why some are unavailable", async () => {
    const { subject, follows: result } = await fetchFollowing(me, fetchFn);

    expect(subject).toEqual({ did: me, handle: "me.test" });
    expect(result).toEqual([
      { ...ok, followUri: followUri(ok.did) },
      { ...blocksMe, followUri: followUri(blocksMe.did), block: "blocks-you" },
      { ...iBlock, followUri: followUri(iBlock.did), block: "you-block" },
      { ...listHidden, followUri: followUri(listHidden.did), block: "hidden" },
      {
        did: deactivated,
        handle: deactivated,
        lastHandle: "gone.test",
        followUri: followUri(deactivated),
        unavailable: "deactivated",
      },
      {
        did: deleted,
        handle: deleted,
        followUri: followUri(deleted),
        unavailable: "deleted",
      },
      {
        did: suspended,
        handle: suspended,
        followUri: followUri(suspended),
        unavailable: "suspended",
      },
    ]);
  });

  test("a follow made minutes ago is not taken for one hidden by a block", async () => {
    // Bluesky's follow list may not list a brand new follow yet.
    const fiveMinutesLater = Date.parse("2026-06-01T12:05:00.000Z");

    const { follows: result } = await fetchFollowing(
      me,
      fetchFn,
      fiveMinutesLater,
    );

    expect(result.find((f) => f.did === listHidden.did)).toEqual({
      ...listHidden,
      followUri: followUri(listHidden.did),
    });
    expect(result.find((f) => f.did === blocksMe.did)?.block).toBe(
      "blocks-you",
    );
  });

  /** `fetchFn`, except that requests matching `fails` get `response`. */
  function failing(
    fails: (url: URL) => boolean,
    response: () => Response,
  ): typeof fetch {
    return async (input, init) =>
      fails(new URL(String(input))) ? response() : fetchFn(input, init);
  }

  const unavailableOf = (result: { did: string; unavailable?: string }[]) =>
    Object.fromEntries(result.map((f) => [f.did, f.unavailable]));

  test("a rate limit or server error from getProfile is not taken for a deleted account", async () => {
    const rateLimited = failing(
      (url) => url.searchParams.get("actor") === deleted,
      () => Response.json({ error: "RateLimitExceeded" }, { status: 429 }),
    );
    const serverError = failing(
      (url) => url.searchParams.get("actor") === suspended,
      () => new Response("<html>Bad gateway</html>", { status: 502 }),
    );

    const limited = await fetchFollowing(me, rateLimited);
    const broken = await fetchFollowing(me, serverError);

    expect(unavailableOf(limited.follows)[deleted]).toBeUndefined();
    expect(unavailableOf(limited.follows)[suspended]).toBe("suspended");
    expect(unavailableOf(broken.follows)[suspended]).toBeUndefined();
    expect(unavailableOf(broken.follows)[deleted]).toBe("deleted");
  });

  test("one followed account's unreachable data server does not stop the scan", async () => {
    const unreachable = failing(
      (url) =>
        url.searchParams.get("repo") === blocksMe.did ||
        url.pathname === `/${blocksMe.did}`,
      () => new Response("down", { status: 500 }),
    );

    const { follows: result } = await fetchFollowing(me, unreachable);

    expect(result.find((f) => f.did === blocksMe.did)?.block).toBe("hidden");
    expect(result.find((f) => f.did === iBlock.did)?.block).toBe("you-block");
    expect(unavailableOf(result)[deactivated]).toBe("deactivated");
  });

  test("a network error looking up an unavailable account does not stop the scan", async () => {
    const offline: typeof fetch = async (input, init) => {
      if (new URL(String(input)).searchParams.get("actor") === deleted) {
        throw new TypeError("Failed to fetch");
      }
      return fetchFn(input, init);
    };

    const { follows: result } = await fetchFollowing(me, offline);

    expect(unavailableOf(result)[deleted]).toBeUndefined();
    expect(unavailableOf(result)[suspended]).toBe("suspended");
  });

  test("a batch of profiles the AppView fails on does not stop the scan", async () => {
    const noProfiles = failing(
      (url) => url.pathname === "/xrpc/app.bsky.actor.getProfiles",
      () => Response.json({ error: "InternalServerError" }, { status: 500 }),
    );

    const { subject, follows: result } = await fetchFollowing(me, noProfiles);

    expect(subject).toEqual({ did: me, handle: me });
    expect(result.map((f) => f.did)).toEqual(follows);
    expect(unavailableOf(result)[deleted]).toBe("deleted");
  });
});
