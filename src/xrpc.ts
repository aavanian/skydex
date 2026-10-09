/** Address of an XRPC `method` on `base`, with its query parameters. */
export function xrpcUrl(
  base: string,
  method: string,
  params: Record<string, string | string[] | undefined> = {},
): string {
  const url = new URL(`${base}/xrpc/${method}`);
  for (const [name, value] of Object.entries(params)) {
    for (const v of [value ?? []].flat()) url.searchParams.append(name, v);
  }
  return url.toString();
}

/** Fetches and parses a JSON response, failing on a non-OK status. */
export async function getJson<T>(
  fetchFn: typeof fetch,
  url: string,
): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) {
    const { host, pathname } = new URL(url);
    throw new Error(`${response.status} from ${host}${pathname}`);
  }
  return (await response.json()) as T;
}
