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

## Profile

- Posting frequency over time (posts per week, rolling), beyond the
  current 90-day and lifetime figures.
