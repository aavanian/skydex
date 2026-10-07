import { describe, expect, test } from "vitest";
import { scoreTags } from "../../src/classify/benchmark";

describe("scoreTags", () => {
  test("compares answers at the threshold with labels, per tag", () => {
    const scores = scoreTags(
      [
        { labels: { snark: true }, answers: { snark: 0.9 } },
        { labels: { snark: true }, answers: { snark: 0.2 } },
        { labels: { snark: false }, answers: { snark: 0.6 } },
        { labels: { snark: false }, answers: { snark: 0.1 } },
        { labels: { snark: false }, answers: { snark: 0.3 } },
      ],
      ["snark"],
      0.5,
    );

    expect(scores.snark).toEqual({
      labelled: 5,
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 1,
      trueNegatives: 2,
      precision: 0.5,
      recall: 0.5,
      accuracy: 0.6,
    });
  });

  test("only counts posts labelled for the tag and answered", () => {
    const scores = scoreTags(
      [
        { labels: { politics: true }, answers: { snark: 0.9 } },
        { labels: {}, answers: { snark: 0.9 } },
        { labels: { snark: true } },
      ],
      ["snark"],
      0.5,
    );

    expect(scores.snark?.labelled).toBe(0);
    expect(scores.snark?.precision).toBeNaN();
  });
});
