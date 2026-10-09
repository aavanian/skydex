import { expect, test } from "vitest";
import { errorMessage } from "../src/errors";

test("uses an Error's message, and the text of anything else thrown", () => {
  expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
    "Failed to fetch",
  );
  expect(errorMessage("plain")).toBe("plain");
});
