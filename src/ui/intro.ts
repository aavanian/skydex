import { bookmarkletHref } from "../bookmarklet";
import { h } from "./dom";

/** Shown before any account is chosen: what Skydex does, and the bookmarklet. */
export function introCard(): HTMLElement {
  const appUrl = new URL("./", location.href).href;
  const hint = h("p", { className: "footnote", hidden: true });
  const link = h(
    "a",
    {
      href: bookmarkletHref(appUrl),
      className: "bookmarklet",
      title: "Drag me to your bookmarks bar",
    },
    "Skydex",
  );
  link.addEventListener("click", (event) => {
    event.preventDefault();
    hint.hidden = false;
    hint.textContent =
      "Drag this link to your bookmarks bar rather than clicking it here. Then click the bookmark while viewing a Bluesky profile.";
  });

  return h(
    "section",
    { className: "card" },
    h("h2", {}, "Look up an account"),
    h(
      "p",
      {},
      "Enter a handle, a DID or a profile link to see how the account posts: how much is its own writing, quotes, replies or reposts, whether it went quiet, and what it talks about. Or scan everyone you follow from the Follows scan tab.",
    ),
    h("h3", {}, "Open Skydex from any Bluesky profile"),
    h(
      "p",
      {},
      "Drag ",
      link,
      " to your bookmarks bar. Clicking it on a profile or post page in bsky.app, or any web client with /profile/ links, opens that account in Skydex in a new tab.",
    ),
    hint,
  );
}
