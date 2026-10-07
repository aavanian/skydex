import { expect, test } from "vitest";
import { statesFor } from "../../src/classify/hydrate";

const me = "did:plc:me";
const quoteUri = `at://${me}/app.bsky.feed.post/q`;
const plainUri = `at://${me}/app.bsky.feed.post/p`;
const quotedUri = "at://did:plc:other/app.bsky.feed.post/orig";

const records: Record<string, object> = {
  [quoteUri]: {
    text: "lol ok",
    embed: { $type: "app.bsky.embed.record", record: { uri: quotedUri } },
  },
  [plainUri]: { text: "a thought" },
  [quotedUri]: { text: "the original take" },
};

const fetchFn: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("resolveHandle")) {
    return Response.json({ did: me });
  }
  return Response.json({
    posts: url.searchParams
      .getAll("uris")
      .filter((u) => records[u])
      .map((u) => ({ uri: u, record: records[u] })),
  });
};

test("fetches post text, quoted text, and resolves handle links", async () => {
  const states = await statesFor(
    [quoteUri, "at://me.example.com/app.bsky.feed.post/p"],
    fetchFn,
  );

  expect(states.get(quoteUri)).toEqual({
    uri: quoteUri,
    state: { post: "lol ok", quoted_post: "the original take" },
  });
  expect(states.get("at://me.example.com/app.bsky.feed.post/p")).toEqual({
    uri: plainUri,
    state: { post: "a thought" },
  });
});

test("leaves out posts that no longer exist", async () => {
  const states = await statesFor(
    [`at://${me}/app.bsky.feed.post/gone`],
    fetchFn,
  );

  expect(states.size).toBe(0);
});
