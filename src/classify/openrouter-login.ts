import { browserStorage } from "../browser-storage";
import { KeyStore } from "./key-store";
import {
  codeChallenge,
  exchangeCode,
  loginUrl,
  randomToken,
  returnedLogin,
  savePendingLogin,
  withoutLoginParams,
  type PendingLogin,
} from "./openrouter-auth";

export const keyStore = new KeyStore(
  browserStorage("sessionStorage"),
  browserStorage("localStorage"),
);

/** Sends the viewer to OpenRouter to approve a key for this page. */
export async function startLogin(remember: boolean): Promise<void> {
  const pending: PendingLogin = {
    state: randomToken(),
    verifier: randomToken(),
    remember,
  };
  savePendingLogin(browserStorage("sessionStorage"), pending);
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
  if (!url.searchParams.has("code")) return;
  history.replaceState(null, "", withoutLoginParams(url));
  const login = returnedLogin(url, browserStorage("sessionStorage"));
  if (!login) return;
  keyStore.set(await exchangeCode(login.code, login.verifier), login.remember);
}
