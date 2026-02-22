# Architecture

## High-level design

`llm-usage-metrics` is built as a deterministic reporting pipeline with explicit boundaries:

1. **CLI orchestration** parses user intent.
2. **Source adapters** discover and parse source-native data.
3. **Domain normalization** enforces canonical event contracts.
4. **Pricing** resolves explicit/estimated cost values.
5. **Aggregation** buckets events by period and source.
6. **Rendering** formats rows for terminal/markdown/json.
7. **Diagnostics emission** reports operational context on `stderr`.

This keeps source-specific complexity isolated and report output deterministic.

## Runtime flow (flowchart)

```mermaid
flowchart LR
    A[CLI entrypoint\nsrc/cli/index.ts] --> B[Update notifier\nsrc/update]
    B --> C[Command parser\nsrc/cli/create-cli.ts]
    C --> D[runUsageReport]
    D --> E[buildUsageData]

    E --> F[Source adapters\npi/codex/opencode]
    F --> G[UsageEvent[]]
    G --> H[Pricing resolver\nLiteLLM cache/network]
    H --> I[Aggregator\nperiod/source totals]
    I --> J[UsageDataResult]

    J --> K[renderUsageReport]
    K --> L[stdout report body]

    D --> M[emitDiagnostics]
    M --> N[stderr diagnostics]
```

## End-to-end sequence

```mermaid
sequenceDiagram
    participant User
    participant Entry as CLI entrypoint
    participant Update as Update notifier
    participant Run as runUsageReport
    participant Build as buildUsageData
    participant Adapter as Source adapters
    participant Pricing as Pricing resolver
    participant Agg as Aggregator
    participant Render as renderUsageReport
    participant Emit as emitDiagnostics

    User->>Entry: llm-usage monthly --source pi,codex
    Entry->>Update: checkForUpdatesAndMaybeRestart()
    Update-->>Entry: continueExecution=true
    Entry->>Run: execute command
    Run->>Build: buildUsageData(granularity, options)
    Build->>Adapter: discoverFiles() + parseFile()
    Adapter-->>Build: UsageEvent[]
    Build->>Pricing: resolvePricingSource(...)
    Pricing-->>Build: pricing source + origin
    Build->>Agg: aggregateUsage(events)
    Agg-->>Build: UsageReportRow[]
    Build-->>Run: UsageDataResult
    Run->>Render: renderUsageReport(data, format)
    Render-->>Run: report string
    Run->>Emit: emitDiagnostics(data.diagnostics)
    Run-->>User: stderr diagnostics + stdout report
```

## Module map

- `src/cli`: command creation, validation, orchestration, diagnostics contracts
- `src/sources`: adapter contract + source-specific parsers
- `src/domain`: normalized contracts and constructors
- `src/pricing`: LiteLLM loader/cache + cost engine
- `src/aggregate`: daily/weekly/monthly bucketing and totals
- `src/render`: terminal/markdown/json formatting
- `src/update`: startup update check

## Core invariants

- deterministic ordering (period/source/model)
- source parsing isolated behind adapter contract
- diagnostics on `stderr`, report data on `stdout`
- OpenCode runtime parsing is read-only (`node:sqlite`)
- unresolved cost values are surfaced explicitly (`-` / `~$...` semantics)
