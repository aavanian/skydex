/**
 * A bookmarklet that opens Skydex, served at `appUrl`, in a new tab for
 * the page being viewed. Skydex works out the account from the page's
 * address, so it works on any web client with `/profile/<actor>` URLs.
 */
export function bookmarkletHref(appUrl: string): string {
  const target = JSON.stringify(`${appUrl}?actor=`);
  return `javascript:${encodeURIComponent(
    `void open(${target}+encodeURIComponent(location.href))`,
  )}`;
}

/** What to do instead of clicking the bookmarklet on Skydex's own pages. */
export const BOOKMARKLET_HINT =
  "Drag this link to your bookmarks bar rather than clicking it here. Then click the bookmark while viewing a Bluesky profile.";
