import { describe, expect, test } from "vitest";
import type { Activity } from "../src/activities";
import { followStatus, followSummary } from "../src/follow-status";

describe("followSummary", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const at = (iso: string): Activity => ({
    uri: `at://x/${iso}`,
    type: "organic",
    createdAt: new Date(iso),
    record: {},
  });

  test("the recent rate is exact when the fetched page reaches past 90 days", () => {
    const summary = followSummary(
      {
        activities: [at("2026-05-01T00:00:00Z"), at("2026-09-01T00:00:00Z")],
        complete: false,
      },
      now,
    );

    expect(summary.last).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(summary.recentRateIsMinimum).toBe(false);
  });

  test("the recent rate is a minimum when the whole page is recent but more exists", () => {
    expect(
      followSummary(
        { activities: [at("2026-09-01T00:00:00Z")], complete: false },
        now,
      ).recentRateIsMinimum,
    ).toBe(true);
    expect(
      followSummary(
        { activities: [at("2026-09-01T00:00:00Z")], complete: true },
        now,
      ).recentRateIsMinimum,
    ).toBe(false);
  });
});

describe("followStatus", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const at = (type: Activity["type"], iso: string): Activity => ({
    uri: `at://x/${iso}`,
    type,
    createdAt: new Date(iso),
    record: {},
  });
  const status = (activities: Activity[]) =>
    followStatus(followSummary({ activities, complete: true }, now));

  test("never posted", () => {
    expect(status([])).toBe("never");
  });

  test("dormant after 90 days without any activity", () => {
    expect(status([at("organic", "2026-06-01T00:00:00Z")])).toBe("dormant");
  });

  test("active but without own posts in 90 days", () => {
    expect(
      status([
        at("organic", "2026-05-01T00:00:00Z"),
        at("repost", "2026-09-20T00:00:00Z"),
        at("reply", "2026-09-21T00:00:00Z"),
      ]),
    ).toBe("no-own-posts");
  });

  test("active with recent own posts", () => {
    expect(
      status([
        at("repost", "2026-09-20T00:00:00Z"),
        at("quote", "2026-09-21T00:00:00Z"),
      ]),
    ).toBe("active");
  });
});
