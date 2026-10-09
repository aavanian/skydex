/**
 * `fetchFn` cancelled by `signal`: requests in flight are aborted, and
 * none is sent once it has fired.
 */
export function abortableFetch(
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    signal.throwIfAborted();
    return fetchFn(input, { ...init, signal });
  };
}

/** `fn`, turned into a no-op once `signal` has fired. */
export function unlessAborted<A extends unknown[]>(
  signal: AbortSignal,
  fn: (...args: A) => void,
): (...args: A) => void {
  return (...args) => {
    if (!signal.aborted) fn(...args);
  };
}
