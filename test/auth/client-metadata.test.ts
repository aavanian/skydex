import { describe, expect, test } from "vitest";
import {
  clientMetadataFor,
  UNFOLLOW_SCOPE,
} from "../../src/auth/client-metadata";

describe("clientMetadataFor", () => {
  test("asks only to delete follow records", () => {
    expect(UNFOLLOW_SCOPE).toBe(
      "atproto repo:app.bsky.graph.follow?action=delete",
    );
  });

  test("describes a loopback client when served from 127.0.0.1", () => {
    const metadata = clientMetadataFor(
      new URL("http://127.0.0.1:5179/?follows=me"),
    );

    expect(metadata.redirect_uris).toEqual([
      "http://127.0.0.1:5179/callback.html",
    ]);
    expect(metadata.scope).toBe(UNFOLLOW_SCOPE);
    expect(metadata.client_id).toMatch(/^http:\/\/localhost\?/);
    expect(new URL(metadata.client_id).searchParams.get("scope")).toBe(
      UNFOLLOW_SCOPE,
    );
  });

  test("describes a hosted client whose id is its metadata URL", () => {
    const metadata = clientMetadataFor(
      new URL("https://profile.example/app/index.html?actor=x"),
    );

    expect(metadata).toMatchObject({
      client_id: "https://profile.example/app/client-metadata.json",
      client_uri: "https://profile.example/app/",
      redirect_uris: ["https://profile.example/app/callback.html"],
      scope: UNFOLLOW_SCOPE,
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
      application_type: "web",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  });

  test("refuses other plain-http hosts", () => {
    expect(() => clientMetadataFor(new URL("http://profile.example/"))).toThrow(
      "Bluesky login needs https, or http://127.0.0.1 locally",
    );
  });
});
