# Security review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

One low-severity finding; nothing at medium or above. What was checked and
holds up:

- **Rendering:** no `innerHTML` or `eval`. All DOM goes through `h()`, which
  inserts text as text (`src/ui/dom.ts:3-19`), and every external link has a
  fixed `https://bsky.app` prefix.
- **CSP:** production builds set `script-src 'self'`, `object-src 'none'`,
  `base-uri 'none'` and `frame-ancestors 'none'` (`vite.config.ts:55-64,107`).
- **Bluesky OAuth:** state and tokens live in memory only, the callback is
  relayed over a same-origin BroadcastChannel, the scope covers only deleting
  follow records, and the logged-in DID is checked against the scanned
  account (`src/ui/follows.ts:448`).
- **OpenRouter login:** PKCE S256 with a verified 32-byte random state
  (`src/ui/key.ts:64-69`). The key stays in sessionStorage unless the viewer
  opts in to remembering it.
- **Secrets and dependencies:** no hardcoded secrets (`sk-or-new` in tests is
  a fake). Install scripts are turned off (`pnpm-workspace.yaml`); the
  lockfile has no git, tarball or http sources.
- **Prompt injection:** no text addressed to AI agents in the repo.

## SEC-001: Verify the handle claimed by a DID document before showing it

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/repo.ts:58-69`, `src/ui/profile.ts:99`, `src/ui/follows.ts:408,417,489`
- **Labels:** security, identity

`resolveAccount` takes the account's handle from the first `at://` entry in
the DID document's `alsoKnownAs` (`src/repo.ts:60,65-69`) and never checks
that this handle resolves back to the same DID. For did:plc the directory does
not enforce handle ownership, so a DID can claim any handle (e.g.
`@bsky.app`). That handle becomes the profile headline (`src/ui/profile.ts:99`),
the follows-scan title (`src/ui/follows.ts:489`) and the login prompts
("Log in as @x", `src/ui/follows.ts:408,417`). This happens whenever the actor
arrives as a DID (typed, `?actor=did:...` link, bookmarklet), or when a handle
resolves to a DID whose document claims a different handle.

**Why it matters:** a link like `?actor=did:plc:<attacker>` shows a
trusted-looking handle above the attacker's data. Login is bound to the DID,
so there is no account takeover; the impact is display spoofing.

**Suggested fix:** resolve the claimed handle with
`com.atproto.identity.resolveHandle` (already used in `resolveDid`) and accept
it only if it returns the same DID; otherwise show the DID or mark the handle
invalid, as Bluesky does.

**Done when:** a unit test with mocked fetch shows a DID document claiming a
handle that resolves elsewhere (or fails) yields `handle === did` or an
"invalid handle" marker, while a matching handle is still shown.
