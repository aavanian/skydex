const KEY = "openrouter-api-key";

/**
 * Holds the OpenRouter key: for the browser tab's session by default,
 * or across visits when the viewer chooses to remember it. Falls back
 * to memory when storage is blocked.
 */
export class KeyStore {
  private memory = "";

  constructor(
    private readonly session: Storage | undefined,
    private readonly local: Storage | undefined,
  ) {}

  get(): string {
    return this.read(this.session) || this.read(this.local) || this.memory;
  }

  remembered(): boolean {
    return Boolean(this.read(this.local));
  }

  set(key: string, remember: boolean): void {
    this.memory = key;
    this.write(remember ? this.local : this.session, key);
    this.write(remember ? this.session : this.local, undefined);
  }

  clear(): void {
    this.memory = "";
    this.write(this.session, undefined);
    this.write(this.local, undefined);
  }

  private read(storage: Storage | undefined): string {
    try {
      return storage?.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  }

  private write(storage: Storage | undefined, value: string | undefined) {
    try {
      if (value) storage?.setItem(KEY, value);
      else storage?.removeItem(KEY);
    } catch {
      // Blocked storage: the key lives in memory only.
    }
  }
}
