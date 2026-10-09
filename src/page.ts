import "./style.css";
import { BOOKMARKLET_HINT, bookmarkletHref } from "./bookmarklet";
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
    alert(BOOKMARKLET_HINT);
  });
}
