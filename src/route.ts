/**
 * Which view the page shows: an account's profile, a scan of everyone
 * an account follows, or the settings; with the account, if any.
 */
export interface Route {
  mode: "actor" | "follows" | "settings";
  actor?: string;
}

/** The route a query string such as `?follows=alice.test` asks for. */
export function routeFrom(search: string): Route {
  const params = new URLSearchParams(search);
  if (params.has("settings")) return { mode: "settings" };
  const mode = params.has("follows") ? "follows" : "actor";
  const actor = params.get(mode);
  return actor ? { mode, actor } : { mode };
}

/** The query string for a route; the inverse of {@link routeFrom}. */
export function searchFor(route: Route): string {
  if (route.mode === "settings") return "?settings";
  if (route.mode === "follows") {
    return `?follows=${route.actor ? encodeURIComponent(route.actor) : ""}`;
  }
  return route.actor ? `?actor=${encodeURIComponent(route.actor)}` : "?";
}
