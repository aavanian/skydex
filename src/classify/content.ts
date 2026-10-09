import type { Activity } from "../activities";
import { sharedUri } from "../shared-posts";
import type { DecisionItem } from "./decisions";
import { isOwnPost } from "../taxonomy";

export interface PostState {
  post: string;
  quoted_post?: string;
}

/**
 * What the classifier is shown for one post: its text and, for quotes,
 * the quoted post's text when available, since tone often depends on it.
 */
export function postState(text: string, quoted?: object): PostState {
  const quotedText = (quoted as { text?: string } | undefined)?.text;
  return quotedText ? { post: text, quoted_post: quotedText } : { post: text };
}

/**
 * Organic and quote posts with text since `since`, newest first, at
 * most `max`, shaped as decision state.
 */
export function contentItems(
  activities: Activity[],
  sharedPosts: Map<string, object>,
  since: Date,
  max: number,
): DecisionItem[] {
  const items: DecisionItem[] = [];
  for (let i = activities.length - 1; i >= 0 && items.length < max; i--) {
    const activity = activities[i];
    if (!activity || activity.createdAt < since) break;
    if (!isOwnPost(activity.type)) continue;
    const text = (activity.record as { text?: string }).text?.trim();
    if (!text) continue;

    const quotedUri = sharedUri(activity);
    items.push({
      id: activity.uri,
      state: postState(
        text,
        quotedUri ? sharedPosts.get(quotedUri) : undefined,
      ),
    });
  }
  return items;
}

export interface TagSummary {
  /** Items at or above the threshold. */
  count: number;
  /** Items with an answer for this tag. */
  total: number;
  share: number;
  /** Most confident items, highest probability first. */
  examples: { id: string; probability: number }[];
}

/** Share of items each tag applies to, with the clearest examples. */
export function tagSummary(
  answers: Map<string, Record<string, number>>,
  tags: string[],
  threshold = 0.5,
  exampleCount = 5,
): Record<string, TagSummary> {
  return Object.fromEntries(
    tags.map((tag) => {
      const scored = [...answers]
        .map(([id, probabilities]) => ({ id, probability: probabilities[tag] }))
        .filter(
          (s): s is { id: string; probability: number } =>
            s.probability !== undefined && !Number.isNaN(s.probability),
        )
        .sort((a, b) => b.probability - a.probability);
      const count = scored.filter((s) => s.probability >= threshold).length;
      return [
        tag,
        {
          count,
          total: scored.length,
          share: scored.length ? count / scored.length : 0,
          examples: scored
            .slice(0, exampleCount)
            .filter((s) => s.probability >= threshold),
        },
      ];
    }),
  );
}
