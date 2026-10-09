# Design

Skydex: profiles of Bluesky accounts.

## Purpose

Give data about a single Bluesky / atproto account to support a
personal follow / unfollow / mute / block decision. Not a tool for
building block lists or starter packs.

## Shape

- Static web app (Vite + TypeScript), no server. Optional logins only:
  Bluesky (to unfollow) and an OpenRouter key (for content tags). Hostable on
  any static host, but on an origin of its own: pages sharing an
  origin (e.g. `<user>.github.io/<repo>`) can read each other's browser
  storage, including the OpenRouter key.
- All fetching and analysis happen in the browser. Public data is
  cached in IndexedDB (`src/store.ts`):
  - Repositories, keyed by DID with the revision they were downloaded
    at. A revisit asks the PDS for the latest revision
    (`com.atproto.sync.getLatestCommit`, one small request) and reuses
    the copy when unchanged, or when the check fails. The 20 most
    recently saved are kept.
  - Each follow's recent activity for the follows scan, as type and
    time only, reused for 24 hours unless rescanned. The follow list
    itself is always fetched fresh, so unfollows show at once.
- Entry points:
  - `?actor=<handle|did>` URL parameter.
  - Bookmarklet: opens the app in a new tab with the current page's
    whole URL as `?actor=`; the app extracts `/profile/<actor>` from it
    (works on bsky.app and other clients using that path).
  - Paste box for a handle or profile URL (mobile fallback).

## Data sources

All are fetched from the browser, so all allow cross-origin requests
(CORS `*` first verified 2026-10-07). The AppView is
`public.api.bsky.app`; batched AppView calls run at most 6 at a time.

| Need                                                     | Source                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| handle -> DID; checking the handle a DID document claims | AppView `com.atproto.identity.resolveHandle`                                                                                        |
| DID -> PDS and claimed handle                            | `plc.directory/<did>`, or `https://<domain>/.well-known/did.json` for `did:web`                                                     |
| full history (posts, reposts, timestamps)                | PDS `com.atproto.sync.getRepo` (single CAR file)                                                                                    |
| whether a cached history is current                      | PDS `com.atproto.sync.getLatestCommit`                                                                                              |
| text of reposted / quoted posts                          | AppView `app.bsky.feed.getPosts` (25 URIs per call), recent window only                                                             |
| follow and block records (follows scan)                  | PDS `com.atproto.repo.listRecords`: the scanned account's follows and blocks, and the blocks of followed accounts hidden by a block |
| profiles of follows; handles of mentions                 | AppView `app.bsky.actor.getProfiles` (25 per call)                                                                                  |
| why a follow is unavailable                              | AppView `app.bsky.actor.getProfile` error code                                                                                      |
| which follows a block hides                              | AppView `app.bsky.graph.getFollows` (follows it omits)                                                                              |
| each follow's recent activity                            | AppView `app.bsky.feed.getAuthorFeed` (latest 100 items)                                                                            |
| unfollowing (logged in)                                  | the viewer's PDS `com.atproto.repo.deleteRecord`                                                                                    |
| content tags                                             | OpenRouter Decisions API (see Classification)                                                                                       |

Handles are shown only when verified: a DID document can claim any
handle, so the claimed handle must resolve back to the same DID, or
the DID is shown instead.

## Post taxonomy

Every record of `app.bsky.feed.post` or `app.bsky.feed.repost` is
classified as exactly one of:

- **repost**: `app.bsky.feed.repost` record.
- **quote**: post whose embed is `app.bsky.embed.record` or
  `recordWithMedia`.
- **reply**: post with a `reply` field. Own category, shown alongside
  the others but excluded from the content-tag denominators. A reply
  to someone else is a reply even if it embeds a quote: replying takes
  precedence over quoting.
  Continuing one's own thread (reply whose root and parent are both
  by the account) is not a reply: it is classified as quote or
  organic like a top-level post.
- **organic**: any other post.

Organic and quote posts are further tagged by the content classifier,
tags not mutually exclusive: `promotional`, `snark`, `politics` (any
political topic), and `political_snark`, computed as politics and
snark both holding. Partisanship as such proved too subjective to ask
directly: political posts that analyse are fine, political posts
that dunk are what "partisan" was meant to catch.

## Views

1. **Single-account profile**
   - Summary: totals, percentage of each type, last activity, last
     organic post, posts per week over the last 90 days and over the
     account's lifetime.
   - Activity mix per month: stacked bars by type, switchable between
     counts and share of the month, with the numbers as a table.
   - Activity timeline: one mark per post, coloured by type, over the
     whole account lifetime; dormancy gaps visible.
   - Content tags share among organic + quote (with an OpenRouter key).
   - Topic cloud split between shared content (reposts + quoted) and
     own content (organic and quote commentary).
   - Top words, hashtags (from `#tag` facets and `tags`), mentions
     (from mention facets, resolved to handles) and link domains, each
     split own vs. shared.
2. **Follows scan** (`?follows=<actor>`, the actor remembered locally)
   - Table of follows: last activity, last own post (organic or
     quote), activities per week over 90 days, organic share, repost
     share, and a status: never posted, dormant (nothing in 90 days),
     no own posts lately (only reposts or replies), active. Sortable;
     each row opens view 1.
   - The list comes from the actor's own `app.bsky.graph.follow`
     records, not `getFollows`, which omits deactivated, suspended and
     deleted accounts and any follow hidden by a block (about 4% in
     our first test). Unavailable accounts are classified from
     `getProfile` errors. A follow hidden by a block is "you block
     them" if in the actor's block records, "blocks you" if the actor
     is in theirs (first 5,000 read), else "hidden by a block" (likely
     a block list), or "could not check" when their identity or data
     server cannot be reached. A lookup failing for one follow (rate
     limit, server error) affects only that follow, never the scan.
   - Starting another lookup or scan abandons the one in progress: its
     requests stop and it no longer touches the page.
   - One AppView `getAuthorFeed` request per follow (latest 100
     items, replies included), six at a time. No PDS resolution
     needed. Reposts are dated by AppView index time. When all 100
     items are recent, the rate is shown as a minimum.
   - Accounts hiding from logged-out viewers still return their feed
     to the public AppView (checked on several dozen such accounts).

### Unfollowing from the follows scan

Optional atproto OAuth login, requested scope
`atproto repo:app.bsky.graph.follow?action=delete` only.

- Uses `@atproto/oauth-client` directly with in-memory state and
  session stores: nothing is persisted, so closing or reloading the tab
  logs out ("Log out" also revokes server-side). The browser package
  was not used because it always persists to IndexedDB.
- Login runs in a popup so the page, which holds the in-memory state,
  never navigates. `callback/index.html` only relays the authorization
  response to the page over a BroadcastChannel and closes.
- Unfollow deletes the follow record (`com.atproto.repo.deleteRecord`)
  read by the scan, after a confirmation, one account at a time. This
  also works for accounts that block you, which the Bluesky app does
  not list.
- Locally the client is a loopback client (served on `127.0.0.1`).
  Hosted, `client-metadata.json` is emitted by the build from
  `clientMetadataFor` for `SKYDEX_PUBLIC_URL`, so the file and the
  runtime client always agree. The redirect URI is the folder
  `callback/`, since Cloudflare (Workers static assets, like Pages)
  redirects `*.html` addresses to extensionless ones.

## Classification

Content tags come from OpenRouter's Decisions API, and only with a key
the viewer provides; without one no tags are shown.

- `POST https://openrouter.ai/api/alpha/decisions` takes `state` plus
  named typed questions and returns probabilities, billed on input
  tokens only. CORS `*` verified 2026-10-07.
- One request per post, 8 at a time, with `state` holding `post` (the
  account's own text) and, for quotes, `quoted_post`. One `noul`
  (yes/no) question per tag, in `CONTENT_QUESTIONS`
  (`src/classify/questions.ts`): `promotional`, `snark`, `politics`.
  `political_snark` is derived as politics and snark both holding.
  A tag counts at probability 0.5 or more.
- Classifies the latest organic and quote posts within the analysis
  window, up to the posts-per-analysis setting, to bound cost.
- The model is a setting (default `cloudflare/clef-flash`, $0.09/M
  input tokens; `typesafe/jev-1.13` uses the same API but is
  region-blocked for us on OpenRouter).
- `AnswerCache` keeps answers per account in localStorage, keyed by a
  fingerprint of the model and questions, so a post is never paid for
  twice. A run stopped by an unknown key, exhausted credits or a
  refused request keeps the answers received so far.
- Key obtained by OpenRouter's browser login (OAuth PKCE, with the
  returned state checked against the one saved for this tab) or
  pasted. Kept in session storage by default, local storage only when
  the viewer ticks "remember". Sent only to OpenRouter.
- Anything running in the page can read the key, so: a
  Content-Security-Policy restricts the built page to its own scripts,
  all untrusted text is inserted as text, and the UI asks for a key
  with a small credit limit.
- `pnpm bench` compares models and question sets against labelled
  posts (see the README).

Ideas not built yet are in `ROADMAP.md`.

Topic extraction for the cloud: word frequency after removing
stopwords: the vendored stopwords-iso English and French lists
(`src/vendor/stopwords-iso`, MIT), plus Skydex's own additions
(conversational filler, internet shorthand, month and weekday names),
minus a keep-list of words that name topics (e.g. web,
research, state, March, Mars).

## Settings

A Settings page (`?settings`), stored in this browser's localStorage
(`skydex-settings`); invalid values fall back to the defaults:

- Analysis window (topics and content tags): 12 months.
- Posts per analysis (shared posts fetched, posts classified): 500.
- Content tags model: `cloudflare/clef-flash`.
- Follows scan cache: 24 hours (0 always refetches).
- Follows scan account: the last one scanned, remembered separately.

The page also clears cached data: IndexedDB (histories, scan data)
and saved classifier answers.

## Testing

Vitest. Pure modules (taxonomy, bucketing, topic extraction, follow
status) built test-first against fixture records. Network code takes
an injected `fetch` and is tested against stubbed JSON responses and a
small repository export (`test/fixtures/repo.car`). Code that builds
the page (`src/ui/`, `src/main.ts`) is not unit-tested; the decisions
it relies on (who may unfollow, the OpenRouter login check, the
security headers) live in tested modules. `pnpm test:live` runs
against the real network.
