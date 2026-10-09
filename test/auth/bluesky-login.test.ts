import { describe, expect, test } from "vitest";
import {
  BlueskyLogin,
  type UnfollowSession,
} from "../../src/auth/bluesky-login";

const alice = { did: "did:plc:alice", handle: "alice.test" };
const followUri = "at://did:plc:alice/app.bsky.graph.follow/3abc";

/** A session whose requests and sign-outs are recorded. */
function fakeSession(did: string) {
  const requests: string[] = [];
  let signedOut = false;
  const session: UnfollowSession = {
    did,
    fetchHandler: async (path) => {
      requests.push(path);
      return new Response(null, { status: 200 });
    },
    signOut: async () => {
      signedOut = true;
    },
  };
  return { session, requests, signedOut: () => signedOut };
}

function loginAs(session: UnfollowSession) {
  const asked: string[] = [];
  const login = new BlueskyLogin(async (did) => {
    asked.push(did);
    return session;
  });
  return { login, asked };
}

const popup = { close() {} } as Window;
const signal = new AbortController().signal;

describe("BlueskyLogin", () => {
  test("logs in as the scanned account and may then unfollow for it", async () => {
    const fake = fakeSession(alice.did);
    const { login, asked } = loginAs(fake.session);

    await login.logIn(alice, popup, signal);
    await login.unfollow(alice.did, followUri);

    expect(asked).toEqual([alice.did]);
    expect(login.canUnfollow(alice.did)).toBe(true);
    expect(fake.requests).toEqual(["/xrpc/com.atproto.repo.deleteRecord"]);
  });

  test("signs out and refuses a login as another account", async () => {
    const fake = fakeSession("did:plc:mallory");
    const { login } = loginAs(fake.session);

    await expect(login.logIn(alice, popup, signal)).rejects.toThrow(
      "Log in as @alice.test to unfollow from this list",
    );

    expect(fake.signedOut()).toBe(true);
    expect(login.canUnfollow(alice.did)).toBe(false);
    expect(login.canUnfollow("did:plc:mallory")).toBe(false);
    await expect(login.unfollow(alice.did, followUri)).rejects.toThrow();
    expect(fake.requests).toEqual([]);
  });

  test("never unfollows without a login", async () => {
    const { login } = loginAs(fakeSession(alice.did).session);

    expect(login.canUnfollow(alice.did)).toBe(false);
    await expect(login.unfollow(alice.did, followUri)).rejects.toThrow(
      "Not logged in as this account",
    );
  });

  test("never unfollows for a list other than the logged-in account's", async () => {
    const fake = fakeSession(alice.did);
    const { login } = loginAs(fake.session);
    await login.logIn(alice, popup, signal);

    expect(login.canUnfollow("did:plc:bob")).toBe(false);
    await expect(login.unfollow("did:plc:bob", followUri)).rejects.toThrow(
      "Not logged in as this account",
    );
    expect(fake.requests).toEqual([]);
  });

  test("forgets the session on logout and signs it out", async () => {
    const fake = fakeSession(alice.did);
    const { login } = loginAs(fake.session);
    await login.logIn(alice, popup, signal);

    await login.logOut();

    expect(fake.signedOut()).toBe(true);
    expect(login.canUnfollow(alice.did)).toBe(false);
    await expect(login.unfollow(alice.did, followUri)).rejects.toThrow();
    expect(fake.requests).toEqual([]);
  });

  test("forgets the session even when signing out fails", async () => {
    const fake = fakeSession(alice.did);
    fake.session.signOut = async () => {
      throw new Error("offline");
    };
    const { login } = loginAs(fake.session);
    await login.logIn(alice, popup, signal);

    await login.logOut();

    expect(login.canUnfollow(alice.did)).toBe(false);
  });
});
