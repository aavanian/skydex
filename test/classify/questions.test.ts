import { expect, test } from "vitest";
import {
  CONTENT_QUESTIONS,
  questionsVersion,
} from "../../src/classify/questions";

test("the answer version changes whenever a question changes", () => {
  const edited = {
    ...CONTENT_QUESTIONS,
    snark: { type: "noul" as const, instructions: "Is `post` sarcastic?" },
  };

  expect(questionsVersion(CONTENT_QUESTIONS, "m")).toBe(
    questionsVersion({ ...CONTENT_QUESTIONS }, "m"),
  );
  expect(questionsVersion(edited, "m")).not.toBe(
    questionsVersion(CONTENT_QUESTIONS, "m"),
  );
});

test("the answer version changes with the model", () => {
  expect(questionsVersion(CONTENT_QUESTIONS, "cloudflare/clef-flash")).not.toBe(
    questionsVersion(CONTENT_QUESTIONS, "typesafe/jev-1.13"),
  );
});
