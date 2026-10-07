import { describe, expect, test } from "vitest";
import type { Activity } from "../../src/activities";
import { datasetLines, parseDataset } from "../../src/classify/dataset";

const uri = "at://did:plc:me/app.bsky.feed.post/3abc";
const activity: Activity = {
  uri,
  type: "quote",
  createdAt: new Date("2026-03-01T12:00:00.000Z"),
  record: { text: "lol" },
};

describe("datasetLines", () => {
  test("writes one JSON object per classified post", () => {
    const text = datasetLines(
      [{ id: uri, state: { post: "lol", quoted_post: "a take" } }],
      new Map([[uri, activity]]),
      new Map([[uri, { snark: 0.8, politics: 0.1 }]]),
      { model: "cloudflare/clef-flash", questionsVersion: "v1" },
    );

    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({
      uri,
      url: "https://bsky.app/profile/did:plc:me/post/3abc",
      created_at: "2026-03-01T12:00:00.000Z",
      type: "quote",
      state: { post: "lol", quoted_post: "a take" },
      model: "cloudflare/clef-flash",
      questions_version: "v1",
      answers: { snark: 0.8, politics: 0.1 },
    });
  });

  test("omits answers for posts not yet classified", () => {
    const text = datasetLines(
      [{ id: uri, state: { post: "lol" } }],
      new Map([[uri, activity]]),
      new Map(),
      { model: "m", questionsVersion: "v" },
    );

    expect(JSON.parse(text)).not.toHaveProperty("answers");
  });
});

describe("parseDataset", () => {
  test("reads JSONL, skipping blank lines", () => {
    const lines = parseDataset(
      `{"uri":"at://a","labels":{"snark":true}}\n\n{"uri":"at://b"}\n`,
    );

    expect(lines).toEqual([
      { uri: "at://a", labels: { snark: true } },
      { uri: "at://b" },
    ]);
  });

  test("accepts bsky.app post links in place of at:// URIs", () => {
    expect(
      parseDataset(`{"url":"https://bsky.app/profile/did:plc:me/post/3abc"}`)[0]
        ?.uri,
    ).toBe(uri);
  });

  test("names the line that is not valid JSON", () => {
    expect(() => parseDataset(`{"uri":"at://a"}\n{oops`)).toThrow(
      "Line 2 is not valid JSON",
    );
  });

  test("rejects lines without a post reference", () => {
    expect(() => parseDataset(`{"labels":{}}`)).toThrow(
      "Line 1 has neither uri nor a bsky.app post url",
    );
  });
});
