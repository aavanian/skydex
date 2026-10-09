# Organization review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

16 findings: 5 medium, 11 low. The main themes are copy-pasted helpers
(storage access, fetch/XRPC request building, error-message formatting,
number formatters), settings limits written twice, and a few modules that do
too much or sit in the wrong place (`src/ui/follows.ts`, `src/shared.ts`,
`src/follows.ts`, non-UI code in `src/ui/`). No commented-out code, debug
leftovers or unused dependencies; every exported function checked has a
caller.

## ORG-001: Split login and unfollow handling out of renderFollows

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/ui/follows.ts:24`, `src/ui/follows.ts:227-550`, `src/ui/follows.ts:242-297`, `src/ui/follows.ts:384-476`
- **Labels:** organization, ui

`renderFollows` is one function of about 320 lines. It fetches follows,
builds and sorts the table (`sort`, 326-363), updates counts
(`updateCounts`, 368-381), runs the Bluesky OAuth popup login and logout
(`showLogin`, 384-471), confirms and performs unfollows (`renderAction`,
242-297), and runs the activity scan (495-549). The module-level `session`
(line 24) is login state living in a table-rendering module.

**Why it matters:** login, unfollow and table changes all touch one closure,
so none can be read or tested alone.

**Suggested fix:** move `session`, `showLogin` and the popup login/logout
into e.g. `src/ui/bluesky-login.ts` exposing `loginControl(subject, onChange)`
and `currentSession()`; keep `renderFollows` to the table and scan.

**Done when:** `src/ui/follows.ts` has no module-level session and no
`window.open` or `import("../auth/session")` calls.

See also: TST-001.

## ORG-002: Share one JSON fetch and XRPC URL helper instead of copies

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/repo.ts:16-20`, `src/repo.ts:40`, `src/repo.ts:92`, `src/follows.ts:32-44`, `src/follows.ts:215-220`, `src/follows.ts:250-252`, `src/shared.ts:79-84`, `src/cached.ts:20-22`
- **Labels:** organization, network

Two private `getJson` functions exist with different signatures and error
texts (`repo.ts:16`: "`<status> fetching <url>`"; `follows.ts:32`:
"`<status> from <pathname>`"), and `shared.ts:84` has a third format. XRPC
URLs are built three ways: the `xrpc()` helper (`follows.ts:38`), inline
`new URL` + `searchParams` (`follows.ts:215`, `shared.ts:79`), and template
strings with `encodeURIComponent` (`repo.ts:40`, `repo.ts:92`, `cached.ts:21`).

**Why it matters:** changes to error handling or encoding must be made in
each copy.

**Suggested fix:** add e.g. `src/xrpc.ts` with `xrpcUrl(base, method, params)`
and `getJson(fetchFn, url)`; delete both private `getJson`s and `xrpc()`.

**Done when:** one `getJson` exists in `src/`, and no `/xrpc/` URL is built
by hand outside that module.

## ORG-003: Split shared.ts and give it a name that says what it does

- **Severity:** medium
- **Confidence:** medium
- **Location:** `src/shared.ts:1-140`, `src/follows.ts:4`, `src/ui/terms.ts:3`
- **Labels:** organization, naming

`shared.ts` holds two unrelated things: reading which post a repost or quote
points to (`quotedUri`, `sharedUri`, `sharedUris`, 18-55) and a batched
AppView client (`batchedQuery`, `fetchPosts`, `fetchProfiles`,
`fetchHandles`, 57-140). "Shared" means "reposted or quoted" for the first
half but reads like "shared utilities" when `follows.ts:4` imports
`fetchProfiles` from it.

**Why it matters:** the profile and post lookups can't be found from the file
name, and the vague name invites unrelated helpers.

**Suggested fix:** move the batched fetchers to e.g. `src/appview.ts` (or the
ORG-002 module); keep the URI functions in e.g. `src/shared-posts.ts`.

**Done when:** `fetchProfiles`/`fetchHandles` come from a module whose name
says what it does, and the quote/repost module has no network code.

## ORG-004: Define settings limits once instead of in two places

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/settings.ts:35-42`, `src/ui/settings.ts:49-69`
- **Labels:** organization, settings

The ranges appear in the validator (`isIntegerIn(1, 120)`, `(1, 5000)`,
`(0, 24 * 30)` at `settings.ts:36-41`) and again as form min/max literals
(`ui/settings.ts:53-54`, `60-61`, `67-68`). `MODEL_PATTERN` is already shared;
the number limits are not.

**Why it matters:** changing one range but not the other makes the form
accept values the validator silently replaces with defaults, or the reverse.

**Suggested fix:** export e.g. `SETTING_LIMITS` from `settings.ts` and use it
for both `VALID` and the `numberField` calls.

**Done when:** 120, 5000 and `24 * 30` each appear once in `src/`.

## ORG-005: Use one guarded browser-storage accessor instead of four copies

- **Severity:** medium
- **Confidence:** high
- **Location:** `src/main.ts:23-45`, `src/ui/content.ts:31-37`, `src/ui/settings.ts:12-18`, `src/ui/key.ts:9-15`
- **Labels:** organization, storage

The same `browserStorage()` (return `localStorage` or `undefined`) is written
in `main.ts:23`, `ui/content.ts:31` and `ui/settings.ts:12`; `ui/key.ts:9`
has a fourth variant, `storage(kind)`. `main.ts`'s `remembered()` and
`remember()` (31-45) bypass its own helper and touch `localStorage` directly
with their own try/catch.

**Why it matters:** four copies of one guard drift, and blocked-storage
handling differs by place.

**Suggested fix:** keep `storage(kind)` in one module (e.g.
`src/ui/storage.ts`) and use it in all four files, including
`remembered()`/`remember()`.

**Done when:** only one function in `src/` reads `localStorage` or
`sessionStorage` inside a try/catch.

## ORG-006: Separate follows.ts into data fetching, block detection and follow stats

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/follows.ts:25-137`, `src/follows.ts:139-186`, `src/follows.ts:188-334`, `src/cached.ts:2`
- **Labels:** organization, follows

`follows.ts` does three jobs: AppView reads plus turning a feed into
activities (`activitiesFromFeed`, `fetchFollows`, `fetchRecentActivity`,
46-137); pure statistics (`followSummary`, `followStatus`, 139-186); and PDS
record reads for blocks and unavailable accounts (`listSubjects`,
`blocksYou`, `fetchFollowing`, 188-334). `cached.ts:2` imports from it just to
get activity data.

**Why it matters:** pure statistics are mixed with network code, and feed →
activity conversion is split across two modules.

**Suggested fix:** move `activitiesFromFeed` to `activities.ts` and
`followSummary`/`followStatus` to `stats.ts` (or `follow-status.ts`).

**Done when:** `follows.ts` only does network reads, and the summary/status
functions import nothing that fetches.

## ORG-007: Make test files mirror the source modules they test

- **Severity:** low
- **Confidence:** high
- **Location:** `test/following.test.ts:2`, `test/follows.test.ts:4-5`, `test/auth/unfollow.test.ts:3`, `test/auth/unfollow.test.ts:48-57`
- **Labels:** organization, tests

`test/` otherwise mirrors `src/`, but `src/follows.ts` is tested by both
`test/follows.test.ts` and `test/following.test.ts` (no `src/following.ts`
exists), and `MemoryStore` (`src/auth/memory-store.ts`) is tested inside
`test/auth/unfollow.test.ts:48`.

**Why it matters:** a module's tests can't be found by path.

**Suggested fix:** merge `following.test.ts` into `follows.test.ts` (or
rename it to match an ORG-006 module); move the `MemoryStore` test to
`test/auth/memory-store.test.ts`.

**Done when:** every test file name matches a source module.

## ORG-008: Move non-UI modules out of src/ui/

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/ui/store.ts:1-9`, `src/ui/key.ts:1-71`, `src/store.ts:34`
- **Labels:** organization, layout

`src/ui/store.ts` only creates the IndexedDB `Store` once (class in
`src/store.ts`). `src/ui/key.ts` holds the `keyStore` instance and the
OpenRouter PKCE redirect (`startLogin`, `finishLogin`). Neither builds DOM,
and their OpenRouter siblings live in `src/classify/`.

**Why it matters:** `src/ui/store.ts` beside `src/store.ts` is confusing, and
the OpenRouter login flow spans two directories.

**Suggested fix:** merge `pageStore()` into `src/store.ts`; move `ui/key.ts`
next to `classify/openrouter-auth.ts` or into an `openrouter/` folder with
`key-store.ts`.

**Done when:** every file under `src/ui/` creates DOM elements.

## ORG-009: Remove the unused data-theme dark palette from style.css

- **Severity:** low
- **Confidence:** high
- **Location:** `src/style.css:20`, `src/style.css:38-54`
- **Labels:** organization, css

The `:root[data-theme="dark"]` block (38-54) duplicates the dark palette in
the media query (20-36), and the `:not([data-theme="light"])` guard on line
20 only matters if something sets that attribute. Nothing does
(`git grep data-theme` matches only `style.css`), and `src/ui/theme.ts:7-9`
follows only `prefers-color-scheme`.

**Why it matters:** 17 duplicated colour values must be kept in sync but
never apply.

**Suggested fix:** delete lines 38-54 and make line 20 plain `:root`, or add
the theme toggle these selectors were written for.

**Done when:** `data-theme` is gone from `src/`, or something sets it.

## ORG-010: Use one helper to turn an unknown error into a message

- **Severity:** low
- **Confidence:** high
- **Location:** `src/main.ts:47-49`, `src/ui/content.ts:278`, `src/ui/follows.ts:288`, `src/ui/follows.ts:461`, `src/ui/follows.ts:539`, `src/ui/terms.ts:153`, `src/classify/decisions.ts:140`, `bench/run.ts:104`
- **Labels:** organization, errors

`error instanceof Error ? error.message : String(error)` is repeated at eight
sites; `main.ts:47` already defines `message(error)` for it but keeps it
private.

**Why it matters:** small, but it drifts (e.g. if `error.cause` should be
shown later).

**Suggested fix:** export one `errorMessage(error: unknown)` (e.g.
`src/errors.ts`) and use it at all eight sites.

**Done when:** `git grep "instanceof Error ? error.message"` returns one
match.

## ORG-011: Define "own post" (organic or quote) once

- **Severity:** low
- **Confidence:** high
- **Location:** `src/follows.ts:158`, `src/ui/terms.ts:121`, `src/classify/content.ts:33`
- **Labels:** organization, domain

The rule "own writing = organic posts plus quotes" is spelled out three
times: `a.type === "organic" || a.type === "quote"` (`follows.ts:158`,
`ui/terms.ts:121`) and its negation (`classify/content.ts:33`).

**Why it matters:** it is a domain rule; changing it means finding every
copy.

**Suggested fix:** export `isOwnPost(type: ActivityType)` from
`src/taxonomy.ts` and call it at the three sites.

**Done when:** the `"organic" || "quote"` comparison appears only in
`taxonomy.ts`.

## ORG-012: Share number formatters and the SVG icon builder across UI modules

- **Severity:** low
- **Confidence:** high
- **Location:** `src/ui/content.ts:20-24`, `src/ui/follows.ts:47-53`, `src/ui/profile.ts:26-32`, `src/ui/terms.ts:10`, `src/ui/follows.ts:107-124`, `src/ui/footer.ts:7-20`
- **Labels:** organization, ui

The same `Intl` formatters are created repeatedly: `percent` in `content.ts`,
`follows.ts`, `profile.ts`; `integer` in all four; `decimal` and `dateFormat`
in `follows.ts` and `profile.ts`. `SVG_NS` and the 16×16 aria-hidden SVG
builder appear in both `follows.ts` (`externalIcon`) and `footer.ts`
(`githubIcon`).

**Why it matters:** formatting is meant to look the same everywhere, but
nothing keeps the copies identical.

**Suggested fix:** add `src/ui/format.ts` with the formatters and
`icon(paths)` to `src/ui/dom.ts`.

**Done when:** each formatter is constructed once in `src/ui/`, and `SVG_NS`
is defined once.

## ORG-013: Share the bookmarklet "drag, don't click" handler

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/page.ts:10-20`, `src/ui/intro.ts:6-22`
- **Labels:** organization, bookmarklet

Both files compute the app URL, set `href` from `bookmarkletHref(appUrl)`,
block the click and tell the user to drag the link, with nearly the same
wording; `page.ts` uses `alert`, `intro.ts` an inline hint.

**Why it matters:** the same behaviour and wording live in two places, and
they already differ.

**Suggested fix:** add `bookmarkletLink(appUrl, onClick)` (or one message
constant) in `src/ui/`, used by both.

**Done when:** "Drag this link to your bookmarks bar" appears once in `src/`.

## ORG-014: Build dataset lines with one function in the app and the bench

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/classify/dataset.ts:26-48`, `bench/run.ts:141-163`
- **Labels:** organization, classify

`datasetLines` builds a `DatasetLine` and joins JSONL; `bench/run.ts:142-152`
builds the same object field by field (plus `labels`) and repeats the join
at `:160`.

**Why it matters:** adding or renaming a dataset field means changing two
writers, though both rely on one reader (`parseDataset`).

**Suggested fix:** split `dataset.ts` into `datasetLine(...)` and
`toJsonl(lines)` and use both from `datasetLines` and `bench/run.ts`.

**Done when:** `bench/run.ts` builds no `DatasetLine` literal and does no
JSONL join itself.

## ORG-015: Drop the logOut pass-through wrapper

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/auth/session.ts:62-65`, `src/ui/follows.ts:399-400`, `src/ui/follows.ts:446-449`
- **Labels:** organization, auth

`logOut(session)` only does `await session.signOut()`. To reach it,
`ui/follows.ts:399` dynamically imports `../auth/session` (and the OAuth
client chunk) although the caller already holds the `OAuthSession`.

**Why it matters:** an extra layer plus an unneeded dynamic import on the
logout path.

**Suggested fix:** delete `logOut` and call `signOut()` directly in
`ui/follows.ts`.

**Done when:** `session.ts` exports only `logIn`, and logout doesn't import
`../auth/session`.

## ORG-016: Remove the stale test/fixtures entry from .prettierignore

- **Severity:** low
- **Confidence:** high
- **Location:** `.prettierignore:3`
- **Labels:** organization, config

`.prettierignore` ignores `test/fixtures`, which doesn't exist (tracked or on
disk) and is referenced nowhere in code.

**Why it matters:** dead config that would silently exempt future fixtures
from Prettier.

**Suggested fix:** delete line 3, or keep it if TST-006 adds fixtures there.

**Done when:** `.prettierignore` lists only paths that exist.
