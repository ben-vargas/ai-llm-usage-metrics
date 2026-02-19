# Contributing

Thanks for contributing.

## Development setup

Requirements:

- Node.js 24+
- Bun

Install dependencies:

```bash
bun install
```

Run checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run format:check
```

## Project shape

Main directories:

- `src/cli`: command wiring and report orchestration
- `src/sources`: source adapters (`pi`, `codex`, etc.)
- `src/domain`: normalized event/report types
- `src/pricing`: pricing loaders + cost engine
- `src/aggregate`: period aggregation
- `src/render`: terminal/markdown output
- `tests`: unit, fixture, and e2e tests

More detail: `docs/architecture.md`.

## Contribution style

- Keep functions small and explicit.
- Prefer data normalization at boundaries (adapters/domain constructors).
- Avoid hidden behavior and broad implicit defaults.
- Add or update tests with every functional change.

## Adding a new source (Claude, Gemini, etc.)

The codebase supports this through `SourceAdapter`.

### 1) Create an adapter

Add `src/sources/<name>/<name>-source-adapter.ts` implementing:

- `id`
- `discoverFiles()`
- `parseFile(filePath)`

Normalize raw data with `createUsageEvent` so downstream code receives consistent `UsageEvent` values.

### 2) Wire it into reporting

Register the adapter in `src/sources/create-default-adapters.ts`.

If the source should be selectable from CLI source filtering/help text, ensure its id is included via
`getDefaultSourceIds()` (same file).

When needed, add CLI docs/examples for source-specific directory overrides using:

```bash
llm-usage daily --source-dir <new-source-id>=/path/to/sessions
```

### 3) Add tests

- fixture-based parser tests in `tests/sources`
- integration coverage if CLI behavior changes

### 4) Verify source filter behavior

`--source` filtering is source-id based and case-insensitive. Confirm the new source id is filterable:

```bash
llm-usage daily --source <new-source-id>
```

## Adding/changing pricing behavior

- Implement or adjust a `PricingSource` in `src/pricing`.
- Keep explicit cost untouched.
- Keep estimation logic deterministic.
- Add tests for missing pricing, aliasing, and edge values.

## Commit guidance

Use concise Conventional Commit subjects, for example:

- `fix(cli): validate source filter input`
- `feat(source): add gemini session adapter`
- `docs(project): expand adapter contribution guide`

## Before opening a PR

Run the full check suite:

```bash
bun run lint && bun run typecheck && bun run test && bun run format:check
```
