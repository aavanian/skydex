import { CALLBACK_CHANNEL } from "./channel";

/**
 * Waits for the login popup to relay its authorization response. The
 * page cannot tell when the popup is closed (the login server cuts the
 * link between the windows), so waiting ends on cancel or timeout.
 */
export function waitForCallback(
  signal: AbortSignal,
  timeoutMs: number,
): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(CALLBACK_CHANNEL);
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      channel.close();
    };
    const cancel = () => {
      finish();
      reject(new Error("Bluesky login cancelled"));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error("Bluesky login timed out"));
    }, timeoutMs);
    signal.addEventListener("abort", cancel);
    channel.onmessage = ({ data }: MessageEvent<string>) => {
      finish();
      resolve(new URLSearchParams(data));
    };
  });
}
