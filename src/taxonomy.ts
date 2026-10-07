export const ACTIVITY_TYPES = ["organic", "quote", "reply", "repost"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const QUOTE_EMBEDS = new Set([
  "app.bsky.embed.record",
  "app.bsky.embed.recordWithMedia",
]);

interface PostLike {
  reply?: unknown;
  embed?: { $type?: string };
}

/**
 * Classifies a repo record into one activity type. A reply that quotes
 * another post counts as a reply: it is conversation, not broadcast.
 */
export function activityType(collection: string, record: object): ActivityType {
  if (collection === "app.bsky.feed.repost") return "repost";
  const post = record as PostLike;
  if (post.reply) return "reply";
  if (post.embed?.$type && QUOTE_EMBEDS.has(post.embed.$type)) return "quote";
  return "organic";
}
