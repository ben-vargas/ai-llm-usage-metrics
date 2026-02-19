# Pricing and Cost Calculation

## Cost modes

Each event has one of two modes:

- `explicit`: cost came from source logs
- `estimated`: cost is missing or computed from model pricing

Explicit cost is preserved, except when explicit cost is exactly `0` and model pricing is available (then it is re-estimated from LiteLLM pricing).

## Pricing source resolution

```mermaid
flowchart TD
    A[Need pricing data] --> B{Fresh cache available?}
    B -- yes --> C[Use cached LiteLLM pricing]
    B -- no --> D{Offline mode?}
    D -- yes --> E{Any cache available?}
    E -- yes --> C
    E -- no --> F[Fail: no cached pricing]
    D -- no --> G[Fetch remote pricing]
    G --> H{Fetch succeeded?}
    H -- yes --> I[Normalize pricing + keep in memory]
    I --> J[Best-effort cache write]
    J --> K[Use fetched pricing]
    H -- no --> L{Custom --pricing-url set?}
    L -- yes --> M[Fail: custom pricing source required]
    L -- no --> N[Fail: LiteLLM pricing unavailable]
```

### 1) LiteLLM pricing fetcher

Source file: `src/pricing/litellm-pricing-fetcher.ts`

Behavior:

- fetches LiteLLM model pricing JSON
- normalizes per-token values into per-1M token values
- caches data locally
- supports offline mode

Cache behavior:

- tries fresh cache first
- in offline mode, stale cache is allowed
- if network fetch succeeds but cache write fails, pricing is still used in memory

### 2) Static pricing source helper

Source file: `src/pricing/static-pricing-source.ts`

This helper is retained for tests/tooling support. Runtime report pricing resolution uses LiteLLM pricing fetch/cache flows.

## Model resolution

LiteLLM model lookup tries, in order:

1. direct exact match
2. provider-prefix stripping (`openai/model` -> `model`)
3. longest prefix match for versioned model ids
4. fuzzy match (bounded Levenshtein distance)

Resolved aliases are cached in memory per process run.

## Cost engine

Source file: `src/pricing/cost-engine.ts`

Estimated cost formula (all per 1M token rates):

```text
input + output + cacheRead + cacheWrite + optional reasoning
```

Reasoning tokens are billed only when pricing says `reasoningBilling = separate`.

If model pricing is not found, event stays in estimated mode with `costUsd` left undefined.
