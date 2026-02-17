# Development Guide

## Requirements

- Node.js 20+
- Bun (used for local scripts and lockfile)

## Install

```bash
bun install
```

## Local quality checks

Run these before opening a PR:

```bash
bun run lint
bun run typecheck
bun run test
bun run format:check
```

## Build and packaging

Build CLI bundle:

```bash
bun run build
```

Check npm package output:

```bash
bun run pack:check
```

## Test layout

- Unit tests: `tests/**`
- Fixture-based parser tests: `tests/fixtures/**`
- End-to-end report tests: `tests/e2e/**`

## CI

Workflow file: `.github/workflows/ci.yml`

CI runs on pull requests and pushes to `main` and `master`.

Checks:

- install (`bun install --frozen-lockfile`)
- lint
- typecheck
- test
- format check
- build
- npm pack check

Matrix:

- Node 20
- Node 22

## Adding a new source adapter

1. Create `src/sources/<name>/<name>-source-adapter.ts`
2. Implement `SourceAdapter`
3. Normalize output through `createUsageEvent`
4. Add fixture tests under `tests/sources`
5. Wire into CLI report pipeline if needed

Keep parsing logic isolated to the adapter. Do not spread source-specific assumptions across aggregation or rendering.
