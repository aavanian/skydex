import { describe, expect, test } from "vitest";
import { resolveAccount } from "../src/repo";

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

  test("fails with a readable error when the handle does not resolve", async () => {
    await expect(
      resolveAccount("nobody.invalid", fakeFetch({})),
    ).rejects.toThrow("Could not resolve handle nobody.invalid");
  });
});
