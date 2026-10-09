# Packaging review: Skydex

Scope: whole repository · Commit: d9aed58 · Date: 2026-10-08

Packaging is mostly sound. Every import in `src/`, `test/`, `bench/` and the
config files is declared in `package.json`, and every declared dependency is
used. The lockfile importers match `package.json`. `LICENSE` matches the
declared AGPL-3.0-or-later, and the vendored MIT licence sits next to its
data. There is no CI config in the repo to review. Four findings, all medium
or low.

## PKG-001: Pin wrangler as a devDependency instead of relying on npx

- **Severity:** medium
- **Confidence:** high
- **Location:** `README.md:84`, `package.json:22-33`, `wrangler.jsonc:1-9`
- **Labels:** packaging, deploy

The documented deploy command is `npx wrangler deploy` (`README.md:84`), but
wrangler is not in `devDependencies` (`package.json:22-33`) or in
`pnpm-lock.yaml`, and `node_modules/.bin` has no wrangler binary. Each deploy
downloads whatever version npx resolves, outside the lockfile and outside the
`allowBuilds` install-script policy in `pnpm-workspace.yaml`. All other
tooling is pinned through the lockfile.

**Why it matters:** a new or broken wrangler release can change or break
production deploys with no commit in the repo, and the failure can't be
reproduced locally at a known version.

**Suggested fix:** add `wrangler` to devDependencies, add a
`"deploy": "wrangler deploy"` script, and change the README and Cloudflare
deploy command to `pnpm exec wrangler deploy`.

**Done when:** `pnpm ls wrangler` shows a locked version and the documented
deploy command runs that local binary.

## PKG-002: package.json version 0.0.0 disagrees with release tag v0.1.0

- **Severity:** low
- **Confidence:** high
- **Location:** `package.json:4`, `vite.config.ts:11-21`
- **Labels:** packaging, metadata

The repo has a release tag `v0.1.0`, and the footer version comes from
`git describe --tags` (`vite.config.ts:14`). `package.json:4` still says
`"version": "0.0.0"`, including at the tagged commit
(`git show v0.1.0:package.json`). There are two version sources that disagree.

**Why it matters:** tooling or readers that look at `package.json` get a
version that doesn't match the released one shown in the footer.

**Suggested fix:** bump `package.json` to `0.1.0` and keep it in step when
tagging, or document that git tags are the only version source and leave
`0.0.0` on purpose.

**Done when:** `package.json`'s version matches the latest tag, or a
documented rule says which source wins.

## PKG-003: Vendored MIT stopword lists ship without their licence notice

- **Severity:** low
- **Confidence:** medium
- **Location:** `src/vendor/stopwords-iso/README.md:1-13`, `src/vendor/stopwords-iso/LICENSE:1-3`, `vite.config.ts:88-120`
- **Labels:** packaging, licensing

The stopwords-iso `en.json` and `fr.json` lists are MIT-licensed and bundled
into the deployed JavaScript via `src/stopwords.ts`. MIT asks for its notice
in "all copies or substantial portions". The repo keeps the notice, but the
build does not: `hostingFiles()` (`vite.config.ts:88-120`) emits only
`client-metadata.json` and `_headers`, and no HTML page credits stopwords-iso.
Confidence is medium: whether a stopword list is copyrightable, and whether
the bundle is a substantial portion, is a judgement call.

**Why it matters:** the deployed site redistributes MIT-licensed data without
the attribution that licence asks for.

**Suggested fix:** emit a `THIRD_PARTY_LICENSES.txt` into `dist/` from the
vendored LICENSE, or credit stopwords-iso with its licence on the privacy or
guide page.

**Done when:** the built `dist/` contains or links the stopwords-iso MIT
notice.

## PKG-004: @types/node 26 does not match the pinned Node 22 runtime

- **Severity:** low
- **Confidence:** medium
- **Location:** `.node-version:1`, `package.json:24`, `tsconfig.bench.json:1-7`
- **Labels:** packaging, pinning

`.node-version` pins Node `22`, but devDependencies declare
`"@types/node": "^26.6.2"`. `tsconfig.bench.json` type-checks `bench/run.ts`
(node:fs, node:path, node:util) against Node 26 types, so type checks accept
APIs missing on Node 22 and the error only appears at runtime. The APIs used
today (`readFileSync`, `writeFileSync`, `basename`, `parseArgs`) all exist on
Node 22, so nothing is broken now.

**Why it matters:** `tsc -p tsconfig.bench.json` in `check.sh` can't catch
the bench script or `vite.config.ts` using an API the pinned runtime lacks.

**Suggested fix:** change the range to `"@types/node": "^22"`, or move
`.node-version` to 26 if that is the intended runtime.

**Done when:** the @types/node major equals the `.node-version` major and
`./check.sh` passes.
