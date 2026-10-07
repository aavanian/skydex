export interface TagScore {
  /** Posts both labelled for this tag and answered by the model. */
  labelled: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** Of the posts the model tagged, the share that were right. */
  precision: number;
  /** Of the posts that should be tagged, the share the model caught. */
  recall: number;
  accuracy: number;
}

interface Judged {
  labels?: Record<string, boolean>;
  answers?: Record<string, number>;
}

/** Agreement between model answers and human labels, per tag. */
export function scoreTags(
  posts: Judged[],
  tags: string[],
  threshold: number,
): Record<string, TagScore> {
  return Object.fromEntries(
    tags.map((tag) => {
      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;
      for (const { labels, answers } of posts) {
        const expected = labels?.[tag];
        const probability = answers?.[tag];
        if (expected === undefined || probability === undefined) continue;
        if (Number.isNaN(probability)) continue;
        const predicted = probability >= threshold;
        if (predicted && expected) tp++;
        else if (predicted) fp++;
        else if (expected) fn++;
        else tn++;
      }
      const labelled = tp + fp + fn + tn;
      return [
        tag,
        {
          labelled,
          truePositives: tp,
          falsePositives: fp,
          falseNegatives: fn,
          trueNegatives: tn,
          precision: tp / (tp + fp),
          recall: tp / (tp + fn),
          accuracy: (tp + tn) / labelled,
        },
      ];
    }),
  );
}
