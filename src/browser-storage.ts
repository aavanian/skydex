/**
 * The browser's local or session storage, or undefined where the browser
 * blocks it (e.g. site data turned off), so callers degrade instead of
 * throwing.
 */
export function browserStorage(
  kind: "localStorage" | "sessionStorage" = "localStorage",
): Storage | undefined {
  try {
    return window[kind];
  } catch {
    return undefined;
  }
}
