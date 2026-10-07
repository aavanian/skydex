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
- **organic**: any other post.

Organic and quote posts are further tagged by the content classifier:
`promotional`, `snark`, `partisan-politics`, `other` (not mutually
exclusive except `other`).

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
2. **Follows scan** (for an account, typically yourself)
   - Table of follows: last post date, last organic post date,
     posts in last 90 days, organic share. Sortable. Each row links
     into view 1.
   - Uses lightweight per-account fetches (recent `listRecords`),
     not full repos, to stay within rate limits.

## Classification

Pluggable `Classifier` interface: `classify(posts) -> tags per post`.

- **Heuristic (always on)**
  - Promotional: links to the account's own domain / handle domain,
    same domain repeatedly linked, self-promotion phrases ("my new",
    "out now", "subscribe", "pre-order", ...), shop / newsletter /
    crowdfunding domains.
  - Snark: very weak heuristics only; reported as low-confidence.
  - Partisan politics: none. Too hard for keywords; it waits until the
    model-backed classifier can be tested on real accounts.
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
      `POST https://openrouter.ai/api/alpha/decisions`, model
      `typesafe/jev-1.13`. Not an LLM: takes `state` plus named typed
      questions (`noul` yes/no, `choice`, `score`) and returns
      probabilities, billed on input tokens only. One request per post,
      one `noul` question per tag. CORS `*` verified 2026-10-07.
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
