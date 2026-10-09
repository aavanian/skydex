import { readFileSync } from "node:fs";

/**
 * A minimal repository export of did:plc:fixture: a profile, a post, a
 * reply, a quote, an undated post and a repost (2025-01 to 2025-04).
 */
export const FIXTURE_CAR = new Uint8Array(
  readFileSync(new URL("../fixtures/repo.car", import.meta.url)),
);
