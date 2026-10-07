import { expect, test } from "vitest";
import { postUri, postUrl } from "../src/links";

test("converts between at:// URIs and bsky.app post links", () => {
  const uri = "at://did:plc:me/app.bsky.feed.post/3abc";
  const url = "https://bsky.app/profile/did:plc:me/post/3abc";

  expect(postUrl(uri)).toBe(url);
  expect(postUri(url)).toBe(uri);
  expect(
    postUri("https://bsky.app/profile/alice.example.com/post/3x?x=1"),
  ).toBe("at://alice.example.com/app.bsky.feed.post/3x");
  expect(postUri("https://bsky.app/profile/alice.example.com")).toBeUndefined();
});
