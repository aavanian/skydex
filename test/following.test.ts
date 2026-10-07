import { expect, test } from "vitest";
import { fetchFollowing } from "../src/follows";

const me = "did:plc:me";
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

function records(subjects: string[], repo = "did:plc:x") {
  return subjects.map((subject) => ({
    uri: `at://${repo}/app.bsky.graph.follow/f-${subject.split(":").at(-1)}`,
    value: { subject },
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
  const json = (body: unknown, status = 200) => Response.json(body, { status });

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
