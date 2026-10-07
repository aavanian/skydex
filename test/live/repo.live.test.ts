import { expect, test } from "vitest";
import { activitiesFromCar } from "../../src/activities";
import { downloadRepo, resolveAccount } from "../../src/repo";
import { summarize } from "../../src/stats";

// Hits the real network; run with `pnpm test:live`.
test("downloads and summarizes a real account", async () => {
  const account = await resolveAccount("bsky.app");
  const activities = activitiesFromCar(
    account.did,
    await downloadRepo(account),
  );
  const summary = summarize(activities, new Date());

  expect(account.handle).toBe("bsky.app");
  expect(summary.total).toBeGreaterThan(100);
  expect(summary.counts.organic).toBeGreaterThan(0);
  expect(summary.counts.repost).toBeGreaterThan(0);
}, 60_000);
