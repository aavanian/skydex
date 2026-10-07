import { describe, expect, test } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  MODEL_PATTERN,
  saveSettings,
  windowStart,
} from "../src/settings";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

test("the analysis window starts the configured number of months before now", () => {
  expect(
    windowStart(
      { ...DEFAULT_SETTINGS, windowMonths: 12 },
      new Date("2026-10-07T12:00:00Z"),
    ),
  ).toEqual(new Date("2025-10-07T12:00:00Z"));
});

describe("settings storage", () => {
  test("defaults when nothing is saved", () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      windowMonths: 12,
      maxPosts: 500,
      model: "cloudflare/clef-flash",
      scanCacheHours: 24,
    });
  });

  test("saves and loads settings", () => {
    const storage = memoryStorage();
    const settings = {
      windowMonths: 6,
      maxPosts: 200,
      model: "typesafe/jev-1.13",
      scanCacheHours: 0,
    };
    saveSettings(storage, settings);

    expect(loadSettings(storage)).toEqual(settings);
  });

  test("replaces invalid or missing values with defaults, keeping valid ones", () => {
    const storage = memoryStorage();
    storage.setItem(
      "skydex-settings",
      JSON.stringify({
        windowMonths: 0,
        maxPosts: 2.5,
        model: "not a model id",
        scanCacheHours: 48,
      }),
    );

    expect(loadSettings(storage)).toEqual({
      ...DEFAULT_SETTINGS,
      scanCacheHours: 48,
    });
  });

  test("survives corrupt or blocked storage", () => {
    const storage = memoryStorage();
    storage.setItem("skydex-settings", "{oops");
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

test("the model pattern also compiles as an HTML input pattern (v flag)", () => {
  const html = new RegExp(`^(?:${MODEL_PATTERN})$`, "v");

  expect(html.test("cloudflare/clef-flash")).toBe(true);
  expect(html.test("typesafe/jev-1.13")).toBe(true);
  expect(html.test("not a model")).toBe(false);
});
