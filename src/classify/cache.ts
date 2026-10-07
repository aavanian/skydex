type Answers = Map<string, Record<string, number>>;

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
    return `answers:${this.version}:${did}`;
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
