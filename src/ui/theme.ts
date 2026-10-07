/**
 * Calls `redraw` whenever the system switches between light and dark,
 * until `signal` aborts. Charts read their colours when drawn, so they
 * must be drawn again.
 */
export function onThemeChange(redraw: () => void, signal: AbortSignal): void {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", redraw, { signal });
}
