import { describe, expect, test } from "vitest";
import { deleteFollow } from "../../src/auth/unfollow";

describe("deleteFollow", () => {
  test("deletes the follow record through the session", async () => {
    const calls: { path: string; init?: RequestInit }[] = [];
    const fetchHandler = async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return Response.json({});
    };

    await deleteFollow(
      fetchHandler,
      "at://did:plc:me/app.bsky.graph.follow/3abc",
    );

    expect(calls[0]?.path).toBe("/xrpc/com.atproto.repo.deleteRecord");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      repo: "did:plc:me",
      collection: "app.bsky.graph.follow",
      rkey: "3abc",
    });
  });

  test("refuses anything but a follow record", async () => {
    const fetchHandler = async () => Response.json({});

    await expect(
      deleteFollow(fetchHandler, "at://did:plc:me/app.bsky.feed.post/3abc"),
    ).rejects.toThrow("Not a follow record");
  });

  test("reports the server's explanation on failure", async () => {
    const fetchHandler = async () =>
      Response.json(
        { error: "InvalidToken", message: "Token expired" },
        { status: 401 },
      );

    await expect(
      deleteFollow(fetchHandler, "at://did:plc:me/app.bsky.graph.follow/3abc"),
    ).rejects.toThrow("Unfollow failed (401: Token expired)");
  });
});
