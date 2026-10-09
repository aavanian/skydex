# Resolution: 2026-10-08 full review

All 48 findings are resolved; none was dropped. Commits are on `main`
after `93ed22e` (the review itself). One branch per theme, merged in
this order: input/stats fixes, follows-scan resilience, classifier
partial results, network modules, block status, helper dedupe,
Bluesky login, stale loads, OpenRouter login, security headers,
verified handles, CAR fixture, packaging, docs.

## Action needed outside the repo

- **Cloudflare deploy command**: change it from `npx wrangler deploy`
  to `pnpm run deploy` (PKG-001). The build command `pnpm build` stays;
  it now runs the tests first (TST-007).

## Findings

| ID      | Outcome    | Commit(s)        | Notes                                                                                                                                                                                              |
| ------- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | Fixed      | c20168d          | Unverified handles show as the bare DID. `lastHandle` (unavailable accounts) stays unverified by design: it is labelled as the last handle declared.                                               |
| GEN-001 | Fixed      | 99b51df          | `abortableFetch`/`unlessAborted` are unit-tested; the wiring in `main.ts` has no DOM test environment and was checked in a browser (switching accounts mid-load shows only the later one).         |
| TST-001 | Fixed      | 89a1b09          | Account check and unfollow guard live in `BlueskyLogin`, tested. `callback.ts` and `session.ts`'s `logIn` remain untested (they need a browser and the OAuth server).                              |
| GEN-002 | Fixed      | ee95a87          | Also clamps negative day counts (`daysSince`).                                                                                                                                                     |
| GEN-003 | Fixed      | cd42547          | `decide` resolves with `stoppedBy` and the answers so far, including in-flight ones; the content card saves them (UI, untested) and re-runs only unanswered posts; the bench writes `--out`.       |
| GEN-004 | Fixed      | a7ab772, a17b3d3 | A follow whose block records can't be read gets a new status, "Could not check" (chosen during the work instead of "Hidden by a block").                                                           |
| GEN-005 | Fixed      | a7ab772          | Only a 400 with a known error code marks an account unavailable.                                                                                                                                   |
| GEN-006 | Fixed      | 18c0bf0          |                                                                                                                                                                                                    |
| GEN-007 | Fixed      | dfd6b4b          | Limit 6, as the follows scan.                                                                                                                                                                      |
| GEN-008 | Fixed      | 72cbaa2          | `fetchHandles` skips failed batches; the card falls back to DIDs.                                                                                                                                  |
| GEN-009 | Fixed      | b23ab7f          |                                                                                                                                                                                                    |
| ORG-001 | Fixed      | 89a1b09          |                                                                                                                                                                                                    |
| ORG-002 | Fixed      | c04346b          | `src/auth/unfollow.ts` keeps an `/xrpc/` path: it is relative, resolved by the OAuth session's `fetchHandler` against the viewer's PDS.                                                            |
| ORG-003 | Fixed      | d5ace68          | `appview.ts` and `shared-posts.ts`.                                                                                                                                                                |
| ORG-004 | Fixed      | 381b933          |                                                                                                                                                                                                    |
| ORG-005 | Fixed      | 6b54831          | `src/browser-storage.ts`.                                                                                                                                                                          |
| ORG-006 | Fixed      | f02370f          | `follow-status.ts`; feed conversion in `activities.ts`.                                                                                                                                            |
| ORG-007 | Fixed      | f02370f          | Test helpers live in `test/support/`.                                                                                                                                                              |
| ORG-008 | Fixed      | 3feece1          | `ui/format.ts` (formatters, ORG-012) and `ui/theme.ts` build no DOM but serve only the views, so they stay in `ui/`.                                                                               |
| ORG-009 | Fixed      | 6229bc3          | Deleted; the page still follows the system theme.                                                                                                                                                  |
| ORG-010 | Fixed      | ffc53da          |                                                                                                                                                                                                    |
| ORG-011 | Fixed      | b27a9b5          |                                                                                                                                                                                                    |
| ORG-012 | Fixed      | ed3d681          |                                                                                                                                                                                                    |
| ORG-013 | Fixed      | 93aee37          |                                                                                                                                                                                                    |
| ORG-014 | Fixed      | 88f98d7          |                                                                                                                                                                                                    |
| ORG-015 | Superseded | 89a1b09          | Done as part of ORG-001.                                                                                                                                                                           |
| ORG-016 | Superseded | 2dc099d          | No change: TST-006 added `test/fixtures`, so the entry is now correct.                                                                                                                             |
| DOC-001 | Fixed      | e88fad2          |                                                                                                                                                                                                    |
| DOC-002 | Fixed      | f431edc          | Together with DOC-010.                                                                                                                                                                             |
| DOC-003 | Fixed      | f431edc          | The example is kept on one line with `prettier-ignore`.                                                                                                                                            |
| DOC-004 | Fixed      | f431edc          |                                                                                                                                                                                                    |
| DOC-005 | Fixed      | f431edc          |                                                                                                                                                                                                    |
| DOC-006 | Fixed      | f431edc          |                                                                                                                                                                                                    |
| DOC-007 | Fixed      | f431edc          |                                                                                                                                                                                                    |
| DOC-008 | Fixed      | 78e7d17          | "Could not check" was added to the guide in a17b3d3.                                                                                                                                               |
| DOC-009 | Fixed      | 1174e33, f431edc |                                                                                                                                                                                                    |
| DOC-010 | Fixed      | f431edc          | `docs/ROADMAP.md`.                                                                                                                                                                                 |
| TST-002 | Fixed      | 18c0bf0          | With GEN-006.                                                                                                                                                                                      |
| TST-003 | Fixed      | cd42547          | With GEN-003.                                                                                                                                                                                      |
| TST-004 | Fixed      | 3feece1          |                                                                                                                                                                                                    |
| TST-005 | Fixed      | 6c6f8e4          | `src/hosting.ts`; build output checked identical.                                                                                                                                                  |
| TST-006 | Fixed      | 2dc099d          | 1.6 KB generated CAR fixture.                                                                                                                                                                      |
| TST-007 | Fixed      | 240f982          | `pnpm build` runs the tests. A CI workflow is left for later.                                                                                                                                      |
| TST-008 | Fixed      | 240f982          | `pnpm coverage`, no thresholds.                                                                                                                                                                    |
| PKG-001 | Fixed      | 240f982          | workerd's install script denied like esbuild's. Needs the dashboard change above.                                                                                                                  |
| PKG-002 | Fixed      | 240f982          | Git tags are the version source (README); `package.json` stays `0.0.0`.                                                                                                                            |
| PKG-003 | Fixed      | 7739440          | Broader than reported: `third-party-licenses.txt` covers every bundled npm package (Vite `build.license`) plus `src/vendor` (stopwords-iso, and Octicons, newly vendored); linked from the footer. |
| PKG-004 | Fixed      | 240f982          |                                                                                                                                                                                                    |
