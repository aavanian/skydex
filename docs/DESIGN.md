# Design

## Purpose

Give data about a single Bluesky / atproto account to support a
personal follow / unfollow / mute / block decision. Not a tool for
building block lists or starter packs.

## Shape

- Static web app (Vite + TypeScript), no server, no auth. Hostable on
  any static host, but on an origin of its own: pages sharing an
  origin (e.g. `<user>.github.io/<repo>`) can read each other's browser
  storage, including the OpenRouter key.
- All fetching and analysis happen in the browser. Results cached in
  IndexedDB, keyed by DID + repo revision.
- Entry points:
  - `?actor=<handle|did>` URL parameter.
  - Bookmarklet: parses `/profile/<actor>` from the current page URL
    (works on bsky.app and other clients using that path) and opens the
    app in a new tab.
  - Paste box for a handle or profile URL (mobile fallback).

## Data sources (all CORS `*`, verified 2026-10-07)

| Need                                      | Source                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| handle -> DID                             | `com.atproto.identity.resolveHandle` (public AppView)                   |
| DID -> PDS                                | `plc.directory/<did>` or `did:web` document                             |
| full history (posts, reposts, timestamps) | PDS `com.atproto.sync.getRepo` (single CAR file)                        |
| text of reposted / quoted posts           | AppView `app.bsky.feed.getPosts` (25 URIs per call), recent window only |
| follows list (follows scan view)          | AppView `app.bsky.graph.getFollows`                                     |
| profile (display name, counts)            | AppView `app.bsky.actor.getProfile`                                     |

## Post taxonomy

Every record of `app.bsky.feed.post` or `app.bsky.feed.repost` is
classified as exactly one of:

- **repost**: `app.bsky.feed.repost` record.
- **quote**: post whose embed is `app.bsky.embed.record` or
  `recordWithMedia`.
- **reply**: post with a `reply` field. Own category, shown alongside
  the others but excluded from the content-tag denominators.
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
   - Summary: totals, percentage of each type, first/last activity, posts per week.
   - Stacked area chart of type share over time (monthly buckets).
   - Activity timeline: one mark per post, coloured by type, over the
     whole account lifetime; dormancy gaps visible.
   - Posting frequency (posts/week, rolling).
   - Content tags share among organic + quote.
   - Topic cloud split between shared content (reposts + quoted) and
     own content (organic).
   - Top words, hashtags (from `#tag` facets and `tags`), mentions
     (from mention facets, resolved to handles) and link domains, each
     split own vs. shared.
2. **Follows scan** (`?follows=<actor>`, the actor remembered locally)
   - Table of follows: last activity, last own post (organic or
     quote), activities per week over 90 days, organic share, and a
     status: never posted, dormant (nothing in 90 days), no own posts
     lately (only reposts or replies), active. Sortable; each row
     opens view 1.
   - The list comes from the actor's own `app.bsky.graph.follow`
     records, not `getFollows`, which omits deactivated, suspended and
     deleted accounts and any follow hidden by a block (about 4% in
     our first test). Unavailable accounts are classified from
     `getProfile` errors. A follow hidden by a block is "you block
     them" if in the actor's block records, "blocks you" if the actor
     is in theirs (first 5,000 read), else "hidden by a block" (likely
     a block list).
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
  never navigates. `callback.html` only relays the authorization
  response to the page over a BroadcastChannel and closes.
- Unfollow deletes the follow record (`com.atproto.repo.deleteRecord`)
  read by the scan, after a confirmation, one account at a time. This
  also works for accounts that block you, which the Bluesky app does
  not list.
- Locally the client is a loopback client (served on `127.0.0.1`).
  Hosted, it needs `client-metadata.json` next to the page, generated
  from `clientMetadataFor` at deployment.

## Classification

Pluggable `Classifier` interface: `classify(posts) -> tags per post`.

- **Heuristic (always on)**
  - Promotional: links to the account's own domain / handle domain,
    same domain repeatedly linked, self-promotion phrases ("my new",
    "out now", "subscribe", "pre-order", ...), shop / newsletter /
    crowdfunding domains.
  - Snark: very weak heuristics only; reported as low-confidence.
  - Politics: none. Too hard for keywords; model-backed only.
- **Model-backed (optional, bring your own key)**
  - Key obtained by OpenRouter's browser login (OAuth PKCE) or pasted.
    Kept in session storage by default, local storage only when the
    viewer ticks "remember". Sent only to the chosen provider.
  - Anything running in the page can read the key, so: a
    Content-Security-Policy restricts the built page to its own
    scripts, all untrusted text is inserted as text, and the UI asks
    for a key with a small credit limit.
  - Classifies a sample (latest N organic + quote posts) to bound
    cost; results cached.
  - Pluggable provider adapters, selected in settings:
    - **Decision API** (first target): OpenRouter
      `POST https://openrouter.ai/api/alpha/decisions`. Takes `state`
      plus named typed questions (`noul` yes/no, `choice`, `score`) and
      returns probabilities, billed on input tokens only. One request
      per post, one `noul` question per tag. CORS `*` verified
      2026-10-07. Default model `cloudflare/clef-flash`
      ($0.09/M input tokens); `typesafe/jev-1.13` ($0.042/M) uses the
      same API but is region-blocked for us on OpenRouter. Cached
      answers are keyed by model and question set.
    - **Chat LLM** (later): OpenAI-compatible chat completions and the
      Anthropic Messages API, with a free-text model id.

Topic extraction for the cloud: tokenisation + stopwords + hashtags +
link domains, with TF-IDF against a baseline; LLM topics optional.

## Settings

Stored per browser, with these defaults:

- Hydration / classifier window: last 12 months.
- Max posts hydrated / sent to the classifier: 500.
- Follows scan account: your own handle, remembered after first use.

## Testing

Vitest. Pure modules (taxonomy, bucketing, heuristics, topic
extraction) built test-first against fixture records. Network layer
tested against recorded fixtures (small CAR + JSON responses).
