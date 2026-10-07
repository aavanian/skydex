import { describe, expect, test } from "vitest";
import { termsOf, topTerms, type Terms } from "../src/terms";

describe("termsOf", () => {
  test("lowercases words and drops stopwords, short tokens and numbers", () => {
    expect(
      termsOf({
        text: "The Garden is blooming and the BEES are 2 happy in 2025",
      }).words,
    ).toEqual(["garden", "blooming", "bees", "happy"]);
  });

  test("drops French stopwords and keeps accented words", () => {
    expect(
      termsOf({ text: "Les élections sont très importantes pour nous" }).words,
    ).toEqual(["élections", "importantes"]);
  });

  test("strips French elisions", () => {
    expect(termsOf({ text: "L’élection d'aujourd'hui" }).words).toEqual([
      "élection",
      "aujourd'hui",
    ]);
  });

  test("keeps URLs, handles and hashtags out of words", () => {
    expect(
      termsOf({
        text: "read @alice.bsky.social on https://example.com/x #Gardening now",
      }).words,
    ).toEqual(["read"]);
  });

  test("collects hashtags from tag facets and record tags, lowercased and unique", () => {
    const terms = termsOf({
      text: "#Gardening is fun",
      tags: ["Spring", "gardening"],
      facets: [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [
            { $type: "app.bsky.richtext.facet#tag", tag: "Gardening" },
          ],
        },
      ],
    });

    expect(terms.hashtags).toEqual(["gardening", "spring"]);
  });

  test("collects mentioned DIDs from mention facets", () => {
    const terms = termsOf({
      text: "hi @alice.bsky.social",
      facets: [
        {
          index: { byteStart: 3, byteEnd: 21 },
          features: [
            { $type: "app.bsky.richtext.facet#mention", did: "did:plc:alice" },
          ],
        },
      ],
    });

    expect(terms.mentions).toEqual(["did:plc:alice"]);
  });

  test("collects link domains from link facets and external embeds, without www", () => {
    const terms = termsOf({
      text: "see example.com/a",
      facets: [
        {
          index: { byteStart: 4, byteEnd: 17 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://www.example.com/a",
            },
          ],
        },
      ],
      embed: {
        $type: "app.bsky.embed.external",
        external: { uri: "https://news.example.org/story", title: "t" },
      },
    });

    expect(terms.domains).toEqual(["example.com", "news.example.org"]);
  });

  test("finds external links inside record-with-media embeds", () => {
    const terms = termsOf({
      text: "",
      embed: {
        $type: "app.bsky.embed.recordWithMedia",
        record: { record: { uri: "at://x", cid: "y" } },
        media: {
          $type: "app.bsky.embed.external",
          external: { uri: "https://shop.example.net/" },
        },
      },
    });

    expect(terms.domains).toEqual(["shop.example.net"]);
  });

  test("records without text yield empty terms", () => {
    expect(termsOf({})).toEqual({
      words: [],
      hashtags: [],
      mentions: [],
      domains: [],
    });
  });
});

describe("topTerms", () => {
  const bag = (overrides: Partial<Terms>): Terms => ({
    words: [],
    hashtags: [],
    mentions: [],
    domains: [],
    ...overrides,
  });

  test("ranks each kind of term by count, most frequent first", () => {
    const top = topTerms([
      bag({ words: ["garden", "bees", "garden"], hashtags: ["spring"] }),
      bag({ words: ["bees", "garden"], hashtags: ["spring", "diy"] }),
      bag({ domains: ["example.com"], mentions: ["did:plc:a"] }),
    ]);

    expect(top.words).toEqual([
      { term: "garden", count: 3 },
      { term: "bees", count: 2 },
    ]);
    expect(top.hashtags).toEqual([
      { term: "spring", count: 2 },
      { term: "diy", count: 1 },
    ]);
    expect(top.domains).toEqual([{ term: "example.com", count: 1 }]);
    expect(top.mentions).toEqual([{ term: "did:plc:a", count: 1 }]);
  });

  test("breaks ties alphabetically and keeps at most `limit` terms", () => {
    const top = topTerms([bag({ words: ["zebra", "apple", "mango"] })], 2);

    expect(top.words).toEqual([
      { term: "apple", count: 1 },
      { term: "mango", count: 1 },
    ]);
  });
});
