import type { Activity } from "../activities";
import { postUri, postUrl } from "../links";
import type { PostState } from "./content";
import type { DecisionItem } from "./decisions";

/**
 * One post in a classification dataset, stored as a JSON line. Exports
 * fill everything but `labels`; a benchmark needs only a post reference
 * and `labels`, fetching the text when `state` is absent.
 */
export interface DatasetLine {
  uri: string;
  url?: string;
  created_at?: string;
  type?: string;
  /** Exactly what the model is shown. */
  state?: PostState;
  model?: string;
  questions_version?: string;
  answers?: Record<string, number>;
  /** Expected answer per tag, added by a person. */
  labels?: Record<string, boolean>;
}

/** Serialises classified posts as JSONL. */
export function datasetLines(
  items: DecisionItem[],
  activities: Map<string, Activity>,
  answers: Map<string, Record<string, number>>,
  meta: { model: string; questionsVersion: string },
): string {
  return items
    .map((item) => {
      const activity = activities.get(item.id);
      const line: DatasetLine = {
        uri: item.id,
        url: postUrl(item.id),
        created_at: activity?.createdAt.toISOString(),
        type: activity?.type,
        state: item.state as DatasetLine["state"],
        model: meta.model,
        questions_version: meta.questionsVersion,
        answers: answers.get(item.id),
      };
      return JSON.stringify(line) + "\n";
    })
    .join("");
}

/** Reads JSONL dataset lines; `url` may stand in for `uri`. */
export function parseDataset(text: string): DatasetLine[] {
  return text.split("\n").flatMap((raw, index) => {
    if (!raw.trim()) return [];
    let line: Partial<DatasetLine>;
    try {
      line = JSON.parse(raw) as Partial<DatasetLine>;
    } catch {
      throw new Error(`Line ${index + 1} is not valid JSON`);
    }
    const uri = line.uri ?? (line.url ? postUri(line.url) : undefined);
    if (!uri) {
      throw new Error(
        `Line ${index + 1} has neither uri nor a bsky.app post url`,
      );
    }
    return [{ ...line, uri }];
  });
}
