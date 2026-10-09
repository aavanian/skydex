const HANDLE =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;

/**
 * Extracts a handle or DID from user input: a bare handle (optionally
 * prefixed with @), a DID, or any web client URL with a
 * `/profile/<actor>` path. Handles are case-insensitive and returned
 * lowercased. Returns undefined for anything else, including a profile
 * path with broken percent-encoding.
 */
export function actorFromInput(input: string): string | undefined {
  let candidate = input.trim().replace(/^@/, "");
  const profile = candidate.match(/\/profile\/([^/?#]+)/);
  if (profile?.[1]) {
    try {
      candidate = decodeURIComponent(profile[1]);
    } catch {
      return undefined;
    }
  }
  if (DID.test(candidate)) return candidate;
  const handle = candidate.toLowerCase();
  return HANDLE.test(handle) ? handle : undefined;
}
