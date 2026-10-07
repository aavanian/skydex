const HANDLE =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;

/**
 * Extracts a handle or DID from user input: a bare handle (optionally
 * prefixed with @), a DID, or any web client URL with a
 * `/profile/<actor>` path. Handles are case-insensitive and returned
 * lowercased.
 */
export function actorFromInput(input: string): string | undefined {
  let candidate = input.trim().replace(/^@/, "");
  const profile = candidate.match(/\/profile\/([^/?#]+)/);
  if (profile?.[1]) candidate = decodeURIComponent(profile[1]);
  if (DID.test(candidate)) return candidate;
  const handle = candidate.toLowerCase();
  return HANDLE.test(handle) ? handle : undefined;
}
