import { browserStorage } from "../browser-storage";
import { KeyStore } from "../classify/key-store";
import {
  codeChallenge,
  exchangeCode,
  loginUrl,
  randomToken,
} from "../classify/openrouter-auth";

export const keyStore = new KeyStore(
  browserStorage("sessionStorage"),
  browserStorage("localStorage"),
);

const LOGIN = "openrouter-login";

interface PendingLogin {
  state: string;
  verifier: string;
  remember: boolean;
}

/** Sends the viewer to OpenRouter to approve a key for this page. */
export async function startLogin(remember: boolean): Promise<void> {
  const pending: PendingLogin = {
    state: randomToken(),
    verifier: randomToken(),
    remember,
  };
  browserStorage("sessionStorage")?.setItem(LOGIN, JSON.stringify(pending));
  const callback = new URL(location.href);
  callback.search = "";
  const actor = new URLSearchParams(location.search).get("actor");
  if (actor) callback.searchParams.set("actor", actor);
  location.assign(
    loginUrl(
      callback.toString(),
      await codeChallenge(pending.verifier),
      pending.state,
    ),
  );
}

/**
 * Completes a login if OpenRouter just redirected back here, storing
 * the new key and removing the code from the address bar.
 */
export async function finishLogin(): Promise<void> {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  if (!code) return;
  url.searchParams.delete("code");
  const returnedState = url.searchParams.get("state");
  url.searchParams.delete("state");
  history.replaceState(null, "", url);

  const raw = browserStorage("sessionStorage")?.getItem(LOGIN);
  browserStorage("sessionStorage")?.removeItem(LOGIN);
  const pending = raw ? (JSON.parse(raw) as PendingLogin) : undefined;
  if (!pending || pending.state !== returnedState) {
    throw new Error("OpenRouter login could not be verified; try again.");
  }
  keyStore.set(await exchangeCode(code, pending.verifier), pending.remember);
}
