import { describe, expect, test } from "vitest";
import { getJson, xrpcUrl } from "../src/xrpc";

describe("xrpcUrl", () => {
  test("encodes parameters, repeats list values and skips undefined ones", () => {
    expect(
      xrpcUrl("https://pds.example", "com.atproto.repo.listRecords", {
        repo: "did:plc:a b",
        cursor: undefined,
        uris: ["at://x/1", "at://x/2"],
      }),
    ).toBe(
      "https://pds.example/xrpc/com.atproto.repo.listRecords?repo=did%3Aplc%3Aa+b&uris=at%3A%2F%2Fx%2F1&uris=at%3A%2F%2Fx%2F2",
    );
  });

  test("has no query string without parameters", () => {
    expect(xrpcUrl("https://pds.example", "a.b.c")).toBe(
      "https://pds.example/xrpc/a.b.c",
    );
  });
});

describe("getJson", () => {
  test("returns the parsed body", async () => {
    const fetchFn: typeof fetch = async () => Response.json({ ok: 1 });

    expect(await getJson(fetchFn, "https://x.example/a")).toEqual({ ok: 1 });
  });

  test("names the status and address on failure", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("nope", { status: 502 });

    await expect(
      getJson(fetchFn, "https://x.example/xrpc/a.b.c?q=1"),
    ).rejects.toThrow("502 from x.example/xrpc/a.b.c");
  });
});
