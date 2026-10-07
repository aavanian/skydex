import { resolveDid } from "../repo";
import { fetchPosts, quotedUri } from "../shared";
import { postState, type PostState } from "./content";

/**
 * Rebuilds what the classifier is shown for posts known only by
 * reference. Keys are the URIs as given; each value carries the URI
 * with any handle resolved to a DID. Deleted posts are left out.
 */
export async function statesFor(
  uris: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, { uri: string; state: PostState }>> {
  const dids = new Map<string, string>();
  const canonical = new Map<string, string>();
  for (const uri of uris) {
    const [, , actor = "", ...rest] = uri.split("/");
    if (!dids.has(actor)) dids.set(actor, await resolveDid(actor, fetchFn));
    canonical.set(uri, ["at:", "", dids.get(actor), ...rest].join("/"));
  }

  const posts = await fetchPosts([...new Set(canonical.values())], fetchFn);
  const quotedUris = [...posts.values()].flatMap((r) => quotedUri(r) ?? []);
  const quoted = await fetchPosts([...new Set(quotedUris)], fetchFn);

  const states = new Map<string, { uri: string; state: PostState }>();
  for (const [given, uri] of canonical) {
    const record = posts.get(uri) as { text?: string } | undefined;
    if (!record) continue;
    const quotedRef = quotedUri(record);
    states.set(given, {
      uri,
      state: postState(
        record.text ?? "",
        quotedRef ? quoted.get(quotedRef) : undefined,
      ),
    });
  }
  return states;
}
