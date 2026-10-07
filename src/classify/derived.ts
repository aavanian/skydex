type Answers = Map<string, Record<string, number>>;

/**
 * Tags computed from asked ones rather than asked directly. Each holds
 * when all of its parts hold, so its probability is that of the least
 * likely part.
 */
export const DERIVED_TAGS: Record<string, string[]> = {
  political_snark: ["politics", "snark"],
};

/** Adds derived tags to every item's answers. */
export function withDerivedTags(answers: Answers): Answers {
  return new Map(
    [...answers].map(([id, probabilities]) => [
      id,
      {
        ...probabilities,
        ...Object.fromEntries(
          Object.entries(DERIVED_TAGS).map(([tag, parts]) => [
            tag,
            Math.min(...parts.map((p) => probabilities[p] ?? Number.NaN)),
          ]),
        ),
      },
    ]),
  );
}
