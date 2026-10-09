import * as Plot from "@observablehq/plot";
import type { Activity } from "../activities";
import type { Account } from "../repo";
import {
  daysSince,
  monthlyMix,
  RECENT_DAYS,
  summarize,
  type Summary,
} from "../stats";
import { ACTIVITY_TYPES, type ActivityType } from "../taxonomy";
import { cssVar, h } from "./dom";
import { termsCard } from "./terms";
import { onThemeChange } from "./theme";
import { contentCard } from "./content";
import { fetchPosts, sharedUris } from "../shared";
import { windowStart, type Settings } from "../settings";

const TYPE_LABELS: Record<ActivityType, string> = {
  organic: "Organic",
  quote: "Quote",
  reply: "Reply",
  repost: "Repost",
};

const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function typeColors(): string[] {
  return ACTIVITY_TYPES.map((t) => cssVar(`--${t}`));
}

function colorScale() {
  return {
    domain: ACTIVITY_TYPES.map((t) => TYPE_LABELS[t]),
    range: typeColors(),
  };
}

function plotStyle() {
  return { background: "transparent", color: cssVar("--text-secondary") };
}

function legend(): HTMLElement {
  return h(
    "div",
    { className: "legend" },
    ...ACTIVITY_TYPES.map((t) =>
      h("span", { attrs: { style: `--swatch: var(--${t})` } }, TYPE_LABELS[t]),
    ),
  );
}

function tile(label: string, value: string, note?: string): HTMLElement {
  return h(
    "div",
    {},
    h("div", { className: "tile-label" }, label),
    h("div", { className: "tile-value" }, value),
    note ? h("div", { className: "tile-note" }, note) : undefined,
  );
}

function ago(days: number | undefined): string {
  if (days === undefined) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${decimal.format(days / 365)} years ago`;
}

function summaryCard(
  account: Account,
  summary: Summary,
  now: Date,
): HTMLElement {
  const daysSinceOrganic = summary.lastOrganic
    ? daysSince(summary.lastOrganic, now)
    : undefined;
  return h(
    "section",
    { className: "card" },
    h(
      "div",
      { className: "account-name" },
      h(
        "a",
        {
          href: `https://bsky.app/profile/${account.did}`,
          target: "_blank",
          rel: "noopener",
        },
        `@${account.handle}`,
      ),
    ),
    h(
      "div",
      { className: "subtitle" },
      summary.first
        ? `${integer.format(summary.total)} posts and reposts since ${dateFormat.format(summary.first)}`
        : "No posts or reposts",
    ),
    h(
      "div",
      { className: "tiles" },
      tile(
        "Last activity",
        ago(summary.daysSinceLast),
        summary.last && dateFormat.format(summary.last),
      ),
      tile(
        "Last organic post",
        ago(daysSinceOrganic),
        summary.lastOrganic && dateFormat.format(summary.lastOrganic),
      ),
      tile(
        `Per week, last ${RECENT_DAYS} days`,
        decimal.format(summary.recentPerWeek),
        `${decimal.format(summary.perWeek)} on average overall`,
      ),
    ),
    h(
      "div",
      { className: "tiles" },
      ...ACTIVITY_TYPES.map((t) =>
        tile(
          TYPE_LABELS[t],
          percent.format(summary.shares[t]),
          `${integer.format(summary.counts[t])} total`,
        ),
      ),
    ),
  );
}

function mixCard(
  activities: Activity[],
  now: Date,
  signal: AbortSignal,
): HTMLElement {
  const months = monthlyMix(activities, now);
  const rows = months.flatMap((m) =>
    ACTIVITY_TYPES.map((t) => ({
      month: new Date(`${m.month}-01T00:00:00Z`),
      type: TYPE_LABELS[t],
      count: m[t],
    })),
  );

  const chart = h("div", { className: "chart" });
  const countsButton = h("button", { type: "button" }, "Counts");
  const shareButton = h("button", { type: "button" }, "Share");

  let shown: "counts" | "share" = "counts";
  function render(mode: "counts" | "share") {
    shown = mode;
    countsButton.setAttribute("aria-pressed", String(mode === "counts"));
    shareButton.setAttribute("aria-pressed", String(mode === "share"));
    chart.replaceChildren(
      Plot.plot({
        width: chart.clientWidth || 960,
        height: 260,
        marginLeft: 48,
        style: plotStyle(),
        x: { type: "utc", label: null },
        y: {
          label: mode === "share" ? "Share of month" : "Posts per month",
          grid: true,
          tickFormat: mode === "share" ? "%" : undefined,
        },
        color: colorScale(),
        marks: [
          Plot.rectY(rows, {
            x: "month",
            interval: "month",
            y: "count",
            fill: "type",
            offset: mode === "share" ? "normalize" : undefined,
            inset: 0.5,
            tip: true,
            title: (d: { month: Date; type: string; count: number }) =>
              `${d.month.toISOString().slice(0, 7)}\n${d.type}: ${integer.format(d.count)}`,
          }),
          Plot.ruleY([0], { stroke: cssVar("--axis") }),
        ],
      }),
    );
  }
  countsButton.addEventListener("click", () => render("counts"));
  shareButton.addEventListener("click", () => render("share"));
  queueMicrotask(() => render("counts"));
  onThemeChange(() => render(shown), signal);

  const table = h(
    "table",
    {},
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        h("th", {}, "Month"),
        ...ACTIVITY_TYPES.map((t) => h("th", {}, TYPE_LABELS[t])),
      ),
    ),
    h(
      "tbody",
      {},
      ...[...months]
        .reverse()
        .map((m) =>
          h(
            "tr",
            {},
            h("td", {}, m.month),
            ...ACTIVITY_TYPES.map((t) => h("td", {}, integer.format(m[t]))),
          ),
        ),
    ),
  );

  return h(
    "section",
    { className: "card" },
    h(
      "div",
      { className: "chart-header" },
      h(
        "div",
        {},
        h("h2", {}, "Activity mix per month"),
        h(
          "p",
          { className: "subtitle" },
          "Empty months mean the account was dormant.",
        ),
      ),
      h("div", { className: "toggle" }, countsButton, " ", shareButton),
    ),
    legend(),
    chart,
    h(
      "details",
      {},
      h("summary", {}, "Table"),
      h("div", { className: "table-scroll" }, table),
    ),
  );
}

function timelineCard(
  activities: Activity[],
  now: Date,
  signal: AbortSignal,
): HTMLElement {
  const chart = h("div", { className: "chart" });
  const draw = () =>
    chart.replaceChildren(
      Plot.plot({
        width: chart.clientWidth || 960,
        height: 200,
        marginLeft: 64,
        style: plotStyle(),
        x: {
          type: "utc",
          label: null,
          domain: [activities[0]?.createdAt, now],
        },
        y: {
          label: null,
          domain: ACTIVITY_TYPES.map((t) => TYPE_LABELS[t]),
        },
        color: colorScale(),
        marks: [
          Plot.tickX(activities, {
            x: "createdAt",
            y: (a: Activity) => TYPE_LABELS[a.type],
            stroke: (a: Activity) => TYPE_LABELS[a.type],
            strokeOpacity: 0.5,
          }),
        ],
      }),
    );
  queueMicrotask(draw);
  onThemeChange(draw, signal);
  return h(
    "section",
    { className: "card" },
    h("h2", {}, "Every post over time"),
    h(
      "p",
      { className: "subtitle" },
      "One tick per post or repost. Gaps show when the account went quiet.",
    ),
    chart,
  );
}

/** Stops the previous profile's charts from following theme changes. */
let previousProfile: AbortController | undefined;

/** Renders the single-account profile into `root`. */
export function renderProfile(
  root: HTMLElement,
  account: Account,
  activities: Activity[],
  settings: Settings,
  now = new Date(),
): void {
  previousProfile?.abort();
  previousProfile = new AbortController();
  const { signal } = previousProfile;
  const summary = summarize(activities, now);
  const uris = sharedUris(
    activities,
    windowStart(settings, now),
    settings.maxPosts,
  );
  const shared = fetchPosts(uris).then((posts) => ({
    requested: uris.length,
    posts,
  }));
  root.replaceChildren(
    summaryCard(account, summary, now),
    ...(activities.length
      ? [
          mixCard(activities, now, signal),
          timelineCard(activities, now, signal),
          termsCard(activities, shared, now, settings),
          contentCard(
            account,
            activities,
            shared.then((s) => s.posts).catch(() => new Map()),
            now,
            settings,
          ),
        ]
      : []),
  );
}
