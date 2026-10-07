import { expect, test } from "vitest";
import { withDerivedTags } from "../../src/classify/derived";

test("political snark is as likely as the less likely of politics and snark", () => {
  const answers = new Map([
    ["a", { politics: 0.9, snark: 0.7, promotional: 0.1 }],
    ["b", { politics: 0.2, snark: 0.95, promotional: 0.1 }],
  ]);

  const derived = withDerivedTags(answers);

  expect(derived.get("a")).toEqual({
    politics: 0.9,
    snark: 0.7,
    promotional: 0.1,
    political_snark: 0.7,
  });
  expect(derived.get("b")?.political_snark).toBe(0.2);
});

test("a derived tag is unknown when one of its parts is missing", () => {
  const derived = withDerivedTags(new Map([["a", { politics: 0.9 }]]));

  expect(derived.get("a")?.political_snark).toBeNaN();
});
