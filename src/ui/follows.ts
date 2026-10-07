import {
  fetchFollowing,
  fetchRecentActivity,
  followStatus,
  followSummary,
  type Follow,
  type FollowStatus,
  type FollowSummary,
} from "../follows";
import { runPool } from "../pool";
import { RECENT_DAYS } from "../stats";
import { h } from "./dom";

const CONCURRENCY = 6;

type DisplayStatus =
  | FollowStatus
  | NonNullable<Follow["unavailable"]>
  | NonNullable<Follow["block"]>;

const STATUS_LABELS: Record<DisplayStatus, string> = {
  deleted: "Deleted",
  suspended: "Suspended",
  deactivated: "Deactivated",
  "blocks-you": "Blocks you",
  "you-block": "You block them",
  hidden: "Hidden by a block",
  never: "Never posted",
  dormant: "Dormant",
  "no-own-posts": "No own posts lately",
  active: "Active",
};

/** Sort order: gone first, then blocks, then from quietest to active. */
const STATUS_ORDER = Object.keys(STATUS_LABELS) as DisplayStatus[];

const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Row {
  follow: Follow;
  summary?: FollowSummary;
  status?: DisplayStatus;
  failed?: boolean;
  element: HTMLTableRowElement;
}

type SortKey = "account" | "last" | "lastOwn" | "rate" | "organic" | "status";

function sortValue(row: Row, key: SortKey): number | string {
  const s = row.summary;
  switch (key) {
    case "account":
      return row.follow.handle;
    case "last":
      return s?.last?.getTime() ?? 0;
    case "lastOwn":
      return s?.lastOwnPost?.getTime() ?? 0;
    case "rate":
      return s?.recentPerWeek ?? 0;
    case "organic":
      return s?.shares.organic ?? 0;
    case "status":
      return row.status ? STATUS_ORDER.indexOf(row.status) : -1;
  }
}

function dateCell(date: Date | undefined): string {
  return date ? dateFormat.format(date) : "—";
}

function fillRow(row: Row): void {
  const { follow, summary, status } = row;
  const account = h(
    "td",
    {},
    h(
      "a",
      { href: `?actor=${encodeURIComponent(follow.did)}`, target: "_blank" },
      follow.handle === follow.did ? follow.did : `@${follow.handle}`,
    ),
    follow.displayName
      ? h("div", { className: "footnote" }, follow.displayName)
      : undefined,
  );
  if (row.failed) {
    row.element.replaceChildren(
      account,
      h("td", { colSpan: 5, className: "footnote" }, "Could not load"),
    );
    return;
  }
  if (follow.unavailable) {
    row.element.replaceChildren(
      account,
      h("td", { colSpan: 4, className: "footnote" }, "—"),
      h(
        "td",
        { className: "follow-status gone" },
        STATUS_LABELS[follow.unavailable],
      ),
    );
    return;
  }
  if (!summary || !status) {
    row.element.replaceChildren(
      account,
      h("td", { colSpan: 5, className: "footnote" }, "…"),
    );
    return;
  }
  row.element.replaceChildren(
    account,
    h("td", {}, dateCell(summary.last)),
    h("td", {}, dateCell(summary.lastOwnPost)),
    h(
      "td",
      {
        title: summary.recentRateIsMinimum
          ? "At least this: only the latest 100 posts were read"
          : "",
      },
      decimal.format(summary.recentPerWeek) +
        (summary.recentRateIsMinimum ? "+" : ""),
    ),
    h("td", {}, summary.total ? percent.format(summary.shares.organic) : "—"),
    h("td", { className: `follow-status ${status}` }, STATUS_LABELS[status]),
  );
}

/**
 * Renders a table of every account `actor` follows with how recently
 * and how much each posts, to spot accounts that went quiet. Each
 * follow costs one request for its latest 100 activities.
 */
export async function renderFollows(
  root: HTMLElement,
  actor: string,
  setStatus: (text: string, isError?: boolean) => void,
): Promise<void> {
  root.replaceChildren();
  setStatus(
    `Loading who @${actor} follows, and checking unavailable and blocked accounts…`,
  );
  const { subject, follows } = await fetchFollowing(actor);
  const now = new Date();

  const rows: Row[] = follows.map((follow) => {
    const row: Row = {
      follow,
      element: h("tr"),
      status: follow.unavailable,
    };
    fillRow(row);
    return row;
  });
  const tbody = h("tbody", {}, ...rows.map((r) => r.element));

  let sortKey: SortKey = "last";
  let ascending = true;
  const headers: [SortKey, string][] = [
    ["account", "Account"],
    ["last", "Last activity"],
    ["lastOwn", "Last own post"],
    ["rate", `Per week, ${RECENT_DAYS} days`],
    ["organic", "Organic share"],
    ["status", "Status"],
  ];
  const headerRow = h("tr");
  function sort() {
    rows.sort((a, b) => {
      const x = sortValue(a, sortKey);
      const y = sortValue(b, sortKey);
      const order = x < y ? -1 : x > y ? 1 : 0;
      return ascending ? order : -order;
    });
    tbody.replaceChildren(...rows.map((r) => r.element));
    headerRow.replaceChildren(
      ...headers.map(([key, label]) => {
        const button = h(
          "button",
          { type: "button", className: "sort" },
          label + (key === sortKey ? (ascending ? " ▲" : " ▼") : ""),
        );
        button.addEventListener("click", () => {
          ascending = key === sortKey ? !ascending : true;
          sortKey = key;
          sort();
        });
        return h(
          "th",
          {
            attrs: {
              "aria-sort":
                key === sortKey
                  ? ascending
                    ? "ascending"
                    : "descending"
                  : "none",
            },
          },
          button,
        );
      }),
    );
  }
  sort();

  const counts = h("p", { className: "subtitle" });
  function updateCounts() {
    const count = (...statuses: DisplayStatus[]) =>
      rows.filter((r) => r.status && statuses.includes(r.status)).length;
    counts.textContent = [
      `${integer.format(follows.length)} follows`,
      `${integer.format(count("deleted", "suspended", "deactivated"))} gone`,
      `${integer.format(count("blocks-you"))} block you`,
      `${integer.format(count("dormant", "never"))} dormant or never posted`,
      `${integer.format(count("no-own-posts"))} with no own posts in ${RECENT_DAYS} days`,
    ].join(" · ");
  }
  updateCounts();

  root.replaceChildren(
    h(
      "section",
      { className: "card" },
      h("h2", {}, `Who @${subject.handle} follows`),
      counts,
      h(
        "p",
        { className: "footnote" },
        `Based on each account's latest 100 posts, replies and reposts. Dormant: nothing in ${RECENT_DAYS} days. No own posts lately: only reposts or replies in ${RECENT_DAYS} days. Gone: deactivated, suspended or deleted. Hidden by a block: no direct block found, so likely a block list.`,
      ),
      h(
        "div",
        { className: "table-scroll follows" },
        h("table", {}, h("thead", {}, headerRow), tbody),
      ),
    ),
  );

  const active = rows.filter((r) => !r.follow.unavailable);
  let done = 0;
  await runPool(active, CONCURRENCY, async (row) => {
    try {
      const summary = followSummary(
        await fetchRecentActivity(row.follow.did),
        now,
      );
      row.summary = summary;
      row.status = row.follow.block ?? followStatus(summary);
    } catch {
      row.failed = true;
    }
    fillRow(row);
    setStatus(
      `Scanned ${integer.format(++done)} of ${integer.format(active.length)}…`,
    );
  });
  const failed = rows.filter((r) => r.failed).length;
  setStatus(
    failed
      ? `${integer.format(failed)} accounts could not be loaded (possibly rate limited); scan again later for those.`
      : "",
    failed > 0,
  );
  updateCounts();
  sort();
}
