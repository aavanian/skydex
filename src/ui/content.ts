import type { Activity } from "../activities";
import { AnswerCache } from "../classify/cache";
import { contentItems, tagSummary } from "../classify/content";
import { datasetLines } from "../classify/dataset";
import { withDerivedTags } from "../classify/derived";
import { decide } from "../classify/decisions";
import {
  CONTENT_QUESTIONS,
  questionsVersion,
  TAG_LABELS,
} from "../classify/questions";
import type { Account } from "../repo";
import { windowStart, type Settings } from "../settings";
import { postUrl } from "../links";
import { h } from "./dom";
import { keyStore, startLogin } from "./key";

const THRESHOLD = 0.5;

const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat();
const usd = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

function browserStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function results(
  answers: Map<string, Record<string, number>>,
  texts: Map<string, string>,
): HTMLElement {
  const tags = Object.keys(TAG_LABELS);
  const summary = tagSummary(withDerivedTags(answers), tags, THRESHOLD, 5);
  return h(
    "div",
    { className: "tags" },
    ...tags.map((tag) => {
      const s = summary[tag];
      if (!s) return undefined;
      return h(
        "div",
        { className: "tag" },
        h("div", { className: "tile-label" }, TAG_LABELS[tag] ?? tag),
        h("div", { className: "tile-value" }, percent.format(s.share)),
        h(
          "div",
          { className: "tile-note" },
          `${integer.format(s.count)} of ${integer.format(s.total)} posts`,
        ),
        s.examples.length
          ? h(
              "details",
              {},
              h("summary", {}, "Clearest examples"),
              h(
                "ul",
                { className: "examples" },
                ...s.examples.map((e) =>
                  h(
                    "li",
                    {},
                    h(
                      "a",
                      {
                        href: postUrl(e.id),
                        target: "_blank",
                        rel: "noopener",
                      },
                      texts.get(e.id) ?? e.id,
                    ),
                    h(
                      "span",
                      { className: "count" },
                      ` ${percent.format(e.probability)}`,
                    ),
                  ),
                ),
              ),
            )
          : undefined,
      );
    }),
  );
}

/**
 * Card tagging the account's own posts as promotional, snarky or
 * political, using a decision model through the viewer's own
 * OpenRouter key. Nothing is sent until the viewer asks.
 */
export function contentCard(
  account: Account,
  activities: Activity[],
  sharedPosts: Promise<Map<string, object>>,
  now: Date,
  settings: Settings,
): HTMLElement {
  const version = questionsVersion(CONTENT_QUESTIONS, settings.model);
  const cache = new AnswerCache(browserStorage(), version);
  const since = windowStart(settings, now);
  const body = h("div");
  const card = h(
    "section",
    { className: "card" },
    h(
      "h2",
      {},
      "Content tags ",
      h(
        "span",
        {
          className: "badge",
          title: "Model answers are not yet benchmarked; read them as hints.",
        },
        "Experimental",
      ),
    ),
    h(
      "p",
      { className: "subtitle" },
      `Organic and quote posts from the last ${settings.windowMonths} months, up to ${integer.format(settings.maxPosts)}, classified by the ${settings.model} decision model on OpenRouter. A post counts when the model gives it ${percent.format(THRESHOLD)} or more.`,
    ),
    body,
  );

  function keyForm() {
    const remember = h("input", { type: "checkbox" });
    const login = h("button", { type: "button" }, "Log in with OpenRouter");
    login.addEventListener("click", () => void startLogin(remember.checked));
    const input = h("input", {
      type: "password",
      placeholder: "or paste an OpenRouter API key",
      autocomplete: "off",
    });
    const form = h(
      "form",
      { className: "lookup" },
      input,
      h("button", { type: "submit", className: "secondary" }, "Use key"),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      keyStore.set(input.value.trim(), remember.checked);
      void show();
    });
    body.replaceChildren(
      h("p", {}, login),
      form,
      h(
        "label",
        { className: "footnote" },
        remember,
        " Remember the key on this device (otherwise it is forgotten when the tab closes)",
      ),
      h(
        "p",
        { className: "footnote" },
        "The key stays in this browser and is only sent to openrouter.ai. Give it a small credit limit in your ",
        h(
          "a",
          {
            href: "https://openrouter.ai/settings/keys",
            target: "_blank",
            rel: "noopener",
          },
          "OpenRouter key settings",
        ),
        ": if it ever leaked, that limit is all it could spend. At the documented price, classifying 500 posts should cost a few cents.",
      ),
    );
  }

  async function show() {
    const key = keyStore.get();
    if (!key) return keyForm();

    body.replaceChildren(h("p", { className: "status" }, "Preparing posts…"));
    const items = contentItems(
      activities,
      await sharedPosts,
      since,
      settings.maxPosts,
    );
    const texts = new Map(
      items.map((i) => [i.id, (i.state as { post: string }).post]),
    );
    const cached = cache.load(account.did);
    const pending = items.filter((i) => !cached.has(i.id));
    const known = new Map(
      items.flatMap((i) => {
        const answer = cached.get(i.id);
        return answer ? [[i.id, answer] as const] : [];
      }),
    );

    const status = h("p", { className: "status" });
    const run = h(
      "button",
      { type: "button" },
      `Classify ${integer.format(pending.length)} posts`,
    );
    const forget = h(
      "button",
      { type: "button", className: "secondary" },
      "Forget key",
    );
    forget.addEventListener("click", () => {
      keyStore.clear();
      keyForm();
    });
    const download = h(
      "button",
      { type: "button", className: "secondary" },
      "Download dataset",
    );
    download.addEventListener("click", () => {
      const jsonl = datasetLines(
        items,
        new Map(activities.map((a) => [a.uri, a])),
        withDerivedTags(known),
        { model: settings.model, questionsVersion: version },
      );
      const link = h("a", {
        href: URL.createObjectURL(
          new Blob([jsonl], { type: "application/x-ndjson" }),
        ),
        download: `${account.handle}-posts.jsonl`,
      });
      link.click();
      URL.revokeObjectURL(link.href);
    });
    const output = h("div");
    if (known.size) output.replaceChildren(results(known, texts));

    status.textContent =
      (pending.length
        ? `${integer.format(pending.length)} posts not yet classified` +
          (known.size ? `, ${integer.format(known.size)} remembered.` : ".")
        : `All ${integer.format(items.length)} posts already classified.`) +
      (keyStore.remembered()
        ? " Key remembered on this device."
        : " Key kept until this tab closes.");

    run.addEventListener("click", async () => {
      run.disabled = true;
      status.className = "status";
      try {
        const result = await decide(
          pending.filter((i) => !known.has(i.id)),
          CONTENT_QUESTIONS,
          {
            apiKey: key,
            model: settings.model,
            onProgress: (done, total) => {
              status.textContent = `Classified ${integer.format(done)} of ${integer.format(total)}…`;
            },
          },
        );
        cache.save(account.did, result.answers);
        for (const [id, answer] of result.answers) known.set(id, answer);
        if (known.size) output.replaceChildren(results(known, texts));
        if (result.stoppedBy) {
          const left = pending.filter((i) => !known.has(i.id)).length;
          status.className = "status error";
          status.textContent = `${result.stoppedBy}. Spent ${usd.format(result.cost)}; answers so far are kept.`;
          run.textContent = `Classify ${integer.format(left)} posts`;
          run.disabled = false;
          return;
        }
        status.textContent =
          `Done for ${usd.format(result.cost)}.` +
          (result.failed
            ? ` ${integer.format(result.failed)} posts failed (${result.lastError}); run again to retry them.`
            : "");
        run.remove();
      } catch (error) {
        status.className = "status error";
        status.textContent =
          error instanceof Error ? error.message : String(error);
        run.disabled = false;
      }
    });

    body.replaceChildren(
      h(
        "div",
        { className: "chart-header" },
        status,
        h(
          "div",
          { className: "toggle" },
          pending.length ? run : undefined,
          " ",
          download,
          " ",
          forget,
        ),
      ),
      output,
    );
  }

  void show();
  return card;
}
