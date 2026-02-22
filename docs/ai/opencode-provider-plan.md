# OpenCode Provider Integration Plan

## Objective

Add OpenCode as a first-class usage source while keeping the reporting pipeline source-agnostic and maintainable.

This plan is **implementation-grade** (not MVP): it includes schema drift handling, path semantics, deterministic behavior, and full verification requirements.

## Runtime Baseline Assumption

- Project runtime baseline is **Node.js 24 LTS**.
- Plan/implementation should target Node 24 directly.
- Do **not** add compatibility shims, polyfills, or branching logic for older Node baselines (20/22).

---

## Current Baseline (already true in codebase)

The following foundation work is already present and should be treated as baseline, not re-implemented:

- Generic source override flag exists: `--source-dir <source-id=path>`.
- Provider filtering is explicit/opt-in via `--provider` (no implicit default provider filter).
- Source ordering is adapter-registration driven with lexical fallback.
- Source wiring is centralized in `src/sources/create-default-adapters.ts`.
- Reporting layers are separated (`buildUsageData` / `renderUsageReport` / `emitDiagnostics`).

Any OpenCode work must build on this baseline.

---

## Verified OpenCode Facts (implementation inputs)

- OpenCode usage/session history is SQLite-backed (not JSONL).
- DB location must be resolved robustly (do not hardcode one OS path):
  - prefer `opencode db path` for operator/debug guidance
  - support explicit CLI override for runtime behavior
- Useful inspection commands:
  - `opencode debug paths`
  - `opencode session list`
  - `opencode stats --days 30 --models 10`
  - `opencode db "select name from sqlite_master where type='table'"`
  - `opencode db --format json "<sql>"`
  - `opencode export <sessionID>`
- Tables observed for extraction: `session`, `message`, `part`.
- Usage-like payload fields commonly appear in `message.data` JSON:
  - `role`, `providerID`, `modelID`
  - `tokens.input`, `tokens.output`, `tokens.reasoning`
  - `tokens.cache.read`, `tokens.cache.write`
  - `tokens.total`
  - `cost`

Because schema can evolve, implementation must include drift-tolerant extraction and explicit tests for missing/shifted fields.

---

## Critical Design Decisions (must be finalized before coding)

1. **SQLite access strategy (Node 24 baseline)**
   - Use Node 24 stdlib SQLite (`node:sqlite`) in read-only mode for runtime parsing.
   - Enforce read-only/immutable DB access semantics (no writes, no schema mutations).
   - Use prepared statements and deterministic queries; do not shell out to OpenCode CLI at runtime.
   - Define busy/lock behavior explicitly (bounded retries + actionable terminal error on exhaustion).
   - Runtime reporting must not require OpenCode CLI installation.
   - OpenCode CLI commands are diagnostics/operator tools, not runtime dependencies.
   - Avoid adding legacy-runtime fallback code paths for older Node versions.

2. **Path override semantics for file-backed sources**
   - `--source-dir` is directory-oriented and semantically awkward for DB files.
   - Add explicit DB file override support for OpenCode (`--opencode-db`) as the canonical path override.
   - Do not overload `--source-dir` for OpenCode DB selection; keep `--source-dir` for directory-backed sources.
   - Keep an explicit `--source-dir` allowlist for directory sources (`pi`, `codex`) even after `opencode` registration.
   - Keep the directory allowlist implementation independent from adapter registration lists (`sourceRegistrations` / `getDefaultSourceIds`), so adding DB-backed sources never auto-enables `--source-dir` for them.
   - `--source-dir opencode=...` must fail fast with an error that points users to `--opencode-db`.
   - Keep behavior deterministic and documented (no hidden fallback paths beyond explicit defaults).

3. **Deterministic ordering and filtering responsibilities**
   - Adapter emits normalized events only.
   - Date/provider filtering remains in build layer unless a measurable performance reason justifies SQL prefiltering.

4. **Failure isolation and diagnostics contract**
   - Source-level parse failures must be visible in diagnostics (not silent).
   - Non-fatal row skips (malformed JSON, missing usage fields) must be counted and surfaced per source.
   - Multi-source runs should not silently degrade: if a source is explicitly requested/overridden and fails, the command must fail.
   - If a non-explicit optional source fails discovery/parsing, behavior must be deterministic and documented.

---

## Target Architecture

1. Keep parser isolation through `SourceAdapter`.
2. Keep aggregation/rendering source-agnostic.
3. Keep diagnostics and stdout side effects only in existing orchestration layers.
4. Keep source extension points generic (no special-case branching scattered across CLI/render/aggregate).

---

## Execution Phases

### Phase 1 — Contracts and CLI/path semantics hardening

- Extend CLI/options contracts for OpenCode DB path override:
  - `src/cli/create-cli.ts`: add `--opencode-db <path>` on shared options.
  - `src/cli/usage-data-contracts.ts`: add typed `opencodeDb?: string` in `ReportCommandOptions`.
  - `src/sources/create-default-adapters.ts`: add `opencodeDb?: string` to adapter factory options.
  - `src/cli/build-usage-data.ts`: ensure options pass-through remains type-safe end-to-end.
- Define path precedence explicitly (highest to lowest), e.g.:
  1. `--opencode-db`
  2. platform/default OpenCode DB path
- Define the default-path resolver contract explicitly:
  - use a deterministic, documented candidate-path list per OS (no implicit glob/search crawling)
  - centralize resolver logic in a dedicated helper/module with unit tests
  - keep runtime path resolution independent from OpenCode CLI invocation
- Keep `--source-dir` directory-only:
  - reject `--source-dir opencode=...` even after OpenCode is registered.
  - keep explicit allowlist semantics for `--source-dir` validation.
  - implement this via a dedicated directory-source allowlist that is not derived from adapter registration order/source ids.
- Add validation/error messages for malformed path options and unreadable explicit DB paths.
- Extend diagnostics contracts to support source parse issues (failed source count + skipped row counters), so drift/partial failures are visible.
- Define source-explicitness rules used by failure policy and tests:
  - explicit when source is selected by `--source`
  - explicit when source has an explicit override flag (e.g., `--opencode-db`)
  - non-explicit otherwise (default/source-discovery path)

Verification:

- `bun run lint`
- `bun run typecheck`
- `bun run format:check`
- `bun run test`
- `bun run build`
- targeted contract/CLI tests:
  - `tests/cli/create-cli.test.ts`
  - `tests/sources/create-default-adapters.test.ts`
  - `tests/cli/run-usage-report.test.ts`
  - `tests/cli/build-usage-data.test.ts`
  - `tests/cli/emit-diagnostics.test.ts`

### Phase 2 — OpenCode adapter implementation (`src/sources/opencode/opencode-source-adapter.ts`)

- Implement `SourceAdapter` with `id = 'opencode'`.
- Adapter behavior:
  - `discoverFiles()` returns a single DB path if present; empty list if not found at default location.
  - if `--opencode-db` is explicitly set and missing/unreadable, fail fast with actionable error including the provided path.
  - `parseFile(dbPath)` reads SQLite in read-only mode (Node stdlib `node:sqlite`) and emits normalized `UsageEvent[]`.
- Extraction contract (default schema path):
  - SQL input set ordered deterministically:
    - `message` rows where `json_extract(data, '$.role') = 'assistant'`
    - sorted by `time_created ASC, id ASC`
  - Event timestamp resolution:
    1. `message.time_created` (epoch ms; if seconds detected, normalize to ms before ISO conversion)
    2. JSON payload timestamp field if valid and needed as fallback
    3. if no valid timestamp, skip row
  - Provider/model mapping:
    - provider: `providerID` fallback `provider`
    - model: `modelID` fallback `model`
  - Token mapping:
    - input: `tokens.input`
    - output: `tokens.output`
    - reasoning: `tokens.reasoning`
    - cache read: `tokens.cache.read`
    - cache write: `tokens.cache.write`
    - total: `tokens.total` (fallback computed by `createUsageEvent`)
  - Cost mapping:
    - explicit cost from `cost` when numeric and non-negative
    - otherwise leave undefined and allow pricing stage estimation
- Extraction requirements:
  - Probe schema before extraction (`sqlite_master` / `PRAGMA table_info`) to confirm compatible tables/columns.
  - Support a documented fallback query shape when primary extraction path is unavailable but equivalent fields exist.
  - Parse `message.data` JSON defensively.
  - Map provider/model/token/cost fields to `createUsageEvent` input.
  - Preserve explicit cost when present; leave estimation to pricing stage when absent.
  - Skip malformed rows (non-fatal) with deterministic behavior.
- Determinism requirements:
  - Stable SQL ordering (timestamp + row id tie-breaker).
  - Stable output independent of DB engine traversal order.

Verification:

- adapter tests for normal + malformed + sparse rows
- schema variation tests (missing JSON keys / alternate shapes)
- locked/busy DB behavior tests (bounded retry + deterministic failure message)
- `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

### Failure and Drift Handling Policy

- Missing OpenCode DB at resolved default path:
  - treat as "source unavailable" (no events), not a hard failure.
- Explicit `--opencode-db` path missing/unreadable:
  - fail fast with actionable error including the provided path.
- DB open/query permission errors:
  - fail with actionable error (include sqlite error code/message when available).
- DB busy/locked errors:
  - retry with bounded policy, then fail with clear next-step guidance if retries are exhausted.
- Source-level failure propagation:
  - if failing source was explicitly selected (`--source opencode`) or explicitly overridden (`--opencode-db`), fail the command.
  - for non-explicit default-source failures, record failure in diagnostics and continue with remaining sources.
  - build-layer parsing flow must settle per source (e.g., `Promise.allSettled`-equivalent behavior), not fail-all on first adapter rejection.
- Schema drift (required tables/columns unavailable):
  - attempt primary + documented fallback extraction paths first.
  - if no compatible path exists, fail with explicit guidance to inspect schema using `opencode db` commands.
- Per-row malformed JSON or incomplete usage payload:
  - skip row, continue parsing, keep deterministic totals.
  - increment per-source skipped-row diagnostics counters.

### Phase 3 — Registration and pipeline integration

- Register OpenCode adapter in `src/sources/create-default-adapters.ts` (`sourceRegistrations` + factory wiring).
- Include `opencode` in default source IDs used by CLI source help/validation (`getDefaultSourceIds`-driven help text and validation).
- Ensure `--source opencode` works with existing filtering/date/pricing flow.
- Ensure `--opencode-db` override is respected end-to-end.
- Preserve `--source-dir` semantics for directory-only sources; keep `--source-dir opencode=...` invalid by design.
- Ensure source ordering reflects adapter registration order and remains stable.
- Extend terminal style policy map to include OpenCode source styling (while preserving unknown-source fallback behavior).
- Extend diagnostics emission to show source failures/skipped-row counters in terminal mode.

Verification:

- CLI tests: source filtering, mixed-source rows, ordering invariants, source allowlist/help text updates
- adapter factory tests: registration order + `--source-dir` rejection for OpenCode id
- render tests: style policy + no-color invariants
- diagnostics tests: source-failure and skipped-row emission behavior
- `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

### Phase 4 — End-to-end coverage and docs

- Add OpenCode fixtures (SQLite-backed fixture strategy, deterministic and portable).
  - prefer deterministic fixture generation/setup over opaque mutable DB binaries.
- Add mixed-source e2e scenarios (`pi + codex + opencode`).
- Add e2e scenarios for explicit override, unavailable-default behavior, and schema-drift/row-skip visibility.
- Update user docs (`README.md`, `docs/cli-reference.md`, `docs/architecture.md`, `docs/parsing-and-normalization.md`, `docs/development.md`, `docs/README.md`):
  - OpenCode usage examples
  - `--opencode-db` path override usage and precedence
  - explicit rule: `--source-dir` is directory-only (`pi`,`codex`) and cannot configure OpenCode DB path
  - source filter examples including `--source opencode`
  - troubleshooting for schema changes
  - migration/backfill guidance for historical OpenCode DB/report reruns
  - security notes for DB path handling (read-only intent, explicit path validation expectations)
- Validate command snippets and examples against actual CLI behavior.

Verification:

- e2e suite includes OpenCode-only, mixed-source, and failure-policy cases
- docs commands validated locally
- `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`

---

## Quality Rules

- Every functional change includes tests (unit + integration where applicable).
- No source-specific logic should leak into aggregate core behavior.
- Adapter failures for single rows must be non-fatal unless DB access itself is impossible.
- Error messages must be explicit and user-actionable.
- Maintain deterministic output ordering across rows/models/diagnostics.
- Keep runtime assumptions aligned to Node 24 only (no multi-version compatibility scaffolding).
- Keep OpenCode path semantics explicit (`--opencode-db` only for DB override).
- Keep `--source-dir` constrained to directory-backed sources (`pi`, `codex`) even after `opencode` registration.
- Source-level parse failures and skipped-row counts must be visible in diagnostics.
- Runtime parsing must not depend on OpenCode CLI; CLI commands remain troubleshooting-only.
- Default OpenCode DB resolution must be deterministic, documented per OS, and covered by unit tests.

---

## Definition of Done

- OpenCode is selectable via `--source opencode` and included in default source help/validation.
- OpenCode DB path override behavior is explicit, tested, and documented.
- `--source-dir opencode=...` is explicitly rejected with guidance to use `--opencode-db`.
- `--source-dir` allowlist implementation is decoupled from adapter registration and remains directory-only as providers are added.
- OpenCode extraction contract is covered by tests (timestamp/provider/model/tokens/cost mapping).
- OpenCode events are normalized correctly, including explicit-cost preservation.
- Mixed-source reports (pi/codex/opencode) produce stable totals and ordering.
- Failure policy is implemented and tested (explicit-source failure, optional-source fallback, locked DB retry exhaustion path).
- Build-layer source parsing uses per-source settlement (no fail-all on first source rejection unless failure policy requires it).
- Diagnostics surface source-level failures and skipped-row counts deterministically.
- User-facing docs and architecture diagrams reflect actual implementation.
- Runtime design remains cleanly Node 24–targeted (no compatibility detours for older baselines).
- Full quality gate passes:
  - `bun run lint && bun run typecheck && bun run format:check && bun run test && bun run build`
