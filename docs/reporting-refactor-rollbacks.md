# Reporting pipeline refactor rollback notes

This document lists the reporting-pipeline refactor commits as independently revertible slices.

## Commit map

1. `2c74dc5` — `refactor(report): add usage-data contracts and scaffolding`
   - Introduces contracts (`UsageDiagnostics`, `UsageDataResult`, deps interface) and skeleton files.

2. `fe2c342` — `refactor(report): extract usage data builder and renderer`
   - Moves validation/parsing/pricing/aggregation into `buildUsageData(...)`.
   - Adds `renderUsageReport(...)` dispatcher.

3. `2372725` — `refactor(report): move diagnostics emission to run command`
   - Adds `emitDiagnostics(...)` and limits logger side effects to `runUsageReport()`.

4. `2df7706` — `refactor(render): extract terminal style policy maps`
   - Moves terminal row/source styling rules into `terminal-style-policy.ts`.

5. `72e10a1` — `refactor(cli): consolidate usage report orchestration`
   - Deduplicates orchestration logic via internal `prepareUsageReport(...)` helper.

6. `4f615b4` — `test(cli): cover pricing fallback and offline-cache failures`
   - Test-only hardening for fallback/offline pricing failure paths.

## Revert guidance

- Revert from newest to oldest when possible.
- If only style-policy logic is problematic, revert `2df7706` first.
- If diagnostics side effects must be restored to pre-refactor placement, revert `2372725`.
- If build/render decomposition must be undone, revert `fe2c342` (and optionally `2c74dc5`).
- `4f615b4` is test-only and safe to revert independently if test behavior needs temporary relaxation.

After any rollback, re-run:

```bash
bun run lint
bun run typecheck
bun run format:check
bun run test
bun run build
```
