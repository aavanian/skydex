/**
 * OpenRouter's browser login (OAuth with PKCE): the viewer approves on
 * openrouter.ai, which redirects back with a code that this page
 * exchanges for an API key. No secret ever passes through a server of
 * ours.
 */

const AUTH_URL = "https://openrouter.ai/auth";
const EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";
const KEY_LABEL = "Skydex";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A random string for PKCE verifiers and login state. */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** S256 code challenge for a PKCE verifier. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

export function loginUrl(
  callbackUrl: string,
  challenge: string,
  state: string,
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("key_label", KEY_LABEL);
  return url.toString();
}

/** Exchanges the code OpenRouter returned for a new API key. */
export async function exchangeCode(
  code: string,
  verifier: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256",
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter login failed (${response.status})`);
  }
  const { key } = (await response.json()) as { key?: unknown };
  if (typeof key !== "string" || !key) {
    throw new Error("OpenRouter login returned no key");
  }
  return key;
}

const PENDING_LOGIN = "openrouter-login";

/** A login sent to OpenRouter, to be checked when it redirects back. */
export interface PendingLogin {
  state: string;
  verifier: string;
  remember: boolean;
}

export function savePendingLogin(
  storage: Storage | undefined,
  pending: PendingLogin,
): void {
  storage?.setItem(PENDING_LOGIN, JSON.stringify(pending));
}

/**
 * The login to complete when `url` is OpenRouter's redirect back, or
 * undefined when it is not. The pending login saved in `storage` is
 * used up either way, and a returned state that does not match it is
 * refused: otherwise a crafted link could plant someone else's key.
 */
export function returnedLogin(
  url: URL,
  storage: Storage | undefined,
): { code: string; verifier: string; remember: boolean } | undefined {
  const code = url.searchParams.get("code");
  if (!code) return undefined;
  const raw = storage?.getItem(PENDING_LOGIN);
  storage?.removeItem(PENDING_LOGIN);
  const pending = raw ? (JSON.parse(raw) as PendingLogin) : undefined;
  if (!pending || pending.state !== url.searchParams.get("state")) {
    throw new Error("OpenRouter login could not be verified; try again.");
  }
  return { code, verifier: pending.verifier, remember: pending.remember };
}

/** `url` without the code and state OpenRouter added to it. */
export function withoutLoginParams(url: URL): URL {
  const clean = new URL(url);
  clean.searchParams.delete("code");
  clean.searchParams.delete("state");
  return clean;
}
