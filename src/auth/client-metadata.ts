import {
  buildAtprotoLoopbackClientMetadata,
  type OAuthClientMetadataInput,
} from "@atproto/oauth-types";

/** The only permission requested: deleting the viewer's follow records. */
export const UNFOLLOW_SCOPE =
  "atproto repo:app.bsky.graph.follow?action=delete";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);

/**
 * OAuth client metadata for the page at `location`. Locally the client
 * is a loopback client, described entirely by its id. Hosted, its id is
 * the URL of a client-metadata.json published next to the page, which
 * must contain exactly this object.
 */
export function clientMetadataFor(
  location: URL,
): OAuthClientMetadataInput & { client_id: string } {
  const base = new URL(".", location);
  const redirectUri = new URL("callback.html", base).href;

  if (location.protocol === "http:" && LOOPBACK_HOSTS.has(location.hostname)) {
    return buildAtprotoLoopbackClientMetadata({
      scope: UNFOLLOW_SCOPE,
      redirect_uris: [redirectUri],
    });
  }
  if (location.protocol !== "https:") {
    throw new Error("Bluesky login needs https, or http://127.0.0.1 locally");
  }
  return {
    client_id: new URL("client-metadata.json", base).href,
    client_name: "Bluesky account profile",
    client_uri: base.href,
    redirect_uris: [redirectUri],
    scope: UNFOLLOW_SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}
