import { expect, test } from "vitest";
import { bookmarkletHref } from "../src/bookmarklet";

function run(href: string, pageUrl: string): string[] {
  expect(href.startsWith("javascript:")).toBe(true);
  const opened: string[] = [];
  const code = decodeURIComponent(href.slice("javascript:".length));
  new Function("location", "open", code)({ href: pageUrl }, (url: string) =>
    opened.push(url),
  );
  return opened;
}

test("opens Skydex in a new tab for the page being viewed", () => {
  const href = bookmarkletHref("https://skydex.avanian.net/");

  expect(
    run(href, "https://bsky.app/profile/alice.bsky.social/post/3abc"),
  ).toEqual([
    "https://skydex.avanian.net/?actor=" +
      encodeURIComponent(
        "https://bsky.app/profile/alice.bsky.social/post/3abc",
      ),
  ]);
});

test("follows the app's own address, e.g. a local development server", () => {
  expect(
    run(
      bookmarkletHref("http://127.0.0.1:5173/"),
      "https://deer.social/profile/did:plc:x",
    ),
  ).toEqual([
    "http://127.0.0.1:5173/?actor=" +
      encodeURIComponent("https://deer.social/profile/did:plc:x"),
  ]);
});
