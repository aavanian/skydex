# Bluesky account profile

A static web page that profiles a Bluesky account from its public
data, to help decide whether to follow, unfollow, mute or block it:
how much it posts, reposts, quotes and replies, whether it has gone
quiet, what it talks about, and (with an OpenRouter key) how much of
it is promotional, snarky or political.

Everything runs in the browser. No server, no Bluesky login.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:5173/?actor=<handle>
./check.sh        # format, lint, types, tests
pnpm test:live    # tests against the real Bluesky network
```

See `docs/DESIGN.md` for how it works and `docs/DISCOVERIES.md` for
API quirks.

## Benchmark the classifier

The content tags come from an OpenRouter decision model answering the
questions in `src/classify/questions.ts`. To compare models or
question wordings against posts you have labelled:

1. Build a dataset: one JSON object per line, with a post reference
   and the labels you expect. `bench/labels.jsonl` is an example:

   ```json
   {
     "url": "https://bsky.app/profile/<did>/post/<rkey>",
     "labels": { "politics": true, "political_snark": false }
   }
   ```

   Or start from **Download dataset** on an account's page, which
   exports every post the app would classify with its text and the
   model's answers, then add `labels` to the lines you care about.

2. Run, in your own terminal so the key stays out of logs:

   ```sh
   OPENROUTER_API_KEY=… pnpm bench bench/labels.jsonl \
     --model cloudflare/clef-flash,typesafe/jev-1.13 \
     --questions bench/my-questions.json \
     --out bench/results.out.jsonl
   ```

   `--questions` takes JSON files shaped like `CONTENT_QUESTIONS`.
   The report shows precision, recall and accuracy per tag, the cost,
   and every post where the model disagrees with your label. `--out`
   writes every answer as a dataset again, text included
   (`*.out.jsonl` files are git-ignored).

Labels can cover any tag the app reports: `promotional`, `snark`,
`politics`, and the derived `political_snark` (politics and snark
both holding).
