import { describe, expect, test } from "vitest";
import {
  codeChallenge,
  exchangeCode,
  loginUrl,
  returnedLogin,
  savePendingLogin,
  withoutLoginParams,
} from "../../src/classify/openrouter-auth";
import { memoryStorage } from "../support/memory-storage";

describe("OpenRouter login", () => {
  test("derives the S256 code challenge (RFC 7636 appendix B)", async () => {
    expect(
      await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  test("builds the login URL with callback, challenge, state and label", () => {
    const url = new URL(
      loginUrl("https://app.example/?actor=alice.bsky.social", "chal", "st"),
    );

    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      callback_url: "https://app.example/?actor=alice.bsky.social",
      code_challenge: "chal",
      code_challenge_method: "S256",
      state: "st",
      key_label: "Skydex",
    });
  });

  test("exchanges the returned code and verifier for a key", async () => {
    let body: unknown;
    const fetchFn: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://openrouter.ai/api/v1/auth/keys");
      body = JSON.parse(String(init?.body));
      return Response.json({ key: "sk-or-new" });
    };

    expect(await exchangeCode("the-code", "the-verifier", fetchFn)).toBe(
      "sk-or-new",
    );
    expect(body).toEqual({
      code: "the-code",
      code_verifier: "the-verifier",
      code_challenge_method: "S256",
    });
  });

  test("fails clearly when the exchange is refused", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("nope", { status: 400 });

    await expect(exchangeCode("c", "v", fetchFn)).rejects.toThrow(
      "OpenRouter login failed (400)",
    );
  });
});

describe("exchangeCode", () => {
  test("fails clearly when OpenRouter answers without a key", async () => {
    const fetchFn: typeof fetch = async () => Response.json({});

    await expect(exchangeCode("c", "v", fetchFn)).rejects.toThrow(
      "OpenRouter login returned no key",
    );
  });
});

describe("returning from OpenRouter", () => {
  const pending = { state: "st-1", verifier: "ver-1", remember: true };
  const redirect = (state: string) =>
    new URL(`https://app.example/?actor=alice.test&code=c-1&state=${state}`);

  test("accepts the code when the state matches the login started here", () => {
    const storage = memoryStorage();
    savePendingLogin(storage, pending);

    expect(returnedLogin(redirect("st-1"), storage)).toEqual({
      code: "c-1",
      verifier: "ver-1",
      remember: true,
    });
    expect(storage.length).toBe(0);
  });

  test("rejects a code whose state does not match", () => {
    const storage = memoryStorage();
    savePendingLogin(storage, pending);

    expect(() => returnedLogin(redirect("forged"), storage)).toThrow(
      "OpenRouter login could not be verified; try again.",
    );
    expect(storage.length).toBe(0);
  });

  test("rejects a code when no login was started here", () => {
    expect(() => returnedLogin(redirect("st-1"), memoryStorage())).toThrow(
      "OpenRouter login could not be verified; try again.",
    );
    expect(() => returnedLogin(redirect("st-1"), undefined)).toThrow();
  });

  test("ignores addresses that are not a return from OpenRouter", () => {
    expect(
      returnedLogin(new URL("https://app.example/?actor=a"), memoryStorage()),
    ).toBeUndefined();
  });

  test("removes the code and state from the address, keeping the rest", () => {
    expect(withoutLoginParams(redirect("st-1")).toString()).toBe(
      "https://app.example/?actor=alice.test",
    );
  });
});
