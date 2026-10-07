import "./style.css";
import { bookmarkletHref } from "./bookmarklet";
import { siteFooter } from "./ui/footer";

// Static pages (privacy, guide) live one folder below the app.
const appUrl = new URL("../", location.href).href;

document.querySelector("main")?.append(siteFooter("../"));

for (const link of document.querySelectorAll<HTMLAnchorElement>(
  "a.bookmarklet",
)) {
  link.href = bookmarkletHref(appUrl);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    alert(
      "Drag this link to your bookmarks bar rather than clicking it here, then click the bookmark while viewing a Bluesky profile.",
    );
  });
}
