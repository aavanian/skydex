# Testing review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

- **How tests run:** Vitest 5. The unit suite is configured in the `test`
  block of `vite.config.ts:137-140` (`test/**/*.test.ts`, excluding
  `test/live/**`); the network suite uses `vitest.live.config.ts`. Run via
  `./check.sh` (prettier, eslint, tsc twice, `vitest run`) or `pnpm test`.
  There is no CI (no `.github/`, no Makefile). `test:live` was not run.
- **Result:** `pnpm exec vitest run` — **30 files, 164 tests, all passed** in
  about 0.6s. Nothing skipped, no `.only`/`.todo`. Tests are deterministic
  (time injected, retry delay 0).
- **Coverage:** not configured, not measured.
- **Overall:** pure modules and network wrappers are well tested through
  injected `fetchFn` with real-behaviour assertions. Untested: all of
  `src/ui/` (about 1,700 lines), `src/main.ts`, `src/page.ts`,
  `src/callback.ts`, `src/auth/session.ts`, `src/stopwords.ts` and
  `bench/run.ts` (about 2,300 lines together); logic that lives only inline
  in the UI (unfollow/login guards, OpenRouter login check, failed-run
  handling); and the security headers built in `vite.config.ts`.

## TST-001: Add tests for the Bluesky login and unfollow flow

- **Severity:** high
- **Confidence:** high
- **Location:** `src/ui/follows.ts:242-296`, `src/ui/follows.ts:440-470`, `src/auth/session.ts:46-65`, `src/callback.ts:5-10`, `vite.config.ts:116-119`
- **Labels:** testing, auth, ui

The only action in the app that deletes anything is tested only at its
lowest level (`deleteFollow`, `test/auth/unfollow.test.ts`). Untested:

- the account check after login, `if (started.did !== subject.did) { await logOut(started) ... throw }` (`src/ui/follows.ts:448-453`);
- the confirm-click guard `if (!session || !loggedIn()) return renderAction(row)` (`:277`);
- the cancel/abort and error paths (`:457-467`);
- `logIn`/`logOut` in `src/auth/session.ts` (popup closed in `finally`) and the callback relay in `src/callback.ts`.

No test file imports any of these. The suite runs in Vitest's default Node
environment (no `environment` in `vite.config.ts:116-119`, no jsdom or
happy-dom), so no DOM code under `src/ui/` can be tested as set up today.

**Why it matters:** if a refactor removes the account check, a session for
the wrong account could delete follows, and nothing would catch it before
deploy.

**Suggested fix:** move the "may this session unfollow these rows" decision
and the login result handling (account check, logging out a mismatched
session) into a pure module and unit-test it. Optionally add a DOM
environment for a few tests of the confirm flow.

**Done when:** tests fail if the check at `follows.ts:448` or the guard at
`:277` is removed, and a test shows a mismatched session is logged out and
never used to call `deleteFollow`.

See also: ORG-001.

## TST-002: Add a malformed-escape rejection case to actorFromInput tests

- **Severity:** medium
- **Confidence:** high
- **Location:** `test/actor-input.test.ts:20-25`, `src/actor-input.ts:14-15`
- **Labels:** testing, input-validation

The rejection tests in `test/actor-input.test.ts:20-25` only use `""`, a
non-profile URL and `"not a handle"`. Nothing exercises malformed
percent-encoding, which currently throws `URIError` (see GEN-006).

**Why it matters:** `actorFromInput` handles untrusted input from the
address bar and bookmarklet; the crash went unnoticed for lack of this case.

**Suggested fix:** add `["https://bsky.app/profile/%E0%A4%A"]` to the
`test.each` at `test/actor-input.test.ts:20`.

**Done when:** that case exists and passes with `actorFromInput` returning
`undefined`.

See also: GEN-006.

## TST-003: Test the paid OpenRouter failure paths (402, retries used up)

- **Severity:** medium
- **Confidence:** medium
- **Location:** `src/classify/decisions.ts:102-112`, `src/classify/decisions.ts:137-138`, `test/classify/decisions.test.ts:80-146`
- **Labels:** testing, classify, cost

`test/classify/decisions.test.ts` covers success, concurrency, a single 429
retry, a non-retried 400, 401, 403 and non-JSON bodies. Untested:

- **Out of credits:** the 402 branch (`decisions.ts:102-106`).
- **Retries used up:** a 429 or 5xx that keeps failing until `MAX_ATTEMPTS`
  (`:107-112`). The only "keeps failing" test uses a 400 (`test:96-107`),
  which is never retried.
- **Fatal error mid-run:** answers already received are dropped; the bug is
  GEN-003, and its fix needs a test here.

**Why it matters:** a regression in the retry limit or the fatal path costs
the user OpenRouter credit.

**Suggested fix:** add `decide` tests for 402, for a 5xx that keeps failing
(expect exactly `MAX_ATTEMPTS` calls), and for a fatal error after some
successes.

**Done when:** these three tests exist and the mid-run one asserts what
happens to answers received before the error.

See also: GEN-003.

## TST-004: Test the OpenRouter login state check and missing-key response

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/ui/key.ts:55-71`, `src/classify/openrouter-auth.ts:62-65`, `test/classify/openrouter-auth.test.ts:30-56`
- **Labels:** testing, auth, security

`finishLogin` checks that the returned `state` matches the value saved in
sessionStorage — the login's CSRF protection — and throws on mismatch or a
missing entry (`src/ui/key.ts:64-69`), then strips `code`/`state` from the URL
(`:59-62`). No test imports `src/ui/key.ts`. Separately, `exchangeCode`
returns `(await response.json()).key` unchecked
(`src/classify/openrouter-auth.ts:65`), so a 200 with no `key` would store
`undefined`; tests cover only success and refusal.

**Why it matters:** if the state check regresses, an attacker can plant their
own OpenRouter key via a crafted callback URL.

**Suggested fix:** move the state check into a function taking storage and
URL as arguments and test match, mismatch and missing entry; add an
`exchangeCode` test for a 200 without `key`.

**Done when:** tests show a mismatched or missing state is rejected without
calling `exchangeCode`, and a response with no `key` gives a clear error.

## TST-005: Test the generated CSP and `_headers`

- **Severity:** medium
- **Confidence:** high
- **Location:** `vite.config.ts:55-119`
- **Labels:** testing, security, build

The Content-Security-Policy (rationale in `vite.config.ts:47-54`) and the
`_headers` file with `frame-ancestors 'none'`, `nosniff` and
`Referrer-Policy` (`:104-117`) exist only as values inside Vite plugins; no
test checks them. The same goes for `client-metadata.json` as written by
`hostingFiles` (only `clientMetadataFor` is tested).

**Why it matters:** weakening or deleting `script-src 'self'` or
`frame-ancestors 'none'` still builds, and nothing fails before deploy; key
theft and Unfollow-button clickjacking protections depend on them.

**Suggested fix:** export the policy list and a `headersFile()` builder from
a small module and assert key directives in a unit test, or test a
`vite build` into a temp directory.

**Done when:** a test fails if `script-src 'self'`, `object-src 'none'` or
`frame-ancestors 'none'` is removed from the build output.

## TST-006: Add an offline CAR fixture test for activitiesFromCar and downloadRepo

- **Severity:** low
- **Confidence:** high
- **Location:** `src/activities.ts:54-56`, `src/repo.ts:88-96`, `test/live/repo.live.test.ts:7-19`, `docs/DESIGN.md:182-184`
- **Labels:** testing, parsing

`activitiesFromCar` (binary CAR decoding via `@atcute/repo`) and
`downloadRepo` (including its `!response.ok` error, `src/repo.ts:94`) are
only exercised by `test/live/repo.live.test.ts`, which hits the network and
is excluded from `check.sh`. `docs/DESIGN.md:184` claims the network layer is
"tested against recorded fixtures (small CAR + JSON responses)", but no CAR
fixture is tracked.

**Why it matters:** a dependency bump or decoding change shows up only when
someone remembers to run the live suite.

**Suggested fix:** commit a small CAR fixture and test `activitiesFromCar`
on it; add a `downloadRepo` test with an injected `fetchFn` covering a
non-OK status.

**Done when:** `pnpm test` covers CAR parsing and `downloadRepo` errors
offline.

## TST-007: Make tests run automatically before deploy

- **Severity:** low
- **Confidence:** medium
- **Location:** `package.json:14`, `check.sh:6-11`, `wrangler.jsonc:1-9`
- **Labels:** testing, ci

Tests run only when someone runs `./check.sh` or `pnpm test`. There is no CI
config, and `build` is `tsc --noEmit && vite build` (`package.json:14`) with
no `vitest run`. The Cloudflare deploy therefore appears to build without
testing. Medium confidence: the dashboard's build command is not in the repo.

**Why it matters:** a commit with failing tests can reach production.

**Suggested fix:** add a CI workflow running `./check.sh` on push and PRs, or
make the Cloudflare build command run `pnpm test` before `pnpm build`.

**Done when:** a commit with a failing test cannot deploy unnoticed.

## TST-008: Configure coverage measurement

- **Severity:** low
- **Confidence:** high
- **Location:** `package.json:12-21`, `vite.config.ts:116-119`
- **Labels:** testing, tooling

No coverage script, provider or `test.coverage` settings exist. Gaps like
TST-001 to TST-006 can only be found by hand-mapping imports.

**Why it matters:** untested code, especially in `src/ui/`, piles up
unnoticed.

**Suggested fix:** add `@vitest/coverage-v8`, a `coverage` script and
`test.coverage` settings including `src/**`; optionally thresholds for
`src/` outside `ui/`.

**Done when:** `pnpm coverage` reports per-file coverage for `src/`.
