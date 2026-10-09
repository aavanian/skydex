import { describe, expect, test } from "vitest";
import { headersFile, pagePolicy } from "../src/hosting";

const directives = (policy: string) => policy.split("; ");

describe("pagePolicy", () => {
  test("runs only the site's own scripts and no plugins", () => {
    expect(directives(pagePolicy())).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "script-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
      ]),
    );
  });
});

describe("headersFile", () => {
  const rules = headersFile().split("\n");
  const header = (name: string) =>
    rules
      .find((line) => line.startsWith(`  ${name}: `))
      ?.slice(name.length + 4);

  test("sends the page policy with framing forbidden", () => {
    expect(directives(header("Content-Security-Policy") ?? "")).toEqual([
      ...directives(pagePolicy()),
      "frame-ancestors 'none'",
    ]);
  });

  test("forbids content sniffing and limits referrers, for every path", () => {
    expect(rules[0]).toBe("/*");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  test("caches content-hashed assets for a year", () => {
    const assets = rules.indexOf("/assets/*");
    expect(rules[assets + 1]).toBe(
      "  Cache-Control: public, max-age=31536000, immutable",
    );
  });
});
