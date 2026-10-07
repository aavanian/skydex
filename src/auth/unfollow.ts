const FOLLOW_COLLECTION = "app.bsky.graph.follow";

/** Authenticated fetch of an XRPC path on the viewer's data server. */
export type FetchHandler = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

/** Deletes one of the viewer's follow records, ending that follow. */
export async function deleteFollow(
  fetchHandler: FetchHandler,
  followUri: string,
): Promise<void> {
  const [, , repo, collection, rkey] = followUri.split("/");
  if (!repo || collection !== FOLLOW_COLLECTION || !rkey) {
    throw new Error(`Not a follow record: ${followUri}`);
  }
  const response = await fetchHandler("/xrpc/com.atproto.repo.deleteRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, collection, rkey }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      `Unfollow failed (${response.status}${body.message ? `: ${body.message}` : ""})`,
    );
  }
}
