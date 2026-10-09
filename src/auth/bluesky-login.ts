import { deleteFollow, type FetchHandler } from "./unfollow";

/** What unfollowing needs of a Bluesky OAuth session. */
export interface UnfollowSession {
  did: string;
  fetchHandler: FetchHandler;
  signOut(): Promise<void>;
}

/** Logs in as `did` through `popup`; see `logIn` in session.ts. */
export type StartLogin = (
  did: string,
  popup: Window,
  signal: AbortSignal,
) => Promise<UnfollowSession>;

/**
 * The viewer's Bluesky login, kept in memory only. Unfollows go only
 * through a session for the account whose follows are listed, so a
 * login as anyone else can never delete follows.
 */
export class BlueskyLogin {
  #session: UnfollowSession | undefined;

  constructor(private readonly start: StartLogin) {}

  /** Whether the current login may unfollow from `did`'s follows. */
  canUnfollow(did: string): boolean {
    return this.#session?.did === did;
  }

  /**
   * Logs in as `account`. A session for any other account is signed
   * out again and refused.
   */
  async logIn(
    account: { did: string; handle: string },
    popup: Window,
    signal: AbortSignal,
  ): Promise<void> {
    const started = await this.start(account.did, popup, signal);
    if (started.did !== account.did) {
      await started.signOut().catch(() => undefined);
      throw new Error(
        `Log in as @${account.handle} to unfollow from this list`,
      );
    }
    this.#session = started;
  }

  /** Forgets the session, then revokes it on the server if possible. */
  async logOut(): Promise<void> {
    const ending = this.#session;
    this.#session = undefined;
    await ending?.signOut().catch(() => undefined);
  }

  /** Deletes the follow record `followUri` from `did`'s follows. */
  async unfollow(did: string, followUri: string): Promise<void> {
    const session = this.#session;
    if (!session || session.did !== did) {
      throw new Error("Not logged in as this account");
    }
    await deleteFollow(session.fetchHandler.bind(session), followUri);
  }
}
