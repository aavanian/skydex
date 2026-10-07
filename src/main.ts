import "./style.css";
import { activitiesFromCar } from "./activities";
import { actorFromInput } from "./actor-input";
import { cachedRepo } from "./cached";
import { resolveAccount } from "./repo";
import { loadSettings } from "./settings";
import { h } from "./ui/dom";
import { finishLogin } from "./ui/key";
import { renderFollows } from "./ui/follows";
import { introCard } from "./ui/intro";
import { renderProfile } from "./ui/profile";
import { settingsPage } from "./ui/settings";
import { pageStore } from "./ui/store";

/** Where the source is published, as the AGPL requires for network use. */
const SOURCE_URL = "https://github.com/aavanian/skydex";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app element");

/**
 * Profile of one account, a scan of everyone an account follows, or
 * the settings.
 */
type Mode = "actor" | "follows" | "settings";
const params = new URLSearchParams(location.search);
const mode: Mode = params.has("follows")
  ? "follows"
  : params.has("settings")
    ? "settings"
    : "actor";
const FOLLOWS_ACTOR = "follows-actor";

function browserStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function remembered(): string {
  try {
    return localStorage.getItem(FOLLOWS_ACTOR) ?? "";
  } catch {
    return "";
  }
}

function remember(actor: string): void {
  try {
    localStorage.setItem(FOLLOWS_ACTOR, actor);
  } catch {
    // Not remembered: the field simply starts empty next time.
  }
}

const input = h("input", {
  type: "text",
  name: "actor",
  placeholder: "Handle, DID or profile URL",
  autocomplete: "off",
  spellcheck: false,
});
const form = h(
  "form",
  { className: "lookup" },
  input,
  h("button", { type: "submit" }, mode === "follows" ? "Scan" : "Analyze"),
);
const nav = h(
  "nav",
  { className: "modes" },
  h(
    "a",
    {
      href: "?",
      attrs: mode === "actor" ? { "aria-current": "page" } : {},
    },
    "Account profile",
  ),
  h(
    "a",
    {
      href: `?follows=${encodeURIComponent(remembered())}`,
      attrs: mode === "follows" ? { "aria-current": "page" } : {},
    },
    "Follows scan",
  ),
  h(
    "a",
    {
      href: "?settings",
      attrs: mode === "settings" ? { "aria-current": "page" } : {},
    },
    "Settings",
  ),
);
const status = h("p", { className: "status" });
const results = h("div");

const footer = h(
  "footer",
  { className: "footnote" },
  "Skydex is free software under the ",
  h(
    "a",
    { href: "https://www.gnu.org/licenses/agpl-3.0.html", rel: "noopener" },
    "AGPL-3.0-or-later",
  ),
  ". ",
  h("a", { href: SOURCE_URL, rel: "noopener" }, "Source code"),
  ".",
);

app.replaceChildren(
  h(
    "h1",
    {},
    "Skydex ",
    h("span", { className: "tagline" }, "Bluesky account profiles"),
  ),
  nav,
  ...(mode === "settings" ? [] : [form]),
  status,
  results,
  footer,
);

function setStatus(text: string, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

async function analyze(actor: string) {
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
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function analyzeFromInput(text: string) {
  const actor = actorFromInput(text);
  if (!actor) {
    setStatus(`Not a handle, DID or profile URL: ${text}`, true);
    return;
  }
  input.value = actor;
  const url = new URL(location.href);
  url.searchParams.set(mode, actor);
  history.replaceState(null, "", url);
  if (mode === "follows") {
    remember(actor);
    const { scanCacheHours } = loadSettings(browserStorage());
    renderFollows(
      results,
      actor,
      setStatus,
      scanCacheHours * 60 * 60 * 1000,
    ).catch((error: unknown) =>
      setStatus(error instanceof Error ? error.message : String(error), true),
    );
  } else {
    void analyze(actor);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeFromInput(input.value);
});

const initial = params.get(mode) || (mode === "follows" ? remembered() : "");
if (mode === "follows") input.placeholder = "Your handle, DID or profile URL";
finishLogin().then(
  () => {
    if (mode === "settings") {
      results.replaceChildren(settingsPage(loadSettings(browserStorage())));
    } else if (initial) analyzeFromInput(initial);
    else if (mode === "actor") results.replaceChildren(introCard());
  },
  (error: unknown) => {
    if (initial) input.value = initial;
    setStatus(error instanceof Error ? error.message : String(error), true);
  },
);
