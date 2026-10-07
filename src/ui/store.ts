import { Store } from "../store";

let opened: Promise<Store | undefined> | undefined;

/** The page's cache, or undefined when the browser blocks IndexedDB. */
export function pageStore(): Promise<Store | undefined> {
  opened ??= Store.open().catch(() => undefined);
  return opened;
}
