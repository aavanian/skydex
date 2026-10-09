export const ACTIVITY_TYPES = ["organic", "quote", "reply", "repost"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Whether the account wrote it itself: an organic post or a quote. */
export function isOwnPost(type: ActivityType): boolean {
  return type === "organic" || type === "quote";
}

const QUOTE_EMBEDS = new Set([
  "app.bsky.embed.record",
  "app.bsky.embed.recordWithMedia",
]);

interface PostLike {
  reply?: { root?: { uri?: string }; parent?: { uri?: string } };
  embed?: { $type?: string };
}

function isOwn(did: string, uri: string | undefined): boolean {
  return uri?.startsWith(`at://${did}/`) ?? false;
}

/**
 * Classifies a repo record into one activity type. Continuing one's
 * own thread (root and parent both by the account) is posting, not
 * replying. Any other reply counts as a reply even when it quotes
 * another post: it is conversation, not broadcast.
 */
export function activityType(
  did: string,
  collection: string,
  record: object,
): ActivityType {
  if (collection === "app.bsky.feed.repost") return "repost";
  const post = record as PostLike;
  const selfThread =
    isOwn(did, post.reply?.root?.uri) && isOwn(did, post.reply?.parent?.uri);
  if (post.reply && !selfThread) return "reply";
  if (post.embed?.$type && QUOTE_EMBEDS.has(post.embed.$type)) return "quote";
  return "organic";
}
