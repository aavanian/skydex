# Docs consistency review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

## Documentation inventory

| File                                 | Class                                   | Reason                                                                                 |
| ------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `README.md`                          | current                                 | Usage, develop, benchmark and deploy instructions                                      |
| `docs/DESIGN.md`                     | current (with planned content mixed in) | README:33 calls it "how it works", but it also holds plans ("first target", "(later)") |
| `docs/DISCOVERIES.md`                | historical                              | Dated log of lessons learned and API quirks                                            |
| `guide/index.html`                   | current                                 | User guide; README:30-31 says keep it in step with the code                            |
| `privacy/index.html`                 | current                                 | Privacy and data-flow statement; README:30-31 says keep it in step                     |
| `src/vendor/stopwords-iso/README.md` | current                                 | Provenance (pinned commits, licence) of vendored files                                 |
| `package.json` `description`         | current                                 | Packaging metadata                                                                     |
| `src/ui/intro.ts` (start-page text)  | current                                 | Text shown in the UI                                                                   |
| `bench/run.ts` header docstring      | current                                 | CLI usage reference                                                                    |
| `callback/index.html`                | current (UI, not docs)                  | Login popup landing page, one sentence                                                 |

10 findings: 2 medium, 8 low. No file contains text addressed to an AI or
agent.

## DOC-001: Privacy page omits did:web hosts and followed accounts' servers

- **Severity:** medium
- **Confidence:** high
- **Location:** `privacy/index.html:45-54`, `src/repo.ts:22-28`, `src/repo.ts:76-85`, `src/follows.ts:258-272`, `src/follows.ts:312-324`
- **Labels:** docs, privacy

The page says the browser contacts only `public.api.bsky.app`,
`plc.directory` and "the account's data server" (`privacy/index.html:47-51`).
The code also fetches `https://<domain>/.well-known/did.json` for `did:web`
accounts (`src/repo.ts:24-25`), an arbitrary third party. The follows scan
resolves followed accounts missing from `getFollows` and reads their block
records from their own data servers (`src/follows.ts:263-270`, `blocksYou`),
and fetches the DID document of every unavailable account (`lastHandle`,
`:315`). Many other servers therefore see the viewer's IP address.

**Why it matters:** README:30-31 makes this page the contract for what data
goes where; it understates which third parties see the viewer.

**Suggested fix:** add that did:web accounts are resolved from their own
domain, and that the follows scan queries followed accounts' identity
records and data servers to detect blocks and deleted accounts.

**Done when:** the page names did:web domains and followed accounts' data
servers among the parties contacted.

## DOC-002: DESIGN.md describes a heuristic classifier and adapters that don't exist

- **Severity:** medium
- **Confidence:** high
- **Location:** `docs/DESIGN.md:127-135`, `docs/DESIGN.md:146-157`, `docs/DESIGN.md:182-183`, `src/classify/decisions.ts:1-145`, `src/ui/settings.ts:70-87`
- **Labels:** docs, classify

DESIGN.md describes a "Pluggable `Classifier` interface" (127), a "Heuristic
(always on)" classifier with promotional/snark rules (129-135), "Pluggable
provider adapters, selected in settings" (146) and tested "heuristics" (182).
None exist: searching `src/`, `bench/`, `test/` for "heuristic",
"Classifier" and "provider" finds nothing. Tags come only from the OpenRouter
Decisions API via `decide()` (`decisions.ts:117`); settings expose only a
model id (`ui/settings.ts:70-87`); without a key no tags are shown
(`ui/content.ts:185-187`).

**Why it matters:** contributors look for code that isn't there, and readers
may expect tags without a key.

**Suggested fix:** rewrite "Classification" to describe the Decisions API,
`CONTENT_QUESTIONS`, derived `political_snark`, `AnswerCache` and the model
setting; move the heuristic and chat-LLM ideas to a roadmap (DOC-010); drop
"heuristics" from "Testing".

**Done when:** every component named in DESIGN.md's Classification and
Testing sections exists, or is clearly labelled as not implemented.

## DOC-003: README benchmark dataset example is not valid JSONL

- **Severity:** low
- **Confidence:** high
- **Location:** `README.md:42-50`, `README.md:56-68`, `src/classify/dataset.ts:51-59`, `bench/run.ts:10,42`
- **Labels:** docs, bench

The README asks for "one JSON object per line" but shows the example over
four lines (`README.md:45-50`). `parseDataset` parses line by line, so a file
copied from it fails with "Line 1 is not valid JSON" (`dataset.ts:52-58`).
The CLI docstring shows the one-line form correctly (`bench/run.ts:14-15`).
The README also omits the `--threshold` option (`bench/run.ts:10,42`).

**Why it matters:** copying the documented example yields a dataset the
benchmark rejects.

**Suggested fix:** show the example on one line and mention `--threshold`
(default 0.5).

**Done when:** a file pasted from the README parses with `parseDataset`, and
every `bench/run.ts` option is in the README.

## DOC-004: DESIGN.md views and entry points don't match the UI

- **Severity:** low
- **Confidence:** high
- **Location:** `docs/DESIGN.md:29-31`, `docs/DESIGN.md:69-89`, `src/ui/profile.ts:122-126`, `src/ui/profile.ts:142-256`, `src/ui/terms.ts:112,120-122`, `src/ui/follows.ts:317-325`, `src/bookmarklet.ts:6-10`, `src/main.ts:220-222`
- **Labels:** docs, ui

- **Monthly chart:** DESIGN says stacked area chart of type share; the code
  draws monthly stacked bars (`Plot.rectY`) with a Counts/Share toggle and a
  table (`profile.ts:157-197`).
- **Posting frequency:** DESIGN lists a rolling posts/week chart; only a
  90-day vs. lifetime tile exists (`profile.ts:122-126`).
- **"Own" content:** DESIGN says organic; code counts organic plus quote
  (`terms.ts:120-122`), as the UI says (`terms.ts:112`).
- **Follows table:** the column list omits "Repost share" (`follows.ts:323`).
- **Bookmarklet:** DESIGN says it parses `/profile/<actor>`; it passes the
  whole `location.href` as `?actor=` and the app parses it
  (`bookmarklet.ts:9`, `main.ts:220-222`).

**Why it matters:** the doc misdescribes what the profile shows and where
parsing happens.

**Suggested fix:** update the Views and Entry points lists.

**Done when:** each item in DESIGN.md's Views and Entry points matches a
rendered card, column or code path.

## DOC-005: DESIGN.md data-sources table is incomplete and misattributes endpoints

- **Severity:** low
- **Confidence:** high
- **Location:** `docs/DESIGN.md:34-43`, `src/follows.ts:101,127,215,251,286-301`, `src/shared.ts:125`, `src/cached.ts:21`, `src/repo.ts:24-25`
- **Labels:** docs, architecture

Missing from the table: PDS `com.atproto.repo.listRecords` (main source of
follow and block records, `follows.ts:215,286-301`), `app.bsky.feed.getAuthorFeed`
(`follows.ts:127`), `app.bsky.actor.getProfiles` (`shared.ts:125`) and
`com.atproto.sync.getLatestCommit` (`cached.ts:21`, prose only at
DESIGN.md:21). Misdescribed: `getProfile` is listed for "display name,
counts" but is used only to classify unavailable accounts
(`follows.ts:246-256`); `getFollows` is listed as "follows list" but is used
only to spot follows hidden by a block (`follows.ts:299,302`).

**Why it matters:** the table is the quickest map of external dependencies,
and CORS claims hang on it.

**Suggested fix:** list every endpoint with its real purpose.

**Done when:** every XRPC method and host in `src/` appears in the table with
an accurate purpose.

## DOC-006: DESIGN.md says "no auth" but describes optional OAuth

- **Severity:** low
- **Confidence:** high
- **Location:** `docs/DESIGN.md:13`, `docs/DESIGN.md:102-123`, `src/auth/session.ts:27-37`
- **Labels:** docs

"Static web app ..., no server, no auth" (`DESIGN.md:13`) contradicts the
same document's optional atproto OAuth section (102-123), which the code
implements. README:13-16 gets it right.

**Why it matters:** the doc contradicts itself in its opening summary.

**Suggested fix:** "no server; optional Bluesky login (unfollow only) and
OpenRouter key".

**Done when:** DESIGN.md:13 is consistent with the Unfollowing section.

## DOC-007: DESIGN.md taxonomy doesn't say a reply that quotes counts as a reply

- **Severity:** low
- **Confidence:** medium
- **Location:** `docs/DESIGN.md:47-58`, `src/taxonomy.ts:19-36`
- **Labels:** docs, taxonomy

DESIGN lists repost, quote, reply, organic and defines quote as any post with
a record embed. In code the reply check runs first, so a reply to someone
else that quotes a post is a **reply** (`taxonomy.ts:34-35`; docstring at
`:21-23` says so). DESIGN never states the precedence and its order suggests
quote wins.

**Why it matters:** it changes which posts count as "own" content and reach
the classifier.

**Suggested fix:** add "a reply to someone else is a reply even if it embeds
a quote".

**Done when:** DESIGN.md states the reply-over-quote precedence.

## DOC-008: Guide's status list omits "You block them"

- **Severity:** low
- **Confidence:** high
- **Location:** `guide/index.html:92-100`, `src/ui/follows.ts:31-42`, `src/follows.ts:320`
- **Labels:** docs, guide

The follows scan can show "You block them" (`follows.ts:320`,
`ui/follows.ts:36`), but the guide's Statuses list covers Dormant, No own
posts lately, Deactivated/Deleted/Suspended, Blocks you and Hidden by a block
only. DESIGN.md:91-92 does describe it.

**Why it matters:** users see a status the guide doesn't explain.

**Suggested fix:** add "**You block them**: their follow is hidden because
you block them" (and optionally "Never posted").

**Done when:** every non-obvious label in `STATUS_LABELS` is defined in the
guide.

## DOC-009: Stopword "numbers" comment and DESIGN claim cover words not in that list

- **Severity:** low
- **Confidence:** high
- **Location:** `src/stopwords.ts:24-33`, `docs/DESIGN.md:160-163`
- **Labels:** docs, topics

`CALENDAR_AND_NUMBERS` and its comment "Dates and counting, in English and
French" (`stopwords.ts:24-27`) contain only month and weekday names.
DESIGN.md:162-163 also says Skydex's own additions include "number words".
Number words now come from the vendored stopwords-iso lists (e.g. `"three"`,
`"hundred"`, `"deux"`, `"mille"`).

**Why it matters:** a maintainer looking for number-word filtering is
pointed at the wrong list.

**Suggested fix:** rename the constant and comment to calendar words; in
DESIGN, attribute number words to stopwords-iso.

**Done when:** comment, constant name and DESIGN.md match the list's
contents.

## DOC-010: Current design doc mixes in plans; split roadmap from architecture

- **Severity:** low
- **Confidence:** medium
- **Location:** `docs/DESIGN.md:127-157`, `README.md:33-34`
- **Labels:** docs, organization

README points to `docs/DESIGN.md` as "how it works", but parts are plans:
the unimplemented `Classifier` interface and heuristics (DOC-002), "Decision
API (first target)" and "Chat LLM (later)" (147, 156). Readers can't tell
built from intended. `DISCOVERIES.md` is correctly separate.

**Why it matters:** mixed current and future content makes the design doc
unreliable, as DOC-002 shows.

**Suggested fix:** `docs/DESIGN.md` for current architecture only;
`docs/ROADMAP.md` for unbuilt ideas (heuristic tagger, chat-LLM adapters,
provider selection); `docs/DISCOVERIES.md` unchanged. Link all three from
README's "Develop" section.

**Done when:** DESIGN.md has no "later"/"first target" items and planned work
lives in a separately linked file.
