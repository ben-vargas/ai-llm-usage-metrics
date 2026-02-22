# OpenCode Provider Tasks

## Workflow rule

After each task:

1. Run the listed verification commands.
2. Record outcome in `ai/opencode-provider-progress.md`.
3. Only then move to the next task.

## Task checklist

- [x] T1 - Source friction cleanup foundation
  - Scope:
    - add generic `--source-dir <id=path>`
    - remove implicit default provider filtering
    - make source ordering adapter-driven
    - align docs with actual wiring flow
  - Verification:
    - `bun run lint`
    - `bun run typecheck`
    - `bun run format:check`
    - `bun run test`
    - `bun run build`

- [x] T2 - Phase 1 contracts and CLI/path semantics hardening
  - Scope:
    - add `--opencode-db <path>` in shared CLI options (`src/cli/create-cli.ts`)
    - add `opencodeDb?: string` to `ReportCommandOptions` (`src/cli/usage-data-contracts.ts`)
    - add `opencodeDb?: string` to default adapter factory options (`src/sources/create-default-adapters.ts`)
    - keep `--source-dir` directory-only with explicit allowlist (`pi`, `codex`)
    - reject `--source-dir opencode=...` with actionable guidance to use `--opencode-db`
    - extend diagnostics contracts for source parse failures and skipped-row counters
    - runtime policy note: Bun is allowed for dev/test commands; runtime SQLite integration targets Node 24 (`node:sqlite`)
  - Verification:
    - `bun run test -- tests/cli/create-cli.test.ts tests/sources/create-default-adapters.test.ts tests/cli/build-usage-data.test.ts tests/cli/run-usage-report.test.ts tests/cli/emit-diagnostics.test.ts`
    - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- [x] T3 - Phase 2 OpenCode SQLite adapter implementation
  - Scope:
    - create `src/sources/opencode/opencode-source-adapter.ts`
    - read OpenCode SQLite in read-only mode via Node 24 `node:sqlite`
    - implement deterministic extraction query (`message` assistant rows ordered by `time_created`, `id`)
    - enforce timestamp/provider/model/token/cost mapping contract from the plan
    - probe schema (`sqlite_master` / `PRAGMA table_info`) and support documented fallback extraction shape
    - treat malformed rows as non-fatal skips with deterministic behavior
    - implement bounded retry behavior for busy/locked database errors
  - Verification:
    - `bun run test -- tests/sources/opencode-source-adapter.test.ts`
    - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- [x] T4 - Phase 3 registration and pipeline integration
  - Scope:
    - register OpenCode in `src/sources/create-default-adapters.ts`
    - include `opencode` in default source id help/validation path (`getDefaultSourceIds`)
    - ensure `--source opencode` works with existing filtering/date/pricing/aggregation flow
    - ensure `--opencode-db` override is respected end-to-end
    - preserve deterministic source ordering and keep `--source-dir opencode=...` invalid
    - extend terminal style policy to support OpenCode source coloring
    - extend diagnostics emission to include source-failure/skipped-row details
    - implement failure policy: explicit source/override failures are hard-fail; non-explicit unavailable sources are diagnostics-visible and deterministic
  - Verification:
    - `bun run test -- tests/sources/create-default-adapters.test.ts tests/cli/build-usage-data.test.ts tests/cli/run-usage-report.test.ts tests/render/terminal-style-policy.test.ts tests/cli/emit-diagnostics.test.ts`
    - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- [x] T5 - Phase 4 e2e coverage and docs
  - Scope:
    - add deterministic SQLite fixture strategy for OpenCode tests
    - add OpenCode-only and mixed-source e2e scenarios
    - add e2e cases for explicit override, unavailable-default behavior, and schema-drift/row-skip visibility
    - update docs to match behavior:
      - `README.md`
      - `docs/cli-reference.md`
      - `docs/architecture.md`
      - `docs/parsing-and-normalization.md`
      - `docs/development.md`
      - `docs/README.md`
    - include `--opencode-db` precedence, `--source opencode` examples, and explicit `--source-dir` directory-only rule
    - include migration/backfill guidance and DB path security notes
    - validate all documented command snippets against the real CLI
  - Verification:
    - `bun run test -- tests/e2e/usage-report.e2e.test.ts`
    - manual snippet validation
    - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`
