/** A store that lives only as long as the page: nothing touches disk. */
export class MemoryStore<K, V> {
  private readonly values = new Map<K, V>();

  get(key: K): V | undefined {
    return this.values.get(key);
  }

  set(key: K, value: V): void {
    this.values.set(key, value);
  }

  del(key: K): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}
