import "./style.css";
import { activitiesFromCar } from "./activities";
import { actorFromInput } from "./actor-input";
import { cachedRepo } from "./cached";
import { resolveAccount } from "./repo";
import { routeFrom, searchFor, type Route } from "./route";
import { loadSettings } from "./settings";
import { h } from "./ui/dom";
import { siteFooter } from "./ui/footer";
import { finishLogin } from "./ui/key";
import { renderFollows } from "./ui/follows";
import { introCard } from "./ui/intro";
import { renderProfile } from "./ui/profile";
import { settingsPage } from "./ui/settings";
import { pageStore } from "./ui/store";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app element");

type Mode = Route["mode"];
const FOLLOWS_ACTOR = "follows-actor";

function browserStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function remembered(): string | undefined {
  try {
    return localStorage.getItem(FOLLOWS_ACTOR) || undefined;
  } catch {
    return undefined;
  }
}

function remember(actor: string): void {
  try {
    localStorage.setItem(FOLLOWS_ACTOR, actor);
  } catch {
    // Not remembered: the field simply starts empty next time.
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SetStatus = (text: string, isError?: boolean) => void;

/**
 * One of the page's views. Views stay in the page while hidden, so
 * switching between them keeps what each shows, and keeps the Bluesky
 * login, which lives in page memory.
 */
interface View {
  root: HTMLElement;
  setStatus: SetStatus;
  /** Whether the view has been shown at least once. */
  started: boolean;
  /** The account the view currently shows, if any. */
  actor?: string;
  /** Shows `actor`, or the view's starting state when undefined. */
  load: (actor: string | undefined) => void;
}

function statusLine(): { status: HTMLElement; setStatus: SetStatus } {
  const status = h("p", { className: "status" });
  return {
    status,
    setStatus: (text, isError = false) => {
      status.textContent = text;
      status.classList.toggle("error", isError);
    },
  };
}

async function analyze(
  actor: string,
  results: HTMLElement,
  setStatus: SetStatus,
) {
  results.replaceChildren();
  try {
    setStatus(`Resolving ${actor}…`);
    const account = await resolveAccount(actor);
    setStatus(`Loading @${account.handle}'s history…`);
    const { car, fromCache, savedAt } = await cachedRepo(
      account,
      await pageStore(),
    );
    setStatus("Analyzing…");
    const activities = activitiesFromCar(account.did, car);
    setStatus(
      fromCache
        ? `History from this browser's cache, downloaded ${new Date(savedAt).toLocaleString()}; no newer activity found.`
        : "",
    );
    renderProfile(results, account, activities, loadSettings(browserStorage()));
  } catch (error) {
    setStatus(message(error), true);
  }
}

/** A view with a lookup box: the account profile or the follows scan. */
function lookupView(mode: "actor" | "follows"): View {
  const input = h("input", {
    type: "text",
    name: "actor",
    placeholder:
      mode === "follows"
        ? "Your handle, DID or profile URL"
        : "Handle, DID or profile URL",
    autocomplete: "off",
    spellcheck: false,
  });
  const form = h(
    "form",
    { className: "lookup" },
    input,
    h("button", { type: "submit" }, mode === "follows" ? "Scan" : "Analyze"),
  );
  const { status, setStatus } = statusLine();
  const results = h("div");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const actor = actorFromInput(input.value);
    if (!actor) {
      setStatus(`Not a handle, DID or profile URL: ${input.value}`, true);
      return;
    }
    // Submitting again rescans or reanalyses even the same account.
    view.actor = undefined;
    navigate({ mode, actor });
  });
  const view: View = {
    root: h("div", {}, form, status, results),
    setStatus,
    started: false,
    load(actor) {
      view.actor = actor;
      input.value = actor ?? "";
      setStatus("");
      if (!actor) {
        results.replaceChildren(mode === "actor" ? introCard() : "");
      } else if (mode === "follows") {
        remember(actor);
        const { scanCacheHours } = loadSettings(browserStorage());
        renderFollows(
          results,
          actor,
          setStatus,
          scanCacheHours * 60 * 60 * 1000,
        ).catch((error: unknown) => setStatus(message(error), true));
      } else {
        void analyze(actor, results, setStatus);
      }
    },
  };
  return view;
}

function settingsView(): View {
  const { status, setStatus } = statusLine();
  const content = h("div");
  return {
    root: h("div", {}, status, content),
    setStatus,
    started: false,
    load: () =>
      content.replaceChildren(settingsPage(loadSettings(browserStorage()))),
  };
}

const views: Record<Mode, View> = {
  actor: lookupView("actor"),
  follows: lookupView("follows"),
  settings: settingsView(),
};
const modes = Object.keys(views) as Mode[];

const navLinks: Record<Mode, HTMLAnchorElement> = {
  actor: h("a", { href: "?" }, "Account profile"),
  follows: h("a", { href: "?follows=" }, "Follows scan"),
  settings: h("a", { href: "?settings" }, "Settings"),
};

/** Where a nav link leads: back to what that view last showed. */
function routeOf(mode: Mode): Route {
  if (mode === "settings") return { mode };
  const actor =
    views[mode].actor ?? (mode === "follows" ? remembered() : undefined);
  return actor ? { mode, actor } : { mode };
}

/** Shows the route's view, loading it if it should show something else. */
function show(route: Route) {
  const view = views[route.mode];
  for (const mode of modes) views[mode].root.hidden = mode !== route.mode;
  if (route.mode === "settings") {
    // Re-read each time so the page shows what is saved now.
    view.load(undefined);
  } else {
    const requested =
      route.actor ?? (route.mode === "follows" ? remembered() : undefined);
    // The bookmarklet passes a whole profile or post URL; show the
    // account it names, and its plain form in the address bar.
    const actor = (requested && actorFromInput(requested)) || undefined;
    if (route.actor && actor && actor !== route.actor) {
      history.replaceState(null, "", searchFor({ mode: route.mode, actor }));
    }
    if (!view.started || actor !== view.actor) view.load(actor);
    if (requested && !actor) {
      view.setStatus(`Not a handle, DID or profile URL: ${requested}`, true);
    }
  }
  view.started = true;
  for (const mode of modes) {
    navLinks[mode].href = searchFor(routeOf(mode));
    if (mode === route.mode) {
      navLinks[mode].setAttribute("aria-current", "page");
    } else {
      navLinks[mode].removeAttribute("aria-current");
    }
  }
}

/** Moves to a route, recording it in the browser history. */
function navigate(route: Route) {
  history.pushState(null, "", searchFor(route));
  show(route);
}

for (const mode of modes) {
  navLinks[mode].addEventListener("click", (event) => {
    // Let modified clicks open the view in a new tab as usual.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(routeOf(mode));
  });
}
addEventListener("popstate", () => show(routeFrom(location.search)));

app.replaceChildren(
  h(
    "h1",
    {},
    "Skydex ",
    h("span", { className: "tagline" }, "Bluesky account profiles"),
  ),
  h("nav", { className: "modes" }, ...modes.map((mode) => navLinks[mode])),
  ...modes.map((mode) => views[mode].root),
  siteFooter("./", true),
);
for (const mode of modes) views[mode].root.hidden = true;

finishLogin().then(
  () => show(routeFrom(location.search)),
  (error: unknown) => {
    const { mode } = routeFrom(location.search);
    show({ mode });
    views[mode].setStatus(message(error), true);
  },
);
