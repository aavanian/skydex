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
  model is also a candidate. See this
  [benchmark](https://huggingface.co/datasets/LocalLLaMA/typed-decisions)
  (unfortunately, clef is not covered at the time of writing).

- Any change to questions or context changes the cache fingerprint:
  plan how earlier answers and labelled datasets carry over.

## Replies

- **Reply-guy score**: how much of an account's replying is unsolicited
  replies to people it has no tie with, rather than conversation.
  Built from the structure of the replies, not their text, so it works
  without a key. Per reply in the analysis window:
  - From the repository alone: the target (author of
    `reply.parent.uri`); whether the account follows the target (its
    own `app.bsky.graph.follow` records, already in the CAR); whether
    it replies to the thread root or inside an ongoing conversation;
    how soon after the parent (the parent's rkey is a TID, so its time
    is known without a fetch, approximately); how concentrated the
    targets are (a few friends vs. anyone).
  - From the AppView, batched and bounded by posts per analysis: the
    target's follower count (`getProfiles`), and whether the target
    follows the account back (`app.bsky.graph.getRelationships`;
    check its CORS and limits). Whether the target ever answered needs
    a thread fetch per reply: sample it or leave it out.
  - Show the parts first ("70% to accounts they don't follow, 40% to
    accounts 10x their size, median 3 min after the post"), and add a
    single score or label only once a weighting has been checked
    against hand-labelled accounts.
  - Follows scan: the author feed's reply items carry the parent
    author, so the number of distinct targets is cheap, but follow
    relationships would cost a request per follow. Profile view first.

- **Low-quality replies**: the content side of replying, as reply tags
  from the classifier. `state` holds `reply` and `parent_post`
  (fetched with `getPosts` like quoted posts; parent deleted: classify
  without it or skip). Candidate `noul` questions: adds nothing (bare
  agreement, "this", "lol", emoji), hostile (dismissive or insulting
  toward the parent's author), unsolicited correction or lecture.
  - Keyless heuristics as a pre-filter: emoji-only or very short
    replies, the same text sent to several people, link-only replies.
  - A separate question set (its own cache fingerprint), with replies
    as the denominator, apart from the content tags. Replies can
    outnumber own posts many times over: cap them separately or share
    the posts-per-analysis budget.
  - `pnpm bench` needs labelled replies with their parents, so the
    dataset format gains a parent field.
  - Shown next to the reply-guy score, not folded into it: one is
    behaviour, the other content.

## Profile

- Posting frequency over time (posts per week, rolling), beyond the
  current 90-day and lifetime figures.

- **Own-post style**: what the account's organic posts look like, from
  the record alone, without a key. One primary format per post, by
  precedence: video, images, GIF (Bluesky's GIF picker posts an
  external embed to Tenor; verify), link (external embed or link
  facet), text only. Plus flags: thread starter (self-thread), images
  with alt text, hashtag count, length bucket. Shown as shares and per
  month like the activity mix; a column in the follows scan is
  possible, since author feed items carry the embed.
  - Memes: there is no reliable signal in the record. Options: an
    "image with little or no text" heuristic (cheap, noisy; label it as
    such, not "meme"); a vision model (new provider and cost, and image
    fetching widens the CSP); or none.
  - Links overlap with promotional links to the account's own content
    (above): own domain vs. others could be shared by both.
