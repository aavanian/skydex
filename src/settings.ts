export interface Settings {
  /** How far back shared posts are fetched and posts are classified. */
  windowMonths: number;
  /** Maximum number of shared posts fetched. */
  maxShared: number;
}

export const DEFAULT_SETTINGS: Settings = { windowMonths: 12, maxShared: 500 };

/** Start of the analysis window ending at `now`. */
export function windowStart(settings: Settings, now: Date): Date {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - settings.windowMonths);
  return start;
}
