# Skydex

Profiles of Bluesky accounts. A static web page that profiles an
account from its public data, to help decide whether to follow, unfollow, mute or block it:
how much it posts, reposts, quotes and replies, whether it has gone
quiet, what it talks about, and (with an OpenRouter key) how much of
it is promotional, snarky or political.

To open it from any Bluesky profile, drag the bookmarklet on Skydex's
start page to your bookmarks bar and click it while viewing a profile
or post, in bsky.app or any web client with `/profile/` links.

Everything runs in the browser, with no server. No Bluesky login is
needed, except to unfollow from the follows scan: that optional login
asks only for permission to delete follow records, lives in the page's
memory, and ends when the tab is closed or reloaded.

## Develop

```sh
pnpm install
pnpm dev          # http://127.0.0.1:5173/?actor=<handle>
./check.sh        # format, lint, types, tests
pnpm test:live    # tests against the real Bluesky network
```

Use `127.0.0.1`, not `localhost`: Bluesky's OAuth only accepts
loopback IP addresses for local development.

See `docs/DESIGN.md` for how it works and `docs/DISCOVERIES.md` for
API quirks.

## Benchmark the classifier

The content tags come from an OpenRouter decision model answering the
questions in `src/classify/questions.ts`. To compare models or
question wordings against posts you have labelled:

1. Build a dataset: one JSON object per line, with a post reference
   and the labels you expect, for example:

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
   OPENROUTER_API_KEY=… pnpm bench bench/my-labels.jsonl \
     --model cloudflare/clef-flash,typesafe/jev-1.13 \
     --questions bench/my-questions.json \
     --out bench/results.out.jsonl
   ```

   `--questions` takes JSON files shaped like `CONTENT_QUESTIONS`.
   The report shows precision, recall and accuracy per tag, the cost,
   and every post where the model disagrees with your label. `--out`
   writes every answer as a dataset again, text included.

Datasets in `bench/` (`*.jsonl`) are git-ignored: they point at real
people's posts, so keep them local.

Labels can cover any tag the app reports: `promotional`, `snark`,
`politics`, and the derived `political_snark` (politics and snark
both holding).

## Deploy

Skydex is a static site; any static host on an origin of its own
works (pages sharing an origin can read each other's browser storage).
It runs at <https://skydex.avanian.net> as a Cloudflare Worker serving
static assets (`wrangler.jsonc`), built from this repository:

- Build command `pnpm build`, deploy command `npx wrangler deploy`.
- `SKYDEX_PUBLIC_URL` (default `https://skydex.avanian.net/`) is the
  address the build writes into `client-metadata.json`, which Bluesky
  fetches to identify the app for the unfollow login. Login only works
  on that address.
- The build also writes `_headers`, carrying the
  Content-Security-Policy with `frame-ancestors 'none'`.

## License

AGPL-3.0-or-later. See `LICENSE`.
