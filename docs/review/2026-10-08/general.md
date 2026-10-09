# General review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

Reviewed the runtime path: main/routing, repo and cache, follows scan,
profile, terms and content cards, classifier, auth, and the bench CLI. The
most serious problem is that loads are never cancelled or checked for
staleness when the account changes, so a slow earlier lookup can overwrite
the current one. Two bugs were reproduced: `monthlyMix` loops until
`RangeError: Map maximum size exceeded` when activities are dated after the
viewer's clock (GEN-002), and `actorFromInput` throws `URIError` on a profile
URL with broken percent-encoding (GEN-006, found by the testing review).

## GEN-001: Cancel or ignore stale profile/follows loads when the actor changes

- **Severity:** high
- **Confidence:** high
- **Location:** `src/main.ts:80-105`, `src/main.ts:153-171`, `src/ui/follows.ts:233-237`, `src/ui/follows.ts:478-549`, `src/ui/profile.ts:306-319`
- **Labels:** bug, concurrency, ui

`view.load` starts `analyze(...)` or `renderFollows(...)` without cancelling
the previous run and with no generation check (`src/main.ts:160-170`). If
actor A's lookup is slower (large CAR, long follow list) and B is submitted or
reached with Back/Forward, A finishes later and calls
`results.replaceChildren` / `setStatus`, so A's profile or table appears under
B's input and URL. A's follows scan also keeps sending up to one
`getAuthorFeed` per follow (`src/ui/follows.ts:500-522`). A late
`renderProfile` for A aborts B's theme listeners through the module-global
`previousProfile` (`src/ui/profile.ts:317`). Clicking "Rescan activity" twice
starts two concurrent scans (`src/ui/follows.ts:537-541`).

**Why it matters:** another account's data is shown silently under the
requested one, and abandoned scans keep spending AppView rate limit, which
can make the current scan fail.

**Suggested fix:** give each `View.load` an `AbortController`; abort the
previous one on reload, pass the `signal` to fetches and `runPool`, and check
`signal.aborted` before every DOM or status write.

**Done when:** a test that starts load(A) with a delayed fetch, then load(B),
shows B only, and A makes no further fetches or DOM writes after B starts.

## GEN-002: monthlyMix never ends when activities are dated after `until`

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/stats.ts:76-91`, `src/ui/profile.ts:147`
- **Labels:** bug, stats, edge-case

The month loop stops only when `key === endKey` (`src/stats.ts:88`), and
`renderProfile` passes `until = now` (`src/ui/profile.ts:147`). If the
earliest activity's month is after now's month, the key never matches.
`createdAt` is client-set, so this happens with future-dated posts or a
viewer clock running behind. Reproduced: one activity dated 2026-11-02 with
now = 2026-10-08 ran until `RangeError: Map maximum size exceeded` after
about 16M entries. Related: future dates give negative `daysSinceLast`,
rendered as "-N days ago" (`src/ui/profile.ts:69-75`).

**Why it matters:** analyzing such an account freezes the tab and uses a lot
of memory before an obscure error.

**Suggested fix:** clamp `until` to at least `first`, or loop while
`(year, month) <= end` rather than testing equality; clamp negative day
counts to 0.

**Done when:** `monthlyMix([activity dated after until], until)` returns
quickly with at least one month, covered by a unit test.

## GEN-003: Keep classifier answers already paid for when a fatal error stops the run

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/classify/decisions.ts:124-144`, `src/ui/content.ts:256-280`, `bench/run.ts:99-106`
- **Labels:** bug, classify, error-handling

`decide` rethrows `FatalError` (401/402/403) from inside `runPool`
(`src/classify/decisions.ts:138`), so the `result` already gathered is never
returned. `contentCard` saves to the cache only after `decide` resolves
(`src/ui/content.ts:266`); the `catch` at `:275-280` saves nothing. Answers
already billed are lost, e.g. running out of credits (402) after 400 of 500
posts. In-flight requests from other workers keep running and are billed, but
their answers are dropped. The bench CLI loses earlier model results the same
way, calling `process.exit(1)` before `--out` is written.

**Why it matters:** the user pays again for the same posts on retry, which
the cache exists to prevent (`src/classify/cache.ts:6-8`).

**Suggested fix:** on a fatal error, return the partial `DecisionResult` with
a `fatalError` field (or attach it to the thrown error), and save
`result.answers` before showing the error.

**Done when:** a test with a fetch stub returning 402 after N successes shows
those N answers in `AnswerCache`.

See also: TST-003.

## GEN-004: One failing follow lookup aborts the whole follows scan

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/follows.ts:258-272`, `src/follows.ts:312-325`, `src/pool.ts:15-20`, `src/follows.ts:297-301`
- **Labels:** bug, follows, error-handling

`fetchFollowing` runs `unavailableReason`, `lastHandle` and `blocksYou` in
`runPool` with no try/catch, and `runPool` rejects on the first error.
`blocksYou` resolves the followed account's DID document and pages through
`listRecords` on its PDS (`src/follows.ts:263-270`). One unreachable
third-party PDS, a plc.directory hiccup or a 429 rejects `fetchFollowing`,
and `renderFollows` shows only an error. `fetchProfiles`
(`src/shared.ts:120-131`, no `skipFailedBatches`) behaves the same: one
failing batch of 25 aborts the scan.

**Why it matters:** a scan of thousands of follows fails completely because of
one account's server.

**Suggested fix:** catch errors per follow inside the pool task and leave
`block` unset or mark the row "unknown", as the activity pool in
`src/ui/follows.ts:515-517` already does.

**Done when:** with a fetch stub where one followed account's PDS returns
500, `fetchFollowing` resolves and every other follow is classified.

## GEN-005: Rate limits and server errors on getProfile are shown as "Deleted"

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/follows.ts:246-256`
- **Labels:** bug, follows

`unavailableReason` treats any non-OK response as unavailability:
`UNAVAILABLE[error ?? ""] ?? "deleted"` maps `RateLimitExceeded`,
`InternalServerError` and any other error code to "deleted". A non-JSON error
body (an HTML 502 from a proxy) makes `response.json()` throw, which aborts
the scan (see GEN-004).

**Why it matters:** live accounts are reported as deleted, which drives
unfollow decisions.

**Suggested fix:** return "deleted" only for the specific not-found error
(status 400 "Profile not found", per `docs/DISCOVERIES.md`); treat
429/5xx/unparseable responses as unknown.

**Done when:** tests show a 429 and a 500 from `getProfile` do not produce
`unavailable: "deleted"`.

## GEN-006: actorFromInput throws URIError on malformed percent-encoding

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/actor-input.ts:14-15`, `src/main.ts:132`, `src/main.ts:140`, `src/main.ts:222`
- **Labels:** bug, input-validation

`actorFromInput` calls `decodeURIComponent(profile[1])` with no guard
(`src/actor-input.ts:15`). Running it shows
`actorFromInput("https://bsky.app/profile/%E0%A4%A")` throws
`URIError: URI malformed` instead of returning `undefined`. The caller at
`src/main.ts:222` has no try/catch, and it is fed by `?actor=`, which the
bookmarklet fills with any page URL. `show()` throws before setting a status
or updating the nav, so the "Not a handle, DID or profile URL" message never
appears. The same call in the input listener and submit handler
(`src/main.ts:132,140`) throws on typed input too.

**Why it matters:** an odd URL in the address bar or from the bookmarklet
breaks the view with no explanation.

**Suggested fix:** catch the `URIError` in `actorFromInput` and return
`undefined`.

**Done when:** `actorFromInput("https://bsky.app/profile/%E0%A4%A")` returns
`undefined`, covered by a test (see TST-002).

## GEN-007: Unbounded parallel batch requests to the AppView

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/shared.ts:70-90`, `src/follows.ts:297-301`, `src/ui/profile.ts:326`
- **Labels:** performance, rate-limiting

`batchedQuery` starts every 25-item batch at once with `Promise.all`.
`fetchProfiles` for an account following 5,000 sends 200 simultaneous
`getProfiles` requests alongside `getFollows` and block paging; `fetchPosts`
with `maxPosts` up to 5000 (`src/settings.ts:37`) sends up to 200 `getPosts`
at once. The follows scan itself is limited to 6 (`src/ui/follows.ts:17`), so
this ignores the project's own throttling. Medium confidence: the AppView's
actual limit was not measured.

**Why it matters:** bursts like this are the likeliest way to hit 429, and
profile batches can't skip failures, so a 429 fails the whole scan.

**Suggested fix:** run the batches through `runPool` with a small
concurrency (4-6).

**Done when:** a test with a counting fetch stub shows no more than N batch
requests in flight.

## GEN-008: A handle lookup failure discards the whole "What they talk about" card

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/ui/terms.ts:128-154`, `src/shared.ts:134-140`
- **Labels:** bug, ui, error-handling

Terms are fully computed, then `fetchHandles` (a non-skipping `getProfiles`)
is awaited only to turn mention DIDs into handles. If it fails, the catch
replaces the card with "Could not load shared posts: …", although the shared
posts loaded and the handles are cosmetic. Mention `did` values come straight
from post facets (`src/terms.ts:92-94`) unvalidated; whether a malformed one
gets the batch rejected was not verified.

**Why it matters:** a cosmetic failure hides the whole card and blames the
wrong cause.

**Suggested fix:** use `fetchHandles(...).catch(() => new Map())` to fall
back to DIDs, or pass `skipFailedBatches` for handle lookups.

**Done when:** with `getProfiles` returning 400, the card still renders both
columns and shows DIDs for mentions.

## GEN-009: Duplicate shared URIs inflate the "deleted or unavailable" count

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/shared.ts:42-55`, `src/ui/profile.ts:326-329`, `src/ui/terms.ts:134-143`
- **Labels:** bug, terms

`sharedUris` does not remove duplicates, so a post reposted and quoted, or
quoted twice, appears more than once. `requested` is `uris.length`, but
`fetchPosts` returns a `Map` keyed by URI, so `missing = requested -
posts.size` counts each duplicate as "deleted or unavailable". The cap note
(`requested >= maxPosts`) also triggers sooner than the number of distinct
posts justifies.

**Why it matters:** the Shared column shows wrong deleted counts.

**Suggested fix:** dedupe in `sharedUris`, or compute `requested` from
`new Set(uris).size`.

**Done when:** a unit test with the same post reposted and quoted reports 0
missing when that post is fetched.
