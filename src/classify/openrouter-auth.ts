/**
 * OpenRouter's browser login (OAuth with PKCE): the viewer approves on
 * openrouter.ai, which redirects back with a code that this page
 * exchanges for an API key. No secret ever passes through a server of
 * ours.
 */

const AUTH_URL = "https://openrouter.ai/auth";
const EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";
const KEY_LABEL = "Bluesky account profile";

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
  return ((await response.json()) as { key: string }).key;
}
