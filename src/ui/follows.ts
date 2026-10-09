import { cachedRecentActivity } from "../cached";
import {
  followStatus,
  followSummary,
  type FollowStatus,
  type FollowSummary,
} from "../follow-status";
import { fetchFollowing, type Follow } from "../follows";
import type { OAuthSession } from "@atproto/oauth-client";
import { deleteFollow } from "../auth/unfollow";
import { runPool } from "../pool";
import { RECENT_DAYS } from "../stats";
import { h } from "./dom";
import { pageStore } from "./store";

const CONCURRENCY = 6;

/**
 * The Bluesky login, kept in page memory only (never saved), so that it
 * survives rescans and switching views but not closing or reloading
 * the tab.
 */
let session: OAuthSession | undefined;

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
  unfollowed?: boolean;
  element: HTMLTableRowElement;
  /**
   * Kept across row refreshes so that a pending unfollow confirmation
   * survives scan updates, and only this cell changes when acting.
   */
  actionCell: HTMLTableCellElement;
  /** Holds the actions; its minimum width reserves the column's room. */
  actionSlot: HTMLDivElement;
}

type SortKey =
  "account" | "last" | "lastOwn" | "rate" | "organic" | "repost" | "status";

function sortValue(row: Row, key: SortKey): number | string {
  const s = row.summary;
  switch (key) {
    case "account":
      return row.follow.lastHandle ?? row.follow.handle;
    case "last":
      return s?.last?.getTime() ?? 0;
    case "lastOwn":
      return s?.lastOwnPost?.getTime() ?? 0;
    case "rate":
      return s?.recentPerWeek ?? 0;
    case "organic":
      return s?.shares.organic ?? 0;
    case "repost":
      return s?.shares.repost ?? 0;
    case "status":
      return row.status ? STATUS_ORDER.indexOf(row.status) : -1;
  }
}

/** Rough age of a duration in milliseconds, e.g. "3 hours ago". */
function ago(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function dateCell(date: Date | undefined): string {
  return date ? dateFormat.format(date) : "—";
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** "Opens elsewhere" icon: a box with an arrow leaving its corner. */
function externalIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  for (const d of [
    "M9 2h5v5",
    "M14 2 7 9",
    "M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4",
  ]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function displayName(follow: Follow): string {
  if (follow.lastHandle) return `@${follow.lastHandle}`;
  return follow.handle === follow.did ? follow.did : `@${follow.handle}`;
}

/** Display name with a line-break opportunity after a DID's method prefix. */
function breakableName(follow: Follow): (string | HTMLElement)[] {
  const name = displayName(follow);
  const prefix = name.match(/^did:[a-z]+:/)?.[0];
  return prefix ? [prefix, h("wbr"), name.slice(prefix.length)] : [name];
}

function fillRow(row: Row): void {
  const { follow, summary, status } = row;
  const account = h(
    "td",
    { className: "account" },
    h(
      "a",
      {
        href: `?actor=${encodeURIComponent(follow.did)}`,
        target: "_blank",
        title: follow.lastHandle ? follow.did : "Analyze this account",
      },
      ...breakableName(follow),
    ),
    " ",
    h(
      "a",
      {
        href: `https://bsky.app/profile/${follow.did}`,
        target: "_blank",
        rel: "noopener",
        className: "external",
        title: "Open on bsky.app",
        attrs: { "aria-label": `Open ${displayName(follow)} on bsky.app` },
      },
      externalIcon(),
    ),
    follow.lastHandle
      ? h("div", { className: "footnote" }, "last known handle")
      : follow.displayName
        ? h("div", { className: "footnote" }, follow.displayName)
        : undefined,
  );
  if (row.failed) {
    row.element.replaceChildren(
      account,
      h("td", { colSpan: 6, className: "footnote" }, "Could not load"),
      row.actionCell,
    );
    return;
  }
  if (follow.unavailable) {
    row.element.replaceChildren(
      account,
      ...[1, 2, 3, 4, 5].map(() => h("td", {}, "—")),
      h(
        "td",
        { className: "follow-status gone" },
        STATUS_LABELS[follow.unavailable],
      ),
      row.actionCell,
    );
    return;
  }
  if (!summary || !status) {
    row.element.replaceChildren(
      account,
      h("td", { colSpan: 6, className: "footnote" }, "…"),
      row.actionCell,
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
    h("td", {}, summary.total ? percent.format(summary.shares.repost) : "—"),
    h("td", { className: `follow-status ${status}` }, STATUS_LABELS[status]),
    row.actionCell,
  );
}

/**
 * Renders a table of every account `actor` follows with how recently
 * and how much each posts, to spot accounts that went quiet. Each
 * follow costs one request for its latest 100 activities, unless this
 * browser fetched it less than `maxAgeMs` ago.
 */
export async function renderFollows(
  root: HTMLElement,
  actor: string,
  setStatus: (text: string, isError?: boolean) => void,
  maxAgeMs: number,
): Promise<void> {
  root.replaceChildren();
  setStatus(
    `Loading who @${actor} follows, and checking unavailable and blocked accounts…`,
  );
  const { subject, follows } = await fetchFollowing(actor);
  const now = new Date();
  const loggedIn = () => session?.did === subject.did;

  /** Shows what can be done with a row: nothing, unfollow, or confirm. */
  function renderAction(row: Row): void {
    const cell = row.actionSlot;
    const uri = row.follow.followUri;
    if (row.unfollowed) {
      cell.replaceChildren(
        h("span", { className: "follow-status" }, "Unfollowed"),
      );
      return;
    }
    if (!loggedIn() || !uri) {
      cell.replaceChildren();
      return;
    }
    const unfollow = h(
      "button",
      { type: "button", className: "secondary unfollow" },
      "Unfollow",
    );
    unfollow.addEventListener("click", () => {
      const confirmButton = h(
        "button",
        {
          type: "button",
          className: "unfollow",
          title: `Unfollow ${displayName(row.follow)}`,
        },
        "Confirm",
      );
      const cancel = h(
        "button",
        { type: "button", className: "secondary unfollow" },
        "Cancel",
      );
      cancel.addEventListener("click", () => renderAction(row));
      confirmButton.addEventListener("click", async () => {
        if (!session || !loggedIn()) return renderAction(row);
        confirmButton.disabled = true;
        cancel.disabled = true;
        try {
          await deleteFollow(session.fetchHandler.bind(session), uri);
          row.unfollowed = true;
          renderAction(row);
          updateCounts();
        } catch (error) {
          renderAction(row);
          setStatus(
            error instanceof Error ? error.message : String(error),
            true,
          );
        }
      });
      cell.replaceChildren(confirmButton, " ", cancel);
      confirmButton.focus();
    });
    cell.replaceChildren(unfollow);
  }

  const rows: Row[] = follows.map((follow) => {
    const row: Row = {
      follow,
      element: h("tr"),
      actionCell: h("td", { className: "action" }),
      actionSlot: h("div", { className: "action-slot" }),
      status: follow.unavailable,
    };
    row.actionCell.append(row.actionSlot);
    fillRow(row);
    return row;
  });
  const tbody = h("tbody", {}, ...rows.map((r) => r.element));
  const headerRow = h("tr");
  const table = h("table", {}, h("thead", {}, headerRow), tbody);

  let sortKey: SortKey = "last";
  let ascending = true;
  const headers: [SortKey, string][] = [
    ["account", "Account"],
    ["last", "Last activity"],
    ["lastOwn", "Last own post"],
    ["rate", `Per week, ${RECENT_DAYS} days`],
    ["organic", "Organic share"],
    ["repost", "Repost share"],
    ["status", "Status"],
  ];
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
      h("th", {}, ""),
    );
  }
  sort();

  const counts = h("p", { className: "subtitle" });
  const freshness = h("p", { className: "footnote" });
  function updateCounts() {
    const following = rows.filter((r) => !r.unfollowed);
    const count = (...statuses: DisplayStatus[]) =>
      following.filter((r) => r.status && statuses.includes(r.status)).length;
    const unfollowed = rows.length - following.length;
    counts.textContent = [
      `${integer.format(following.length)} follows`,
      ...(unfollowed ? [`${integer.format(unfollowed)} unfollowed`] : []),
      `${integer.format(count("deleted", "suspended", "deactivated"))} gone`,
      `${integer.format(count("blocks-you"))} block you`,
      `${integer.format(count("dormant", "never"))} dormant or never posted`,
      `${integer.format(count("no-own-posts"))} with no own posts in ${RECENT_DAYS} days`,
    ].join(" · ");
  }
  updateCounts();

  const login = h("div", { className: "login" });
  function showLogin() {
    if (session && loggedIn()) {
      const out = h(
        "button",
        { type: "button", className: "secondary" },
        "Log out",
      );
      out.addEventListener("click", async () => {
        const ending = session;
        session = undefined;
        table.classList.remove("can-unfollow");
        rows.forEach(renderAction);
        showLogin();
        if (ending) {
          const { logOut } = await import("../auth/session");
          await logOut(ending).catch(() => undefined);
        }
      });
      login.replaceChildren(
        h(
          "span",
          { className: "footnote" },
          `Logged in as @${subject.handle}. `,
        ),
        out,
      );
      return;
    }
    let pending: AbortController | undefined;
    const button = h(
      "button",
      { type: "button", className: "secondary" },
      `Log in as @${subject.handle} to unfollow`,
    );
    const note = h(
      "span",
      { className: "footnote" },
      " Asks only for permission to delete follows. The login lasts until this tab is closed or reloaded and is never saved.",
    );
    button.addEventListener("click", async () => {
      // Skydex cannot see the popup being closed (the login server cuts
      // the link between the windows), so while waiting the button
      // cancels instead.
      if (pending) return pending.abort();
      // Opened synchronously with the click so it is not blocked; the
      // login library loads only now, on first use.
      const popup = window.open(
        "about:blank",
        "bsky-login",
        "width=600,height=700",
      );
      if (!popup) {
        setStatus("Allow popups for this page to log in", true);
        return;
      }
      pending = new AbortController();
      const { signal } = pending;
      button.textContent = "Cancel login";
      note.textContent =
        " Finish logging in in the popup. Closed it without logging in? Cancel here.";
      try {
        const { logIn, logOut } = await import("../auth/session");
        const started = await logIn(subject.did, popup, signal);
        if (started.did !== subject.did) {
          await logOut(started).catch(() => undefined);
          throw new Error(
            `Log in as @${subject.handle} to unfollow from this list`,
          );
        }
        session = started;
        table.classList.add("can-unfollow");
        rows.forEach(renderAction);
      } catch (error) {
        popup.close();
        if (!signal.aborted) {
          setStatus(
            error instanceof Error ? error.message : String(error),
            true,
          );
        }
      } finally {
        pending = undefined;
        showLogin();
      }
    });
    login.replaceChildren(button, note);
  }
  showLogin();
  if (loggedIn()) {
    table.classList.add("can-unfollow");
    rows.forEach(renderAction);
  }

  root.replaceChildren(
    h(
      "section",
      { className: "card" },
      h("h2", {}, `Who @${subject.handle} follows`),
      counts,
      freshness,
      login,
      h(
        "p",
        { className: "footnote" },
        `Based on each account's latest 100 posts, replies and reposts. Dormant: nothing in ${RECENT_DAYS} days. No own posts lately: only reposts or replies in ${RECENT_DAYS} days. Gone: deactivated, suspended or deleted. Hidden by a block: no direct block found, so likely a block list.`,
      ),
      h("div", { className: "table-scroll follows" }, table),
    ),
  );

  const active = rows.filter((r) => !r.follow.unavailable);
  const store = await pageStore();
  let done = 0;
  let fromCache = 0;
  let oldest = now.getTime();
  await runPool(active, CONCURRENCY, async (row) => {
    try {
      const cached = await cachedRecentActivity(
        row.follow.did,
        store,
        maxAgeMs,
        now.getTime(),
      );
      if (cached.fromCache) {
        fromCache++;
        oldest = Math.min(oldest, cached.savedAt);
      }
      const summary = followSummary(cached.recent, now);
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
  const rescan = h(
    "button",
    { type: "button", className: "secondary rescan" },
    "Rescan activity",
  );
  rescan.title =
    "Fetch every account's latest activity again, ignoring this browser's cache";
  rescan.addEventListener("click", () => {
    renderFollows(root, actor, setStatus, 0).catch((error: unknown) =>
      setStatus(error instanceof Error ? error.message : String(error), true),
    );
  });
  freshness.replaceChildren(
    fromCache
      ? `Activity of ${integer.format(fromCache)} of ${integer.format(active.length)} accounts comes from this browser's cache, the oldest from ${ago(now.getTime() - oldest)}. `
      : "Activity fetched just now. ",
    rescan,
  );
  updateCounts();
  sort();
}
