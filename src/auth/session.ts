import { WebcryptoKey } from "@atproto/jwk-webcrypto";
import {
  OAuthClient,
  type OAuthSession,
  type RuntimeImplementation,
} from "@atproto/oauth-client";
import { APPVIEW } from "../repo";
import { waitForCallback } from "./callback-wait";
import { clientMetadataFor } from "./client-metadata";
import { MemoryStore } from "./memory-store";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const runtime: RuntimeImplementation = {
  createKey: (algs) => WebcryptoKey.generate(algs),
  getRandomValues: (length) => crypto.getRandomValues(new Uint8Array(length)),
  digest: async (data, { name }) =>
    new Uint8Array(
      await crypto.subtle.digest(`SHA-${name.slice(3)}`, data as BufferSource),
    ),
  requestLock: (name, fn) =>
    navigator.locks.request(name, { mode: "exclusive" }, async () => fn()),
};

let client: OAuthClient | undefined;

function oauthClient(): OAuthClient {
  client ??= new OAuthClient({
    responseMode: "fragment",
    clientMetadata: clientMetadataFor(new URL(location.href)),
    stateStore: new MemoryStore(),
    sessionStore: new MemoryStore(),
    runtimeImplementation: runtime,
    handleResolver: APPVIEW,
  });
  return client;
}

/**
 * Logs in as `actor` in `popup`, a window the caller opened directly
 * from a click (browsers block popups opened later). Aborting `signal`
 * abandons the attempt, e.g. when the viewer closed the popup. Login state and
 * tokens are kept in this page's memory only: closing or reloading the
 * tab ends the session, and nothing is written to browser storage.
 */
export async function logIn(
  actor: string,
  popup: Window,
  signal: AbortSignal,
): Promise<OAuthSession> {
  try {
    const url = await oauthClient().authorize(actor, { display: "popup" });
    popup.location.href = url.href;
    const params = await waitForCallback(signal, LOGIN_TIMEOUT_MS);
    const { session } = await oauthClient().callback(params);
    return session;
  } finally {
    popup.close();
  }
}

/** Revokes the session on the server; the page forgets it either way. */
export async function logOut(session: OAuthSession): Promise<void> {
  await session.signOut();
}
