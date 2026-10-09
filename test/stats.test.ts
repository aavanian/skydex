import { describe, expect, test } from "vitest";
import type { Activity } from "../src/activities";
import type { ActivityType } from "../src/taxonomy";
import { daysSince, monthlyMix, summarize } from "../src/stats";

function activity(type: ActivityType, iso: string): Activity {
  return {
    uri: `at://did:plc:me/x/${iso}`,
    type,
    createdAt: new Date(iso),
    record: {},
  };
}

describe("summarize", () => {
  const now = new Date("2025-03-01T00:00:00.000Z");

  test("counts and shares each activity type", () => {
    const summary = summarize(
      [
        activity("organic", "2025-01-01T00:00:00.000Z"),
        activity("organic", "2025-01-02T00:00:00.000Z"),
        activity("quote", "2025-01-03T00:00:00.000Z"),
        activity("repost", "2025-01-04T00:00:00.000Z"),
      ],
      now,
    );

    expect(summary.total).toBe(4);
    expect(summary.counts).toEqual({
      organic: 2,
      quote: 1,
      reply: 0,
      repost: 1,
    });
    expect(summary.shares).toEqual({
      organic: 0.5,
      quote: 0.25,
      reply: 0,
      repost: 0.25,
    });
  });

  test("reports first, last and last organic activity", () => {
    const summary = summarize(
      [
        activity("organic", "2024-06-01T00:00:00.000Z"),
        activity("organic", "2024-12-01T00:00:00.000Z"),
        activity("repost", "2025-02-01T00:00:00.000Z"),
      ],
      now,
    );

    expect(summary.first).toEqual(new Date("2024-06-01T00:00:00.000Z"));
    expect(summary.last).toEqual(new Date("2025-02-01T00:00:00.000Z"));
    expect(summary.lastOrganic).toEqual(new Date("2024-12-01T00:00:00.000Z"));
    expect(summary.daysSinceLast).toBe(28);
  });

  test("averages activities per week from first activity to now", () => {
    const summary = summarize(
      [
        activity("organic", "2025-02-01T00:00:00.000Z"),
        activity("organic", "2025-02-08T00:00:00.000Z"),
      ],
      now,
    );

    expect(summary.perWeek).toBe(0.5);
  });

  test("averages activities per week over the last 90 days", () => {
    const summary = summarize(
      [
        activity("organic", "2024-01-01T00:00:00.000Z"),
        activity("organic", "2025-01-15T00:00:00.000Z"),
        activity("repost", "2025-02-15T00:00:00.000Z"),
      ],
      now,
    );

    expect(summary.recentPerWeek).toBeCloseTo(2 / (90 / 7));
  });

  test("an empty history has zero shares and no dates", () => {
    const summary = summarize([], now);

    expect(summary.total).toBe(0);
    expect(summary.shares.organic).toBe(0);
    expect(summary.first).toBeUndefined();
    expect(summary.last).toBeUndefined();
    expect(summary.daysSinceLast).toBeUndefined();
    expect(summary.perWeek).toBe(0);
    expect(summary.recentPerWeek).toBe(0);
  });
});

describe("monthlyMix", () => {
  test("counts each type per calendar month (UTC)", () => {
    const mix = monthlyMix([
      activity("organic", "2025-01-05T00:00:00.000Z"),
      activity("repost", "2025-01-20T00:00:00.000Z"),
      activity("quote", "2025-02-03T00:00:00.000Z"),
    ]);

    expect(mix).toEqual([
      { month: "2025-01", organic: 1, quote: 0, reply: 0, repost: 1 },
      { month: "2025-02", organic: 0, quote: 1, reply: 0, repost: 0 },
    ]);
  });

  test("includes empty months so dormant periods show as zeros", () => {
    const mix = monthlyMix([
      activity("organic", "2024-11-05T00:00:00.000Z"),
      activity("organic", "2025-02-03T00:00:00.000Z"),
    ]);

    expect(mix.map((m) => m.month)).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
    expect(mix[1]).toEqual({
      month: "2024-12",
      organic: 0,
      quote: 0,
      reply: 0,
      repost: 0,
    });
  });

  test("extends to a given month so recent dormancy shows", () => {
    const mix = monthlyMix(
      [activity("organic", "2024-11-05T00:00:00.000Z")],
      new Date("2025-01-20T00:00:00.000Z"),
    );

    expect(mix.map((m) => m.month)).toEqual(["2024-11", "2024-12", "2025-01"]);
  });

  test("covers activities dated after the given month", () => {
    const mix = monthlyMix(
      [
        activity("organic", "2026-09-05T00:00:00.000Z"),
        activity("reply", "2026-11-02T00:00:00.000Z"),
      ],
      new Date("2026-10-08T00:00:00.000Z"),
    );

    expect(mix.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(mix.at(-1)?.reply).toBe(1);
  });

  test("ends when every activity is after the given month", () => {
    const mix = monthlyMix(
      [activity("organic", "2026-11-02T00:00:00.000Z")],
      new Date("2026-10-08T00:00:00.000Z"),
    );

    expect(mix.map((m) => m.month)).toEqual(["2026-11"]);
  });
});

describe("daysSince", () => {
  test("counts whole days up to now", () => {
    expect(
      daysSince(
        new Date("2026-10-01T12:00:00.000Z"),
        new Date("2026-10-08T00:00:00.000Z"),
      ),
    ).toBe(6);
  });

  test("is 0 for a date after now", () => {
    expect(
      daysSince(
        new Date("2026-11-02T00:00:00.000Z"),
        new Date("2026-10-08T00:00:00.000Z"),
      ),
    ).toBe(0);
  });
});
