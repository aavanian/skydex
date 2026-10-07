import { DEFAULT_DECISION_MODEL } from "./classify/decisions";

export interface Settings {
  /** How far back shared posts are fetched and posts are classified. */
  windowMonths: number;
  /** Most posts fetched for the shared column, and most posts classified. */
  maxPosts: number;
  /** OpenRouter decision model classifying content tags. */
  model: string;
  /** How long the follows scan reuses an account's recent activity. */
  scanCacheHours: number;
}

export const DEFAULT_SETTINGS: Settings = {
  windowMonths: 12,
  maxPosts: 500,
  model: DEFAULT_DECISION_MODEL,
  scanCacheHours: 24,
};

const KEY = "skydex-settings";

const isIntegerIn = (min: number, max: number) => (value: unknown) =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

const VALID: { [K in keyof Settings]: (value: unknown) => boolean } = {
  windowMonths: isIntegerIn(1, 120),
  maxPosts: isIntegerIn(1, 5000),
  model: (value) =>
    typeof value === "string" && /^[\w.-]+\/[\w.:-]+$/.test(value),
  scanCacheHours: isIntegerIn(0, 24 * 30),
};

/** Keeps each valid value and falls back to the default for the rest. */
export function validSettings(
  input: Partial<Record<keyof Settings, unknown>>,
): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(VALID) as (keyof Settings)[]) {
    if (VALID[key](input[key])) {
      (settings as Record<keyof Settings, unknown>)[key] = input[key];
    }
  }
  return settings;
}

/** Settings saved in this browser, or the defaults. */
export function loadSettings(storage: Storage | undefined): Settings {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? validSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  storage: Storage | undefined,
  settings: Settings,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(validSettings(settings)));
  } catch {
    // Not saved: the defaults apply on the next visit.
  }
}

/** Start of the analysis window ending at `now`. */
export function windowStart(settings: Settings, now: Date): Date {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - settings.windowMonths);
  return start;
}
