import type { Questions } from "./decisions";

/** Display names for each tag, in display order. */
export const TAG_LABELS: Record<string, string> = {
  promotional: "Promotional",
  snark: "Snark",
  politics: "Political",
  political_snark: "Political snark",
};

/**
 * Questions asked about every organic or quote post. The state holds
 * `post` (the account's own text) and, for quotes, `quoted_post`.
 */
export const CONTENT_QUESTIONS: Questions = {
  promotional: {
    type: "noul",
    instructions:
      "Does `post` promote something its author offers or benefits from?",
    criteria: {
      true: "The author advertises their own work, product, service, shop, newsletter, podcast, stream, talk, event, fundraiser or sponsor, or asks people to buy, subscribe, sign up, back or attend it.",
      false:
        "The author shares thoughts, news, jokes or other people's work without promoting something of their own.",
    },
  },
  snark: {
    type: "noul",
    instructions:
      "Is `post` snarky? If `quoted_post` is present, `post` is the author's reaction to it.",
    criteria: {
      true: "The author is sarcastic, mocking, sneering or dismissive toward a person, group or idea.",
      false:
        "The author is sincere, neutral, warm, or makes good-natured jokes that do not mock anyone.",
    },
  },
  politics: {
    type: "noul",
    instructions:
      "Is `post` about politics? If `quoted_post` is present, consider it as context.",
    criteria: {
      true: "It is about government, elections, political parties, politicians, public policy, legislation, or relations between states, in any country.",
      false:
        "It is about other topics, such as technology, science, culture, work or daily life, without discussing politics.",
    },
  },
};

/**
 * Short stable fingerprint of a question set and the model answering
 * it, used to version cached answers.
 */
export function questionsVersion(questions: Questions, model: string): string {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify([model, questions])) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
