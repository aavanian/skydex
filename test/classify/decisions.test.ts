import { describe, expect, test } from "vitest";
import { decide, type DecisionItem } from "../../src/classify/decisions";

const questions = {
  promotional: {
    type: "noul" as const,
    instructions: "Is `post` promotional?",
  },
  snark: { type: "noul" as const, instructions: "Is `post` snarky?" },
};

const items: DecisionItem[] = [
  { id: "a", state: { post: "buy my book" } },
  { id: "b", state: { post: "lol sure" } },
];

function answer(promotional: number, snark: number, cost = 0.00002) {
  return {
    answers: {
      promotional: { type: "noul", noul: promotional },
      snark: { type: "noul", noul: snark },
    },
    usage: { input_tokens: 500, output_tokens: 0, cost },
  };
}

const options = { apiKey: "sk-test", retryDelayMs: 0 };

describe("decide", () => {
  test("posts each item's state and the questions, and returns probabilities", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      const body = JSON.parse(String(init?.body));
      return Response.json(
        body.state.post === "buy my book"
          ? answer(0.9, 0.1)
          : answer(0.05, 0.8),
      );
    };

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(requests[0]?.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(new Headers(requests[0]?.init?.headers).get("authorization")).toBe(
      "Bearer sk-test",
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      model: "cloudflare/clef-flash",
      state: { post: "buy my book" },
      questions,
    });
    expect(result.answers.get("a")).toEqual({ promotional: 0.9, snark: 0.1 });
    expect(result.answers.get("b")).toEqual({ promotional: 0.05, snark: 0.8 });
    expect(result.cost).toBeCloseTo(0.00004);
    expect(result.failed).toBe(0);
  });

  test("keeps at most `concurrency` requests in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchFn: typeof fetch = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return Response.json(answer(0, 0));
    };
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      state: { post: "x" },
    }));

    await decide(many, questions, { ...options, fetchFn, concurrency: 3 });

    expect(maxInFlight).toBe(3);
  });

  test("retries rate-limited requests", async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () =>
      ++calls === 1
        ? new Response("slow down", { status: 429 })
        : Response.json(answer(0.5, 0.5));

    const result = await decide(items.slice(0, 1), questions, {
      ...options,
      fetchFn,
    });

    expect(calls).toBe(2);
    expect(result.answers.get("a")).toEqual({ promotional: 0.5, snark: 0.5 });
  });

  test("counts items that keep failing without failing the run", async () => {
    const fetchFn: typeof fetch = async (_input, init) =>
      JSON.parse(String(init?.body)).state.post === "lol sure"
        ? new Response("bad", { status: 400 })
        : Response.json(answer(0.9, 0.1));

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.failed).toBe(1);
    expect(result.lastError).toBe("OpenRouter error (400: bad)");
    expect([...result.answers.keys()]).toEqual(["a"]);
  });

  test("stops with OpenRouter's explanation when the key is unknown", async () => {
    const fetchFn: typeof fetch = async () =>
      Response.json(
        { error: { message: "User not found.", code: 401 } },
        { status: 401 },
      );

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.stoppedBy).toBe(
      "OpenRouter did not recognise the API key (401: User not found.)",
    );
  });

  test("stops with OpenRouter's explanation when the request is forbidden", async () => {
    const fetchFn: typeof fetch = async () =>
      Response.json(
        { error: { message: "Model not allowed for this key", code: 403 } },
        { status: 403 },
      );

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.stoppedBy).toBe(
      "OpenRouter refused the request (403: Model not allowed for this key)",
    );
  });

  test("falls back to the raw body when the error is not JSON", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("forbidden by proxy", { status: 403 });

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.stoppedBy).toBe(
      "OpenRouter refused the request (403: forbidden by proxy)",
    );
  });

  test("stops when the account is out of credits", async () => {
    const fetchFn: typeof fetch = async () =>
      Response.json(
        { error: { message: "Insufficient credits", code: 402 } },
        { status: 402 },
      );

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.stoppedBy).toBe(
      "OpenRouter account is out of credits (402: Insufficient credits)",
    );
  });

  test("gives up on an item after 4 attempts at a server error", async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls++;
      return new Response("unavailable", { status: 503 });
    };

    const result = await decide(items.slice(0, 1), questions, {
      ...options,
      fetchFn,
    });

    expect(calls).toBe(4);
    expect(result.failed).toBe(1);
    expect(result.stoppedBy).toBeUndefined();
    expect(result.lastError).toBe("OpenRouter error (503: unavailable)");
  });

  test("keeps the answers received before a stop, and asks nothing more", async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      state: { post: String(i) },
    }));
    let calls = 0;
    const fetchFn: typeof fetch = async () =>
      ++calls === 3
        ? new Response("no credits", { status: 402 })
        : Response.json(answer(0.5, 0.5));

    const result = await decide(many, questions, {
      ...options,
      fetchFn,
      concurrency: 1,
    });

    expect(calls).toBe(3);
    expect([...result.answers.keys()]).toEqual(["0", "1"]);
    expect(result.stoppedBy).toBe(
      "OpenRouter account is out of credits (402: no credits)",
    );
  });

  test("keeps answers to requests already in flight when the run stops", async () => {
    const fetchFn: typeof fetch = async (_input, init) => {
      if (JSON.parse(String(init?.body)).state.post === "lol sure") {
        return new Response("no credits", { status: 402 });
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json(answer(0.9, 0.1));
    };

    const result = await decide(items, questions, { ...options, fetchFn });

    expect(result.stoppedBy).toBeDefined();
    expect(result.answers.get("a")).toEqual({ promotional: 0.9, snark: 0.1 });
  });

  test("reports progress after each item", async () => {
    const progress: number[] = [];
    const fetchFn: typeof fetch = async () => Response.json(answer(0, 0));

    await decide(items, questions, {
      ...options,
      fetchFn,
      onProgress: (done) => progress.push(done),
    });

    expect(progress).toEqual([1, 2]);
  });
});
