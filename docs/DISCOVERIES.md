# Discoveries

- **TypeScript is pinned to 6.x.** typescript-eslint 8.70 refuses to
  run with TypeScript 7 ("does not support TS 7.0").
- **All public atproto endpoints used here send
  `access-control-allow-origin: *`**: AppView, plc.directory, and PDS
  `listRecords` / `getRepo`. The app needs no proxy.
- **`getRepo` returns the whole history in one request** (about 4 MB
  for @bsky.app), but reposts in it are only references: reading the
  reposted text takes separate `getPosts` calls.
- **bsky.app sends no Content-Security-Policy header**, only
  `X-Frame-Options: SAMEORIGIN`, so a bookmarklet is not blocked.
- **OpenRouter's Decisions API lives at `/api/alpha/decisions`**
  (401 without a key, CORS `*`). The API reference page also shows
  `/api/v1/api/alpha/decisions`, which returns 404.
- **`typesafe/jev-1.13` is region-blocked on OpenRouter for us**
  (403 "This model is not available in your region."), although its
  only provider, TypeSafe, works directly from the same place. Likely
  an OpenRouter-side restriction. `cloudflare/clef-flash` serves the
  same Decisions API and works from our region (2026-10-07).
