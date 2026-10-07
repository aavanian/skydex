import { expect, test } from "vitest";
import {
  CONTENT_QUESTIONS,
  questionsVersion,
} from "../../src/classify/questions";

test("the question set version changes whenever a question changes", () => {
  const edited = {
    ...CONTENT_QUESTIONS,
    snark: { type: "noul" as const, instructions: "Is `post` sarcastic?" },
  };

  expect(questionsVersion(CONTENT_QUESTIONS)).toBe(
    questionsVersion({ ...CONTENT_QUESTIONS }),
  );
  expect(questionsVersion(edited)).not.toBe(
    questionsVersion(CONTENT_QUESTIONS),
  );
});
