type Answers = Map<string, Record<string, number>>;

const PREFIX = "answers:";

/**
 * Remembers classifier answers per account in browser storage, so the
 * same post is never paid for twice. Answers are keyed by a question
 * set version: editing the questions invalidates them.
 */
export class AnswerCache {
  constructor(
    private readonly storage: Storage | undefined,
    private readonly version: string,
  ) {}

  private key(did: string): string {
    return `${PREFIX}${this.version}:${did}`;
  }

  /** Forgets all remembered answers, for every account and version. */
  static clearAll(storage: Storage | undefined): void {
    try {
      if (!storage) return;
      const keys = Array.from({ length: storage.length }, (_, i) =>
        storage.key(i),
      );
      for (const key of keys) {
        if (key?.startsWith(PREFIX)) storage.removeItem(key);
      }
    } catch {
      // Blocked storage holds nothing to clear.
    }
  }

  load(did: string): Answers {
    try {
      const raw = this.storage?.getItem(this.key(did));
      return new Map(raw ? Object.entries(JSON.parse(raw)) : []);
    } catch {
      return new Map();
    }
  }

  save(did: string, answers: Answers): void {
    try {
      const merged = new Map([...this.load(did), ...answers]);
      this.storage?.setItem(
        this.key(did),
        JSON.stringify(Object.fromEntries(merged)),
      );
    } catch {
      // Storage full or blocked: answers are simply not remembered.
    }
  }
}
