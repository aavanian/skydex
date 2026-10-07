/**
 * Client for OpenRouter's Decisions API: a decision model answers
 * typed questions about a piece of state with probabilities instead of
 * generated text. Billed on input tokens only.
 */

const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export const DEFAULT_DECISION_MODEL = "cloudflare/clef-flash";

/** A yes/no question; the answer is the probability of yes. */
export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}

export type Questions = Record<string, NoulQuestion>;

export interface DecisionItem {
  id: string;
  state: object;
}

export interface DecisionOptions {
  apiKey: string;
  model?: string;
  concurrency?: number;
  retryDelayMs?: number;
  fetchFn?: typeof fetch;
  onProgress?: (done: number, total: number) => void;
}

export interface DecisionResult {
  /** Probability of yes per question, by item id. */
  answers: Map<string, Record<string, number>>;
  /** Total cost in USD as reported by OpenRouter. */
  cost: number;
  failed: number;
  /** Explanation of the most recent failure, if any item failed. */
  lastError?: string;
}

interface DecisionResponse {
  answers: Record<string, { noul?: number }>;
  usage?: { cost?: number };
}

const MAX_ATTEMPTS = 4;

class FatalError extends Error {}

/** Status plus OpenRouter's own explanation, e.g. "403: Forbidden model". */
async function errorDetail(response: Response): Promise<string> {
  const body = (await response.text()).trim();
  let message = body;
  try {
    message =
      (JSON.parse(body) as { error?: { message?: string } }).error?.message ??
      body;
  } catch {
    // Not JSON: keep the raw body.
  }
  return message ? `${response.status}: ${message}` : String(response.status);
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function ask(
  item: DecisionItem,
  questions: Questions,
  options: DecisionOptions,
): Promise<DecisionResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  for (let attempt = 1; ; attempt++) {
    const response = await fetchFn(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_DECISION_MODEL,
        state: item.state,
        questions,
      }),
    });
    if (response.ok) return (await response.json()) as DecisionResponse;
    if (response.status === 401) {
      throw new FatalError(
        `OpenRouter did not recognise the API key (${await errorDetail(response)})`,
      );
    }
    if (response.status === 403) {
      throw new FatalError(
        `OpenRouter refused the request (${await errorDetail(response)})`,
      );
    }
    if (response.status === 402) {
      throw new FatalError(
        `OpenRouter account is out of credits (${await errorDetail(response)})`,
      );
    }
    if (!isRetryable(response.status) || attempt >= MAX_ATTEMPTS) {
      throw new Error(`OpenRouter error (${await errorDetail(response)})`);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, (options.retryDelayMs ?? 1000) * attempt),
    );
  }
}

/** Asks the same questions about every item, a few requests at a time. */
export async function decide(
  items: DecisionItem[],
  questions: Questions,
  options: DecisionOptions,
): Promise<DecisionResult> {
  const result: DecisionResult = { answers: new Map(), cost: 0, failed: 0 };
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      if (!item) break;
      try {
        const response = await ask(item, questions, options);
        result.cost += response.usage?.cost ?? 0;
        result.answers.set(
          item.id,
          Object.fromEntries(
            Object.keys(questions).map((name) => [
              name,
              response.answers[name]?.noul ?? Number.NaN,
            ]),
          ),
        );
      } catch (error) {
        if (error instanceof FatalError) throw error;
        result.failed++;
        result.lastError =
          error instanceof Error ? error.message : String(error);
      }
      options.onProgress?.(++done, items.length);
    }
  }

  const workers = Math.min(options.concurrency ?? 8, items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return result;
}
