import { expect, test } from "vitest";
import { runPool } from "../src/pool";

test("runs every item with at most `concurrency` in flight", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const seen: number[] = [];

  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    seen.push(n);
    inFlight--;
  });

  expect(maxInFlight).toBe(3);
  expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test("stops taking items and rejects when a task fails", async () => {
  const started: number[] = [];

  await expect(
    runPool([1, 2, 3, 4], 1, async (n) => {
      started.push(n);
      if (n === 2) throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(started).toEqual([1, 2]);
});
