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

async function getJson<T>(fetchFn: typeof fetch, url: string): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return (await response.json()) as T;
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
      `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(id)}`,
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
  const aka = doc.alsoKnownAs?.find((a) => a.startsWith("at://"));

  return {
    did,
    handle: aka ? aka.slice("at://".length) : did,
    pds: pds.serviceEndpoint.replace(/\/$/, ""),
  };
}

/** Downloads the account's full repository as a CAR file. */
export async function downloadRepo(
  account: Account,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const url = `${account.pds}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(account.did)}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`${response.status} downloading repo`);
  return new Uint8Array(await response.arrayBuffer());
}
