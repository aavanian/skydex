import { BlueskyLogin } from "../auth/bluesky-login";
import { errorMessage } from "../errors";
import { h } from "./dom";

/**
 * The Bluesky login, kept in page memory only (never saved), so that it
 * survives rescans and switching views but not closing or reloading
 * the tab. The login library loads only on first use.
 */
export const blueskyLogin = new BlueskyLogin(async (did, popup, signal) => {
  const { logIn } = await import("../auth/session");
  return logIn(did, popup, signal);
});

/**
 * Button to log in as `subject` to unfollow, or to log out. Calls
 * `onChange` whenever unfollowing becomes possible or stops being so.
 */
export function loginControl(
  subject: { did: string; handle: string },
  setStatus: (text: string, isError?: boolean) => void,
  onChange: () => void,
): HTMLElement {
  const login = h("div", { className: "login" });
  function show() {
    if (blueskyLogin.canUnfollow(subject.did)) {
      const out = h(
        "button",
        { type: "button", className: "secondary" },
        "Log out",
      );
      out.addEventListener("click", async () => {
        const ending = blueskyLogin.logOut();
        onChange();
        show();
        await ending;
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
      // Opened synchronously with the click so it is not blocked.
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
        await blueskyLogin.logIn(subject, popup, signal);
        onChange();
      } catch (error) {
        popup.close();
        if (!signal.aborted) {
          setStatus(errorMessage(error), true);
        }
      } finally {
        pending = undefined;
        show();
      }
    });
    login.replaceChildren(button, note);
  }
  show();
  return login;
}
