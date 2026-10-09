# Roadmap

Ideas considered but not built. `DESIGN.md` describes what exists.

## Classification

- **Heuristic tagger, always on**, so some tags show without a key.
  Promotional: links to the account's own or handle domain, the same
  domain linked repeatedly, self-promotion phrases ("my new", "out
  now", "subscribe", "pre-order"), shop, newsletter or crowdfunding
  domains. Snark: only very weak heuristics, shown as low-confidence.
  Politics: none, too hard for keywords.
- **Pluggable classifiers and providers**, selected in settings: a
  `Classifier` interface (`classify(posts) -> tags per post`) with the
  Decisions API as one adapter, plus chat LLMs (OpenAI-compatible chat
  completions and the Anthropic Messages API, with a free-text model
  id).

- **Promotional for links to the account's own content.** Today the
  classifier sees only the post text (and a quoted post), so an account
  sharing its own articles is rarely tagged promotional: the tone is in
  the article, not the post. Likely needs fetching the link and adding
  a description of the content to the question's context, with
  carefully reworded questions. Steps: collect a large set of posts,
  study how to get a usable description of each link, then run evals of
  context and question wording against labelled posts.
- **Re-study the politics and snark questions** the same way (without
  fetching links).
- **Model choice.** `cloudflare/clef-flash` is a placeholder for
  `typesafe/jev-1.13`, region-blocked for us on OpenRouter; a local
  model is also a candidate.
- Any change to questions or context changes the cache fingerprint:
  plan how earlier answers and labelled datasets carry over.

## Profile

- Posting frequency over time (posts per week, rolling), beyond the
  current 90-day and lifetime figures.
