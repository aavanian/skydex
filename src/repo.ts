import { getJson, xrpcUrl } from "./xrpc";

export const APPVIEW = "https://public.api.bsky.app";
const PLC_DIRECTORY = "https://plc.directory";

export interface Account {
  did: string;
  handle: string;
  /** Base URL of the account's personal data server. */
  pds: string;
}

interface DidDocument {
  alsoKnownAs?: string[];
  service?: { id: string; serviceEndpoint: string }[];
}

function didDocumentUrl(did: string): string {
  if (did.startsWith("did:plc:")) return `${PLC_DIRECTORY}/${did}`;
  if (did.startsWith("did:web:")) {
    return `https://${did.slice("did:web:".length)}/.well-known/did.json`;
  }
  throw new Error(`Unsupported DID method: ${did}`);
}

/** Resolves a handle (or passes through a DID) to the account's DID. */
export async function resolveDid(
  actor: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const id = actor.replace(/^@/, "");
  if (id.startsWith("did:")) return id;
  try {
    const { did } = await getJson<{ did: string }>(
      fetchFn,
      xrpcUrl(APPVIEW, "com.atproto.identity.resolveHandle", { handle: id }),
    );
    return did;
  } catch {
    throw new Error(`Could not resolve handle ${id}`);
  }
}

/** Resolves a handle or DID to the account's identity and data server. */
export async function resolveAccount(
  actor: string,
  fetchFn: typeof fetch = fetch,
): Promise<Account> {
  const did = await resolveDid(actor, fetchFn);
  const doc = await getJson<DidDocument>(fetchFn, didDocumentUrl(did));
  const pds = doc.service?.find((s) => s.id.endsWith("#atproto_pds"));
  if (!pds) throw new Error(`No data server listed for ${did}`);

  return {
    did,
    handle: handleIn(doc) ?? did,
    pds: pds.serviceEndpoint.replace(/\/$/, ""),
  };
}

function handleIn(doc: DidDocument): string | undefined {
  return doc.alsoKnownAs
    ?.find((a) => a.startsWith("at://"))
    ?.slice("at://".length);
}

/**
 * The handle a DID document last declared. It stays readable after an
 * account is deactivated or deleted, but the handle may since have been
 * taken by another account.
 */
export async function lastHandle(
  did: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  try {
    return handleIn(await getJson<DidDocument>(fetchFn, didDocumentUrl(did)));
  } catch {
    return undefined;
  }
}

/** Downloads the account's full repository as a CAR file. */
export async function downloadRepo(
  account: Account,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await fetchFn(
    xrpcUrl(account.pds, "com.atproto.sync.getRepo", { did: account.did }),
  );
  if (!response.ok) throw new Error(`${response.status} downloading repo`);
  return new Uint8Array(await response.arrayBuffer());
}
