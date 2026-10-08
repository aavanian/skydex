import { expect, test } from "vitest";
import { versionUrl } from "../src/version";

const repo = "https://github.com/aavanian/skydex";

test.each([
  ["e2dba69", `${repo}/commit/e2dba69`],
  ["e2dba69-dirty", `${repo}/commit/e2dba69`],
  ["v0.1.0", `${repo}/tree/v0.1.0`],
  ["v0.1.0-dirty", `${repo}/tree/v0.1.0`],
  ["v0.1.0-3-ge2dba69", `${repo}/commit/e2dba69`],
  ["v0.1.0-3-ge2dba69-dirty", `${repo}/commit/e2dba69`],
])("%s links to %s", (version, url) => {
  expect(versionUrl(version, repo)).toBe(url);
});

test("an unknown version links nowhere", () => {
  expect(versionUrl("dev", repo)).toBeUndefined();
});
