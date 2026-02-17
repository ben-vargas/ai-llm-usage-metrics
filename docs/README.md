# Project Documentation

This folder contains the technical documentation for `llm-usage-metrics`.

## Start here

- [Architecture](./architecture.md)
- [CLI reference](./cli-reference.md)
- [Parsing and normalization](./parsing-and-normalization.md)
- [Pricing and cost calculation](./pricing-and-costs.md)
- [Development guide](./development.md)
- [Contributing](../CONTRIBUTING.md)

## Quick summary

`llm-usage-metrics` reads local `.jsonl` session logs from:

- `~/.pi/agent/sessions`
- `~/.codex/sessions`

It normalizes events, estimates cost when needed, aggregates by period (daily/weekly/monthly), and renders the result as terminal table, markdown, or JSON.
