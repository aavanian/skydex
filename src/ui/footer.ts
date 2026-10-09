import { versionUrl } from "../version";
import { h, icon } from "./dom";

/** Where the source is published, as the AGPL requires for network use. */
export const SOURCE_URL = "https://github.com/aavanian/skydex";

/** GitHub's mark, from Octicons (MIT licence). */
const GITHUB_MARK =
  "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z";

function githubIcon(): SVGSVGElement {
  return icon([GITHUB_MARK]);
}

/** The running build's version, linked to its commit or tag. */
function version(): HTMLElement {
  const url = versionUrl(__SKYDEX_VERSION__, SOURCE_URL);
  return url
    ? h(
        "a",
        { href: url, rel: "noopener", title: "Build version" },
        __SKYDEX_VERSION__,
      )
    : h("span", { title: "Build version" }, __SKYDEX_VERSION__);
}

/**
 * Site footer. `root` is the relative path to the app's start page, so
 * that links work from nested pages too. In the app itself, the
 * privacy and guide pages open in a new tab so the app keeps its state.
 */
export function siteFooter(root = "./", newTab = false): HTMLElement {
  const pageLink = (path: string, label: string) =>
    h(
      "a",
      { href: `${root}${path}`, ...(newTab ? { target: "_blank" } : {}) },
      label,
    );
  return h(
    "footer",
    { className: "site-footer footnote" },
    h(
      "span",
      {},
      "Skydex is free software under the ",
      h(
        "a",
        { href: "https://www.gnu.org/licenses/agpl-3.0.html", rel: "noopener" },
        "AGPL-3.0-or-later",
      ),
      " · ",
      pageLink("privacy/", "Privacy"),
      " · ",
      pageLink("guide/", "Guide"),
      " · ",
      pageLink("third-party-licenses.txt", "Third-party licenses"),
    ),
    h(
      "span",
      { className: "source" },
      h("a", { href: SOURCE_URL, rel: "noopener" }, githubIcon(), "Source"),
      " · ",
      version(),
    ),
  );
}
