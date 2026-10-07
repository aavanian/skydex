/**
 * Runs `task` on every item with at most `concurrency` running at once.
 * The first failure stops new items from starting and rejects.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const item = items[next++] as T;
      try {
        await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
}
