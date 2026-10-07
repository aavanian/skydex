import { expect, test } from "vitest";
import { windowStart } from "../src/settings";

test("the analysis window starts the configured number of months before now", () => {
  expect(
    windowStart(
      { windowMonths: 12, maxShared: 500 },
      new Date("2026-10-07T12:00:00Z"),
    ),
  ).toEqual(new Date("2025-10-07T12:00:00Z"));
});
