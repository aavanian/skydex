# Design

## Purpose

Give data about a single Bluesky / atproto account to support a
personal follow / unfollow / mute / block decision. Not a tool for
building block lists or starter packs.

## Shape

- Static web app (Vite + TypeScript), no server, no auth. Hostable on
  any static host (e.g. GitHub Pages).
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
  - Partisan politics: curated keyword/entity list (parties,
    politicians, elections) for US politics, in English and French.
  - Snark: very weak heuristics only; reported as low-confidence.
- **LLM (optional, bring your own key)**
  - Pluggable provider adapters, selected in settings with a
    free-text model id:
    - OpenAI-compatible chat completions (first target: OpenRouter;
      also covers OpenAI and local servers exposing that API).
    - Anthropic Messages API (direct browser access header).
  - Key kept in browser storage, sent only to the chosen provider.
  - Classifies a sample (e.g. latest N organic + quote posts) to bound
    cost; results cached.

Topic extraction for the cloud: tokenisation + stopwords + hashtags +
link domains, with TF-IDF against a baseline; LLM topics optional.

## Settings

Stored per browser, with these defaults:

- Hydration / LLM window: last 12 months.
- Max posts hydrated / sent to the LLM: 500.
- Follows scan account: your own handle, remembered after first use.

## Testing

Vitest. Pure modules (taxonomy, bucketing, heuristics, topic
extraction) built test-first against fixture records. Network layer
tested against recorded fixtures (small CAR + JSON responses).
