/** bsky.app link for a post's at:// URI. */
export function postUrl(uri: string): string {
  const [, , actor, , rkey] = uri.split("/");
  return `https://bsky.app/profile/${actor}/post/${rkey}`;
}

/**
 * at:// URI for a web client post link (`/profile/<actor>/post/<rkey>`).
 * The actor may be a handle, which then still needs resolving to a DID.
 */
export function postUri(url: string): string | undefined {
  const match = url.match(/\/profile\/([^/?#]+)\/post\/([^/?#]+)/);
  if (!match?.[1] || !match[2]) return undefined;
  return `at://${decodeURIComponent(match[1])}/app.bsky.feed.post/${match[2]}`;
}
