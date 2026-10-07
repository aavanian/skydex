#!/usr/bin/env bash
# Validates the project: formatting, lint, types and tests.
set -euo pipefail
cd "$(dirname "$0")"

pnpm exec prettier --check .
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm exec vitest run
