# AGENTS.md

## Purpose

Guidance for coding agents working in this repository.

## Project Snapshot

- Type: TypeScript CLI (`llm-usage-metrics`)
- Runtime: Node.js 24+
- Package/dev workflow: Bun (`bun.lock`)
- Core job: parse local usage data, normalize events, apply pricing, aggregate, render reports

## Setup and Commands

- Install: `bun install`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Tests (with coverage): `bun run test`
- Format check: `bun run format:check`
- Build: `bun run build`

Before opening a PR, run:
`bun run lint && bun run typecheck && bun run test && bun run format:check`

## Architecture Boundaries

- `src/cli`: command wiring and report orchestration
- `src/sources`: source adapters + discovery/parsing
- `src/domain`: normalized data contracts
- `src/pricing`: pricing source + cost engine
- `src/aggregate`: usage bucketing/totals
- `src/render`: terminal/markdown/json output formatting
- `src/update`: startup update notifier

Keep source-specific parsing logic inside adapters. Keep pricing logic in `src/pricing`. Keep rendering concerns in `src/render`.

## Coding Style

- Follow strict TypeScript and existing ESLint rules.
- Use type imports where possible.
- Do not introduce `any`.
- Prefer small, explicit functions over implicit behavior.
- Normalize data at boundaries (adapter/domain constructors).
- Preserve deterministic output ordering.
- Avoid inline dynamic imports.

## CLI and Output Rules

- Keep option semantics aligned with `docs/cli-reference.md`.
- Validate inputs early and fail with actionable errors.
- Keep report output data-only on `stdout` (especially `--json`/`--markdown`).
- Emit diagnostics to `stderr`.

## Testing Expectations

- Every functional change should include or update tests.
- Place tests by area:
  - `tests/cli`
  - `tests/sources`
  - `tests/pricing`
  - `tests/render`
  - `tests/e2e`
- For new sources, add fixture-based parser tests and adapter wiring tests.

## Documentation Updates

Update docs when behavior changes:

- `README.md` for user-facing behavior/examples
- `docs/cli-reference.md` for option semantics
- `docs/architecture.md` when layering or flow changes

## Commit and PR Guidance

- Use concise Conventional Commit subjects (e.g. `fix(cli): ...`, `feat(source): ...`).
- Keep commits focused and isolated by concern.
- Include a short validation summary in PR descriptions.
