import type { Activity } from "./activities";

interface QuoteEmbed {
  $type?: string;
  record?: { uri?: string; record?: { uri?: string } };
}

const POST_COLLECTION = "app.bsky.feed.post";

/**
 * URI of the post a post record quotes, if any. Record embeds can also
 * point at starter packs, lists or feeds, which are not posts and are
 * left out.
 */
export function quotedUri(record: object): string | undefined {
  const embed = (record as { embed?: QuoteEmbed }).embed;
  const uri =
    embed?.$type === "app.bsky.embed.recordWithMedia"
      ? embed.record?.record?.uri
      : embed?.$type === "app.bsky.embed.record"
        ? embed.record?.uri
        : undefined;
  return uri?.split("/")[3] === POST_COLLECTION ? uri : undefined;
}

/** URI of the post a repost or quote points to. */
export function sharedUri(activity: Activity): string | undefined {
  if (activity.type === "repost") {
    return (activity.record as { subject?: { uri?: string } }).subject?.uri;
  }
  if (activity.type === "quote") return quotedUri(activity.record);
  return undefined;
}

/**
 * URIs of posts the account reposted or quoted since `since`, newest
 * first, each once, at most `max`.
 */
export function sharedUris(
  activities: Activity[],
  since: Date,
  max: number,
): string[] {
  const uris = new Set<string>();
  for (let i = activities.length - 1; i >= 0 && uris.size < max; i--) {
    const activity = activities[i];
    if (!activity || activity.createdAt < since) break;
    const uri = sharedUri(activity);
    if (uri) uris.add(uri);
  }
  return [...uris];
}
