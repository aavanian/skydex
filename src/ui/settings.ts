import { AnswerCache } from "../classify/cache";
import {
  DEFAULT_SETTINGS,
  MODEL_PATTERN,
  saveSettings,
  SETTING_LIMITS,
  validSettings,
  type IntegerRange,
  type Settings,
} from "../settings";
import { h } from "./dom";
import { pageStore } from "./store";

function browserStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function numberField(
  label: string,
  note: string,
  value: number,
  { min, max }: IntegerRange,
): [HTMLElement, HTMLInputElement] {
  const input = h("input", {
    type: "number",
    min: String(min),
    max: String(max),
    step: "1",
    value: String(value),
    required: true,
  });
  return [
    h(
      "label",
      { className: "setting" },
      h("span", { className: "setting-label" }, label),
      input,
      h("span", { className: "footnote" }, note),
    ),
    input,
  ];
}

/** Settings stored in this browser, and a way to clear cached data. */
export function settingsPage(current: Settings): HTMLElement {
  const [windowField, windowInput] = numberField(
    "Analysis window, months",
    "How far back topics and content tags look.",
    current.windowMonths,
    SETTING_LIMITS.windowMonths,
  );
  const [postsField, postsInput] = numberField(
    "Posts per analysis",
    "Most reposted or quoted posts fetched for topics, and most posts classified.",
    current.maxPosts,
    SETTING_LIMITS.maxPosts,
  );
  const [cacheField, cacheInput] = numberField(
    "Follows scan cache, hours",
    "How long the scan reuses an account's recent activity. 0 always refetches.",
    current.scanCacheHours,
    SETTING_LIMITS.scanCacheHours,
  );
  const modelInput = h("input", {
    type: "text",
    value: current.model,
    spellcheck: false,
    pattern: MODEL_PATTERN,
    required: true,
  });
  const modelField = h(
    "label",
    { className: "setting" },
    h("span", { className: "setting-label" }, "Content tags model"),
    modelInput,
    h(
      "span",
      { className: "footnote" },
      "OpenRouter model answering the content questions through the Decisions API, e.g. cloudflare/clef-flash or typesafe/jev-1.13.",
    ),
  );

  const saved = h("p", { className: "status" });
  const form = h(
    "form",
    { className: "settings" },
    windowField,
    postsField,
    modelField,
    cacheField,
    h(
      "p",
      {},
      h("button", { type: "submit" }, "Save"),
      " ",
      h("button", { type: "reset", className: "secondary" }, "Defaults"),
    ),
    saved,
  );
  function show(settings: Settings) {
    windowInput.value = String(settings.windowMonths);
    postsInput.value = String(settings.maxPosts);
    modelInput.value = settings.model;
    cacheInput.value = String(settings.scanCacheHours);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const settings = validSettings({
      windowMonths: windowInput.valueAsNumber,
      maxPosts: postsInput.valueAsNumber,
      model: modelInput.value.trim(),
      scanCacheHours: cacheInput.valueAsNumber,
    });
    saveSettings(browserStorage(), settings);
    show(settings);
    saved.textContent = "Saved. They apply to the next analysis or scan.";
  });
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    show(DEFAULT_SETTINGS);
    saved.textContent = "Defaults restored; save to keep them.";
  });

  const cleared = h("p", { className: "status" });
  const clear = h(
    "button",
    { type: "button", className: "secondary" },
    "Clear cached data",
  );
  clear.addEventListener("click", async () => {
    clear.disabled = true;
    await (await pageStore())?.clear().catch(() => undefined);
    AnswerCache.clearAll(browserStorage());
    cleared.textContent =
      "Cleared downloaded histories, follows scan data and saved content tags.";
    clear.disabled = false;
  });

  return h(
    "div",
    {},
    h(
      "section",
      { className: "card" },
      h("h2", {}, "Settings"),
      h("p", { className: "subtitle" }, "Kept in this browser only."),
      form,
    ),
    h(
      "section",
      { className: "card" },
      h("h2", {}, "Cached data"),
      h(
        "p",
        { className: "subtitle" },
        "Downloaded account histories, follows scan results and content tags are kept in this browser to make revisits fast and to avoid paying twice for classification. Settings and any remembered OpenRouter key are not affected.",
      ),
      clear,
      cleared,
    ),
  );
}
