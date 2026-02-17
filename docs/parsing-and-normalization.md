# Parsing and Normalization

## File discovery

Both adapters use recursive discovery for `*.jsonl` files and return paths in deterministic sorted order.

## `.pi` parsing

Source file: `src/sources/pi/pi-source-adapter.ts`

### Recognized line types

- `session`: captures session id and fallback timestamp
- `model_change`: updates provider/model state
- `message`: potential usage record

### Usage extraction

Usage is read from:

1. `line.usage` when valid
2. `line.message.usage` as fallback

Recognized fields:

- input: `input`
- output: `output`
- reasoning: `reasoning`, `reasoningTokens`, `reasoningOutput`, `outputReasoning`
- cache read: `cacheRead`
- cache write: `cacheWrite`
- total tokens: `totalTokens`
- cost: `usage.cost.total`

### Provider filtering

The adapter receives a provider filter function and applies it before creating events.

## `.codex` parsing

Source file: `src/sources/codex/codex-source-adapter.ts`

### Recognized line types

- `session_meta`: session id and model provider
- `turn_context`: current model
- `event_msg` with `payload.type = token_count`: usage info

### Delta logic

Codex data can provide either:

- `last_token_usage` (already a delta), or
- `total_token_usage` (cumulative)

Rules:

- if `last_token_usage` is present, use it directly
- otherwise compute delta as `current_total - previous_total`
- negative deltas are clamped to zero

### Codex input semantics

Codex `input_tokens` includes cached input. The adapter stores:

- `inputTokens = input_tokens - cached_input_tokens`
- `cacheReadTokens = cached_input_tokens`

This avoids double counting input + cache read later.

### Legacy model fallback

When model metadata is missing, model is set to:
`legacy-codex-unknown`

## Shared normalization (`src/domain/normalization.ts`)

- non-numeric and missing token fields normalize to `0`
- token values are truncated to integers and clamped to non-negative
- blank/invalid cost values become `undefined`
- cost is clamped to non-negative
- timestamps are validated and converted to ISO
- model lists are trimmed, deduplicated, and sorted

## Event creation (`createUsageEvent`)

`createUsageEvent` enforces domain-level constraints:

- non-empty `source` and `sessionId`
- valid timestamp
- consistent `costMode`
  - explicit mode requires a cost
- total token fallback:
  - use declared `totalTokens` when positive
  - otherwise compute from components
