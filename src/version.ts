/** Version of a build with no git information. */
export const UNKNOWN_VERSION = "dev";

/**
 * Where a `git describe --tags --always --dirty` version lives on the
 * repository's web page: its commit, or its tag when the build was
 * exactly a tag. `-dirty` (uncommitted changes) is ignored.
 */
export function versionUrl(version: string, repo: string): string | undefined {
  if (version === UNKNOWN_VERSION) return undefined;
  const clean = version.replace(/-dirty$/, "");
  const commit =
    clean.match(/-g([0-9a-f]{7,40})$/)?.[1] ??
    clean.match(/^[0-9a-f]{7,40}$/)?.[0];
  return commit ? `${repo}/commit/${commit}` : `${repo}/tree/${clean}`;
}
