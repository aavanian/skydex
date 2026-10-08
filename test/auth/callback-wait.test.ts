import { describe, expect, test } from "vitest";
import { CALLBACK_CHANNEL } from "../../src/auth/channel";
import { waitForCallback } from "../../src/auth/callback-wait";

describe("waitForCallback", () => {
  test("resolves with the parameters the login popup relays", async () => {
    const waiting = waitForCallback(new AbortController().signal, 5000);
    const popup = new BroadcastChannel(CALLBACK_CHANNEL);
    popup.postMessage("state=s&code=c");
    popup.close();

    expect((await waiting).get("code")).toBe("c");
  });

  test("stops waiting when the login is cancelled", async () => {
    const controller = new AbortController();
    const waiting = waitForCallback(controller.signal, 5000);
    controller.abort();

    await expect(waiting).rejects.toThrow("Bluesky login cancelled");
  });

  test("gives up after the timeout", async () => {
    await expect(
      waitForCallback(new AbortController().signal, 10),
    ).rejects.toThrow("Bluesky login timed out");
  });
});
