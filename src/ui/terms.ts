import type { Activity } from "../activities";
import { windowStart, type Settings } from "../settings";
import { fetchHandles } from "../appview";
import { termsOf, topTerms, type TermCount, type TopTerms } from "../terms";
import { h } from "./dom";
import { errorMessage } from "../errors";
import { isOwnPost } from "../taxonomy";

const CLOUD_SIZE = 40;
const LIST_SIZE = 10;

const integer = new Intl.NumberFormat();

function cloud(words: TermCount[]): HTMLElement {
  if (!words.length) return h("p", { className: "footnote" }, "No words.");
  const max = words[0]?.count ?? 1;
  const sorted = [...words].sort((a, b) => a.term.localeCompare(b.term));
  return h(
    "ul",
    { className: "cloud", attrs: { "aria-label": "Most used words" } },
    ...sorted.map(({ term, count }) =>
      h(
        "li",
        {
          title: `${term}: ${integer.format(count)}`,
          attrs: {
            style: `font-size: ${(0.8 + 1.4 * Math.sqrt(count / max)).toFixed(2)}em`,
          },
        },
        term,
      ),
    ),
  );
}

function rankedList(
  title: string,
  items: TermCount[],
  label: (term: string) => string = (t) => t,
): HTMLElement {
  return h(
    "div",
    {},
    h("h3", {}, title),
    items.length
      ? h(
          "ol",
          { className: "ranked" },
          ...items
            .slice(0, LIST_SIZE)
            .map(({ term, count }) =>
              h(
                "li",
                {},
                h("span", {}, label(term)),
                h("span", { className: "count" }, integer.format(count)),
              ),
            ),
        )
      : h("p", { className: "footnote" }, "None."),
  );
}

function column(
  title: string,
  note: string,
  top: TopTerms,
  handles: Map<string, string>,
): HTMLElement {
  return h(
    "div",
    { className: "terms-column" },
    h("h3", { className: "column-title" }, title),
    h("p", { className: "footnote" }, note),
    cloud(top.words.slice(0, CLOUD_SIZE)),
    h(
      "div",
      { className: "ranked-grid" },
      rankedList("Hashtags", top.hashtags, (t) => `#${t}`),
      rankedList(
        "Mentions",
        top.mentions,
        (did) => `@${handles.get(did) ?? did}`,
      ),
      rankedList("Linked sites", top.domains),
    ),
  );
}

/**
 * Card comparing what the account writes itself with what it reposts
 * and quotes, over the analysis window. Shared posts arrive after the
 * card is shown.
 */
export function termsCard(
  activities: Activity[],
  sharedPosts: Promise<{ requested: number; posts: Map<string, object> }>,
  now: Date,
  settings: Settings,
): HTMLElement {
  const since = windowStart(settings, now);
  const body = h(
    "div",
    { className: "status" },
    "Fetching reposted and quoted posts…",
  );
  const card = h(
    "section",
    { className: "card" },
    h("h2", {}, "What they talk about"),
    h(
      "p",
      { className: "subtitle" },
      `Last ${settings.windowMonths} months. Own: organic posts and quote commentary. Shared: posts they reposted or quoted. Replies are left out.`,
    ),
    body,
  );

  void (async () => {
    try {
      const recent = activities.filter((a) => a.createdAt >= since);
      const own = recent
        .filter((a) => isOwnPost(a.type))
        .map((a) => termsOf(a.record));
      const { requested, posts } = await sharedPosts;
      const shared = [...posts.values()].map(termsOf);

      const ownTop = topTerms(own);
      const sharedTop = topTerms(shared);
      const dids = [
        ...ownTop.mentions.slice(0, LIST_SIZE),
        ...sharedTop.mentions.slice(0, LIST_SIZE),
      ].map((m) => m.term);
      // Handles only make mentions readable; without them, show DIDs.
      const handles = await fetchHandles([...new Set(dids)]).catch(
        () => new Map<string, string>(),
      );

      const missing = requested - posts.size;
      body.className = "terms-columns";
      body.replaceChildren(
        column("Own", `${integer.format(own.length)} posts`, ownTop, handles),
        column(
          "Shared",
          `${integer.format(posts.size)} posts` +
            (missing
              ? ` (${integer.format(missing)} deleted or unavailable)`
              : "") +
            (requested >= settings.maxPosts
              ? `, capped at the latest ${integer.format(settings.maxPosts)}`
              : ""),
          sharedTop,
          handles,
        ),
      );
    } catch (error) {
      body.className = "status error";
      body.textContent = `Could not load shared posts: ${errorMessage(error)}`;
    }
  })();

  return card;
}
