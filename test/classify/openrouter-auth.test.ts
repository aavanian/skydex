import { describe, expect, test } from "vitest";
import {
  codeChallenge,
  exchangeCode,
  loginUrl,
} from "../../src/classify/openrouter-auth";

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
