import { describe, expect, test } from "vitest";
import { downloadRepo, resolveAccount } from "../src/repo";
import { FIXTURE_CAR } from "./support/fixtures";

const PLC_DOC = {
  id: "did:plc:abc",
  alsoKnownAs: ["at://alice.example.com"],
  service: [
    {
      id: "#atproto_pds",
      type: "AtprotoPersonalDataServer",
      serviceEndpoint: "https://pds.example.net",
    },
  ],
};

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (!(url in routes)) return new Response("not found", { status: 404 });
    return Response.json(routes[url]);
  };
}

describe("resolveAccount", () => {
  test("resolves a handle to its DID, handle and PDS", async () => {
    const fetch = fakeFetch({
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com":
        { did: "did:plc:abc" },
      "https://plc.directory/did:plc:abc": PLC_DOC,
    });

    expect(await resolveAccount("alice.example.com", fetch)).toEqual({
      did: "did:plc:abc",
      handle: "alice.example.com",
      pds: "https://pds.example.net",
    });
  });

  test("accepts a DID directly, with or without a leading @ on handles", async () => {
    const fetch = fakeFetch({
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com":
        { did: "did:plc:abc" },
      "https://plc.directory/did:plc:abc": PLC_DOC,
    });

    expect((await resolveAccount("did:plc:abc", fetch)).handle).toBe(
      "alice.example.com",
    );
    expect((await resolveAccount("@alice.example.com", fetch)).did).toBe(
      "did:plc:abc",
    );
  });

  test("resolves did:web documents from the host's well-known path", async () => {
    const fetch = fakeFetch({
      "https://web.example.org/.well-known/did.json": {
        ...PLC_DOC,
        id: "did:web:web.example.org",
      },
    });

    expect((await resolveAccount("did:web:web.example.org", fetch)).pds).toBe(
      "https://pds.example.net",
    );
  });

  test("shows the DID when the claimed handle belongs to another account", async () => {
    const fetch = fakeFetch({
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com":
        { did: "did:plc:someone-else" },
      "https://plc.directory/did:plc:abc": PLC_DOC,
    });

    expect((await resolveAccount("did:plc:abc", fetch)).handle).toBe(
      "did:plc:abc",
    );
  });

  test("shows the DID when the claimed handle does not resolve", async () => {
    const fetch = fakeFetch({ "https://plc.directory/did:plc:abc": PLC_DOC });

    expect((await resolveAccount("did:plc:abc", fetch)).handle).toBe(
      "did:plc:abc",
    );
  });

  test("checks a typed handle only once", async () => {
    const urls: string[] = [];
    const routes = fakeFetch({
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com":
        { did: "did:plc:abc" },
      "https://plc.directory/did:plc:abc": PLC_DOC,
    });
    const fetch: typeof globalThis.fetch = async (input, init) => {
      urls.push(String(input));
      return routes(input, init);
    };

    expect((await resolveAccount("alice.example.com", fetch)).handle).toBe(
      "alice.example.com",
    );
    expect(urls.filter((u) => u.includes("resolveHandle"))).toHaveLength(1);
  });

  test("fails with a readable error when the handle does not resolve", async () => {
    await expect(
      resolveAccount("nobody.invalid", fakeFetch({})),
    ).rejects.toThrow("Could not resolve handle nobody.invalid");
  });
});

describe("downloadRepo", () => {
  const account = {
    did: "did:plc:fixture",
    handle: "fixture.test",
    pds: "https://pds.example.net",
  };

  test("fetches the account's repository export from its data server", async () => {
    const urls: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response(FIXTURE_CAR);
    };

    expect(await downloadRepo(account, fetchFn)).toEqual(FIXTURE_CAR);
    expect(urls).toEqual([
      "https://pds.example.net/xrpc/com.atproto.sync.getRepo?did=did%3Aplc%3Afixture",
    ]);
  });

  test("fails with the status when the data server refuses", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("gone", { status: 410 });

    await expect(downloadRepo(account, fetchFn)).rejects.toThrow(
      "410 downloading repo",
    );
  });
});
