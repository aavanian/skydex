import type { Activity } from "../activities";
import { sharedUri } from "../shared";
import type { DecisionItem } from "./decisions";

/**
 * Organic and quote posts with text since `since`, newest first, at
 * most `max`, shaped as decision state. Quote posts carry the quoted
 * text when it could be fetched, since tone often depends on it.
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
    if (activity.type !== "organic" && activity.type !== "quote") continue;
    const text = (activity.record as { text?: string }).text?.trim();
    if (!text) continue;

    const state: { post: string; quoted_post?: string } = { post: text };
    const quotedUri = sharedUri(activity);
    const quoted = quotedUri
      ? (sharedPosts.get(quotedUri) as { text?: string } | undefined)?.text
      : undefined;
    if (quoted) state.quoted_post = quoted;
    items.push({ id: activity.uri, state });
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
