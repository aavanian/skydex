import { describe, expect, test } from "vitest";
import { abortableFetch, unlessAborted } from "../src/abort";

describe("abortableFetch", () => {
  test("passes the signal with each request", async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | null | undefined)[] = [];
    const fetchFn: typeof fetch = async (_input, init) => {
      signals.push(init?.signal);
      return new Response("ok");
    };

    await abortableFetch(controller.signal, fetchFn)("https://x.example/", {
      method: "POST",
    });

    expect(signals).toEqual([controller.signal]);
  });

  test("sends nothing once aborted", async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls++;
      return new Response("ok");
    };
    controller.abort();

    await expect(
      abortableFetch(controller.signal, fetchFn)("https://x.example/"),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

describe("unlessAborted", () => {
  test("forwards calls until the signal aborts", () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const say = unlessAborted(controller.signal, (text: string) => {
      seen.push(text);
    });

    say("first");
    controller.abort();
    say("late");

    expect(seen).toEqual(["first"]);
  });
});
