# Full review: Skydex

Scope: whole repository (git-tracked files, excluding `docs/review/`) · Commit: d9aed58 (clean working tree) · Date: 2026-10-08

## Counts

| Category                                | Critical | High  | Medium | Low    | Total  |
| --------------------------------------- | -------- | ----- | ------ | ------ | ------ |
| [Security](security.md)                 | 0        | 0     | 0      | 1      | 1      |
| [Organization](organization.md)         | 0        | 0     | 5      | 11     | 16     |
| [Docs consistency](docs-consistency.md) | 0        | 0     | 2      | 8      | 10     |
| [Testing](testing.md)                   | 0        | 1     | 4      | 3      | 8      |
| [Packaging](packaging.md)               | 0        | 0     | 1      | 3      | 4      |
| [General](general.md)                   | 0        | 1     | 5      | 3      | 9      |
| **Total**                               | **0**    | **2** | **17** | **29** | **48** |

## Findings by severity

### High

- [TST-001](testing.md#tst-001-add-tests-for-the-bluesky-login-and-unfollow-flow): Add tests for the Bluesky login and unfollow flow
- [GEN-001](general.md#gen-001-cancel-or-ignore-stale-profilefollows-loads-when-the-actor-changes): Cancel or ignore stale profile/follows loads when the actor changes

### Medium

- [ORG-001](organization.md#org-001-split-login-and-unfollow-handling-out-of-renderfollows): Split login and unfollow handling out of renderFollows
- [ORG-002](organization.md#org-002-share-one-json-fetch-and-xrpc-url-helper-instead-of-copies): Share one JSON fetch and XRPC URL helper instead of copies
- [ORG-003](organization.md#org-003-split-sharedts-and-give-it-a-name-that-says-what-it-does): Split shared.ts and give it a name that says what it does
- [ORG-004](organization.md#org-004-define-settings-limits-once-instead-of-in-two-places): Define settings limits once instead of in two places
- [ORG-005](organization.md#org-005-use-one-guarded-browser-storage-accessor-instead-of-four-copies): Use one guarded browser-storage accessor instead of four copies
- [DOC-001](docs-consistency.md#doc-001-privacy-page-omits-didweb-hosts-and-followed-accounts-servers): Privacy page omits did:web hosts and followed accounts' servers
- [DOC-002](docs-consistency.md#doc-002-designmd-describes-a-heuristic-classifier-and-adapters-that-dont-exist): DESIGN.md describes a heuristic classifier and adapters that don't exist
- [TST-002](testing.md#tst-002-add-a-malformed-escape-rejection-case-to-actorfrominput-tests): Add a malformed-escape rejection case to actorFromInput tests
- [TST-003](testing.md#tst-003-test-the-paid-openrouter-failure-paths-402-retries-used-up): Test the paid OpenRouter failure paths (402, retries used up)
- [TST-004](testing.md#tst-004-test-the-openrouter-login-state-check-and-missing-key-response): Test the OpenRouter login state check and missing-key response
- [TST-005](testing.md#tst-005-test-the-generated-csp-and-_headers): Test the generated CSP and `_headers`
- [PKG-001](packaging.md#pkg-001-pin-wrangler-as-a-devdependency-instead-of-relying-on-npx): Pin wrangler as a devDependency instead of relying on npx
- [GEN-002](general.md#gen-002-monthlymix-never-ends-when-activities-are-dated-after-until): monthlyMix never ends when activities are dated after `until`
- [GEN-003](general.md#gen-003-keep-classifier-answers-already-paid-for-when-a-fatal-error-stops-the-run): Keep classifier answers already paid for when a fatal error stops the run
- [GEN-004](general.md#gen-004-one-failing-follow-lookup-aborts-the-whole-follows-scan): One failing follow lookup aborts the whole follows scan
- [GEN-005](general.md#gen-005-rate-limits-and-server-errors-on-getprofile-are-shown-as-deleted): Rate limits and server errors on getProfile are shown as "Deleted"
- [GEN-006](general.md#gen-006-actorfrominput-throws-urierror-on-malformed-percent-encoding): actorFromInput throws URIError on malformed percent-encoding

### Low

- [SEC-001](security.md#sec-001-verify-the-handle-claimed-by-a-did-document-before-showing-it): Verify the handle claimed by a DID document before showing it
- [ORG-006](organization.md#org-006-separate-followsts-into-data-fetching-block-detection-and-follow-stats): Separate follows.ts into data fetching, block detection and follow stats
- [ORG-007](organization.md#org-007-make-test-files-mirror-the-source-modules-they-test): Make test files mirror the source modules they test
- [ORG-008](organization.md#org-008-move-non-ui-modules-out-of-srcui): Move non-UI modules out of src/ui/
- [ORG-009](organization.md#org-009-remove-the-unused-data-theme-dark-palette-from-stylecss): Remove the unused data-theme dark palette from style.css
- [ORG-010](organization.md#org-010-use-one-helper-to-turn-an-unknown-error-into-a-message): Use one helper to turn an unknown error into a message
- [ORG-011](organization.md#org-011-define-own-post-organic-or-quote-once): Define "own post" (organic or quote) once
- [ORG-012](organization.md#org-012-share-number-formatters-and-the-svg-icon-builder-across-ui-modules): Share number formatters and the SVG icon builder across UI modules
- [ORG-013](organization.md#org-013-share-the-bookmarklet-drag-dont-click-handler): Share the bookmarklet "drag, don't click" handler
- [ORG-014](organization.md#org-014-build-dataset-lines-with-one-function-in-the-app-and-the-bench): Build dataset lines with one function in the app and the bench
- [ORG-015](organization.md#org-015-drop-the-logout-pass-through-wrapper): Drop the logOut pass-through wrapper
- [ORG-016](organization.md#org-016-remove-the-stale-testfixtures-entry-from-prettierignore): Remove the stale test/fixtures entry from .prettierignore
- [DOC-003](docs-consistency.md#doc-003-readme-benchmark-dataset-example-is-not-valid-jsonl): README benchmark dataset example is not valid JSONL
- [DOC-004](docs-consistency.md#doc-004-designmd-views-and-entry-points-dont-match-the-ui): DESIGN.md views and entry points don't match the UI
- [DOC-005](docs-consistency.md#doc-005-designmd-data-sources-table-is-incomplete-and-misattributes-endpoints): DESIGN.md data-sources table is incomplete and misattributes endpoints
- [DOC-006](docs-consistency.md#doc-006-designmd-says-no-auth-but-describes-optional-oauth): DESIGN.md says "no auth" but describes optional OAuth
- [DOC-007](docs-consistency.md#doc-007-designmd-taxonomy-doesnt-say-a-reply-that-quotes-counts-as-a-reply): DESIGN.md taxonomy doesn't say a reply that quotes counts as a reply
- [DOC-008](docs-consistency.md#doc-008-guides-status-list-omits-you-block-them): Guide's status list omits "You block them"
- [DOC-009](docs-consistency.md#doc-009-stopword-numbers-comment-and-design-claim-cover-words-not-in-that-list): Stopword "numbers" comment and DESIGN claim cover words not in that list
- [DOC-010](docs-consistency.md#doc-010-current-design-doc-mixes-in-plans-split-roadmap-from-architecture): Current design doc mixes in plans; split roadmap from architecture
- [TST-006](testing.md#tst-006-add-an-offline-car-fixture-test-for-activitiesfromcar-and-downloadrepo): Add an offline CAR fixture test for activitiesFromCar and downloadRepo
- [TST-007](testing.md#tst-007-make-tests-run-automatically-before-deploy): Make tests run automatically before deploy
- [TST-008](testing.md#tst-008-configure-coverage-measurement): Configure coverage measurement
- [PKG-002](packaging.md#pkg-002-packagejson-version-000-disagrees-with-release-tag-v010): package.json version 0.0.0 disagrees with release tag v0.1.0
- [PKG-003](packaging.md#pkg-003-vendored-mit-stopword-lists-ship-without-their-licence-notice): Vendored MIT stopword lists ship without their licence notice
- [PKG-004](packaging.md#pkg-004-typesnode-26-does-not-match-the-pinned-node-22-runtime): @types/node 26 does not match the pinned Node 22 runtime
- [GEN-007](general.md#gen-007-unbounded-parallel-batch-requests-to-the-appview): Unbounded parallel batch requests to the AppView
- [GEN-008](general.md#gen-008-a-handle-lookup-failure-discards-the-whole-what-they-talk-about-card): A handle lookup failure discards the whole "What they talk about" card
- [GEN-009](general.md#gen-009-duplicate-shared-uris-inflate-the-deleted-or-unavailable-count): Duplicate shared URIs inflate the "deleted or unavailable" count

## Consolidation notes

- The `actorFromInput` `URIError` crash was reported by the testing review; the bug is filed as GEN-006 and the missing test as TST-002.
- Losing paid classifier answers on a fatal error is filed as GEN-003; TST-003 covers the matching test gaps.
- High findings (GEN-001, TST-001) and GEN-002, GEN-006 were spot-checked against the code and hold.

## Skipped

- `docs/DISCOVERIES.md` is historical; drift in it was not reported.
- `test:live` (`vitest.live.config.ts`) was not run: it calls the real Bluesky network.
- Coverage was not measured: no coverage provider is configured (see TST-008).
- No CI configuration exists in the repo to review.
- `pnpm-lock.yaml` and the vendored stopword JSON files were checked for sources and licensing only, not line by line.
