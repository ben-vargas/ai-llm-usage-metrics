# OpenCode Provider Progress

## Update protocol

For every task update:

1. What changed
2. Verification commands run
3. Verification evidence (key output lines, counts, or artifact paths)
4. Result (pass/fail)
5. Next action

If the update is planning/docs-only (no implementation changes), verification commands may be marked `N/A (docs-only)`.

Use this evidence format:

```md
- Verification evidence:
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (N test files, M tests)
  - build: PASS
```

## Progress log

### 2026-02-19 - T5 completed (OpenCode e2e + docs finalization)

- What changed:
  - Added OpenCode e2e coverage:
    - `tests/e2e/opencode.e2e.test.ts`
    - explicit `--opencode-db` OpenCode-only reporting
    - unavailable-default OpenCode behavior
    - schema-drift failure visibility for explicit source
    - skipped-row diagnostics emission in terminal mode
  - Added deterministic OpenCode SQLite fixture generation inside tests using `node:sqlite` (no opaque binary fixture dependency).
  - Added adapter-to-build skipped-row propagation:
    - introduced optional `parseFileWithDiagnostics` in `SourceAdapter`
    - `buildUsageData` now consumes per-file `skippedRows` counters when available
    - OpenCode adapter now implements `parseFileWithDiagnostics`
  - Added skipped-row propagation coverage in `tests/cli/build-usage-data.test.ts`.
  - Finalized user-facing docs for OpenCode:
    - path precedence (`--opencode-db` first, deterministic defaults second)
    - backfill/historical rerun guidance
    - DB safety notes (read-only intent, explicit-path validation, CLI optional at runtime)
    - troubleshooting references for schema inspection
  - Updated existing e2e/CLI tests to pin source scope (`pi,codex`) where fixture-only determinism is required.

- Verification commands:
  - `bun run test -- tests/e2e/usage-report.e2e.test.ts`
  - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- Verification evidence:
  - e2e: PASS (includes `tests/e2e/usage-report.e2e.test.ts` + new `tests/e2e/opencode.e2e.test.ts`)
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (34 test files, 184 tests)
  - build: PASS

- Result:
  - PASS (T5 complete; OpenCode integration scope finished end-to-end)

- Next action:
  - OpenCode provider plan implementation complete; ready for final review/merge.

### 2026-02-19 - T4 completed (registration and pipeline integration)

- What changed:
  - Registered OpenCode as a default source in `src/sources/create-default-adapters.ts`.
  - Enabled `--opencode-db` end-to-end (removed reserved/fail-fast behavior; now wired to `OpenCodeSourceAdapter`).
  - Preserved strict directory override semantics:
    - `--source-dir` remains directory-only for `pi`/`codex`
    - `--source-dir opencode=...` still fails with guidance to `--opencode-db`
  - Updated source help/validation path through default source ids (`pi`, `codex`, `opencode`).
  - Extended terminal style policy with OpenCode-specific source styling.
  - Hardened integration/e2e tests to pin intended sources (`pi,codex`) so local OpenCode DB state cannot make tests nondeterministic.
  - Updated user-facing docs to reflect active OpenCode support and current CLI semantics:
    - `README.md`
    - `docs/README.md`
    - `docs/architecture.md`
    - `docs/cli-reference.md`
    - `docs/parsing-and-normalization.md`

- Verification commands:
  - `bun run test -- tests/sources/create-default-adapters.test.ts tests/cli/build-usage-data.test.ts tests/cli/run-usage-report.test.ts tests/render/terminal-style-policy.test.ts tests/cli/emit-diagnostics.test.ts`
  - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- Verification evidence:
  - targeted tests: PASS (5 test files, 58 tests)
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (33 test files, 179 tests)
  - build: PASS

- Result:
  - PASS (T4 integration complete and verified)

- Next action:
  - Start T5 (e2e expansion + docs finalization/migration guidance).

### 2026-02-19 - T3 completed (OpenCode SQLite adapter)

- What changed:
  - Added deterministic default DB path resolver:
    - `src/sources/opencode/opencode-db-path-resolver.ts`
    - platform-specific deterministic candidate lists (Linux/macOS/Windows)
  - Implemented OpenCode SQLite source adapter:
    - `src/sources/opencode/opencode-source-adapter.ts`
    - read-only DB open semantics via Node 24 `node:sqlite`
    - deterministic extraction ordering (`timestamp`, `id`)
    - schema probing (`sqlite_master`, `PRAGMA table_info('message')`)
    - primary extraction query + fallback query path when `json_extract` is unavailable
    - defensive JSON parsing, assistant-role filtering, token/provider/model/cost mapping
    - timestamp resolution with seconds/ms normalization and payload fallback
    - malformed/incomplete-row skip behavior
    - bounded busy/locked retry with actionable exhaustion error
  - Added unit tests:
    - `tests/sources/opencode-db-path-resolver.test.ts`
    - `tests/sources/opencode-source-adapter.test.ts`

- Verification commands:
  - `bun run test -- tests/sources/opencode-source-adapter.test.ts`
  - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- Verification evidence:
  - adapter tests: PASS (2 test files, 10 tests)
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (33 test files, 179 tests)
  - build: PASS

- Result:
  - PASS (T3 implementation complete and verified)

- Next action:
  - Start T4 (registration and pipeline integration).

### 2026-02-19 - T2 completed (Phase 1 contracts/CLI semantics)

- What changed:
  - Added OpenCode DB override contract wiring:
    - CLI shared option `--opencode-db <path>` (`src/cli/create-cli.ts`)
    - typed command option `opencodeDb?: string` (`src/cli/usage-data-contracts.ts`)
    - adapter-factory option passthrough (`src/sources/create-default-adapters.ts`)
  - Hardened source-dir semantics:
    - `--source-dir` remains directory-only allowlist (`pi`, `codex`)
    - `--source-dir opencode=...` now fails with actionable guidance to `--opencode-db`
    - `--opencode-db` currently validates non-empty and fails fast with explicit "not available yet" message until adapter integration is added
  - Extended diagnostics contracts and behavior for parse/drift visibility:
    - Added `sourceFailures[]` and `skippedRows[]` fields to usage diagnostics
    - Updated `buildUsageData` to settle source parsing per adapter, record non-explicit source failures in diagnostics, and hard-fail explicit source failures
    - Added terminal diagnostics emission for source failures and skipped-row counters
  - Added/updated tests for new behavior:
    - `tests/cli/create-cli.test.ts`
    - `tests/sources/create-default-adapters.test.ts`
    - `tests/cli/build-usage-data.test.ts`
    - `tests/cli/emit-diagnostics.test.ts`
    - `tests/render/render-usage-report.test.ts`

- Verification commands:
  - `bun run test -- tests/cli/create-cli.test.ts tests/sources/create-default-adapters.test.ts tests/cli/build-usage-data.test.ts tests/cli/run-usage-report.test.ts tests/cli/emit-diagnostics.test.ts`
  - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

- Verification evidence:
  - targeted tests: PASS (5 test files, 56 tests)
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (31 test files, 169 tests)
  - build: PASS

- Result:
  - PASS (T2 acceptance criteria implemented and verified)

- Next action:
  - Start T3 (OpenCode SQLite adapter implementation).

### 2026-02-19 - Plan synchronization and task realignment

- What changed:
  - Synchronized task definitions with the updated plan phases and acceptance criteria.
  - Expanded T2-T5 scopes to include: `--opencode-db` contract wiring, strict `--source-dir` semantics, source-failure/skipped-row diagnostics, locked/busy DB handling, and explicit docs/e2e coverage expectations.
  - Added explicit runtime policy note: Bun remains valid for dev/test execution (`bun run ...`), while runtime SQLite integration targets Node 24 `node:sqlite`.

- Verification commands:
  - `N/A (docs-only update: plan/task/progress alignment)`

- Verification evidence:
  - docs-only: updated `ai/opencode-provider-plan.md`, `ai/opencode-provider-tasks.md`, and `ai/opencode-provider-progress.md`
  - no source code files were modified in this update

- Result:
  - PASS (planning artifacts synchronized)

- Next action:
  - Start T2 (Phase 1 contracts and CLI/path semantics hardening).

### 2026-02-18 - T1 completed

- What changed:
  - Added generic source directory override support via `--source-dir <source-id=path>`.
  - Removed implicit default provider filtering; provider filtering is now opt-in.
  - Updated source ordering to follow adapter registration order with lexical fallback.
  - Fixed source wiring docs drift in contributor/development docs.
  - Added/updated tests for new behavior.

- Verification commands:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run format:check`
  - `bun run test`
  - `bun run build`

- Verification evidence:
  - lint: PASS
  - typecheck: PASS
  - format: PASS
  - test: PASS (28 test files, 135 tests)
  - build: PASS

- Result:
  - PASS (`28` test files, `135` tests)

- Next action:
  - Start T2 (OpenCode adapter implementation).

## Current status

- T1: done
- T2 (Phase 1 contracts/CLI): done
- T3 (Phase 2 adapter): done
- T4 (Phase 3 integration): done
- T5 (Phase 4 e2e/docs): done
