# Changelog

## [0.1.3](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.2...v0.1.3) (2026-02-18)

### Features

* **cli:** improve help text and source option hints ([0d2461d](https://github.com/ayagmar/llm-usage-metrics/commit/0d2461d17f33b51d507f55d1be94f100717cfdac))

### Bug Fixes

* **aggregate:** stabilize usd totals for many events ([e8296fa](https://github.com/ayagmar/llm-usage-metrics/commit/e8296fa14fddfebe4486a268c3be22f1d25417d1))
* **cli:** validate sources and skip needless pricing fetch ([1572b17](https://github.com/ayagmar/llm-usage-metrics/commit/1572b17dacf274ac904595740b6ee5bd1f31182f))
* **sources:** guard invalid numeric pi timestamps ([7d76ef5](https://github.com/ayagmar/llm-usage-metrics/commit/7d76ef5d8da1c4c685c05e36f47403296a607d92))

### Performance Improvements

* **pricing:** reduce allocations in prefix alias matching ([7d51487](https://github.com/ayagmar/llm-usage-metrics/commit/7d51487c7ea8eb3035430f66f79782a87116952b))

All notable changes to this project are documented in this file.

## [0.1.2](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.1...v0.1.2) (2026-02-17)

### Bug Fixes

- configure Git identity in the GitHub release workflow so `release-it` can create the release commit in CI.

### Chores

- sync repository version/tag state after the partial `0.1.1` publish.

## [0.1.1](https://github.com/ayagmar/llm-usage-metrics/compare/a0ac68f...v0.1.1) (2026-02-17)

### ⚠ Breaking Changes

- rename CLI executable from `usage` to `llm-usage`.

### Features

- add `--source` filtering (repeatable or comma-separated) to report commands.
- add release automation with `release-it` and a dedicated GitHub `release.yml` workflow.
- add coverage reporting in CI (single test execution path, summary generation, PR visibility support).

### Bug Fixes

- enforce default provider filtering consistently across `.pi` and `.codex` inputs.
- improve LiteLLM pricing cache behavior (best-effort cache writes after successful remote loads).
- fix USD normalization for blank/whitespace values.
- fix Codex token delta transitions (`last_token_usage`/totals handling).
- fix `.pi` usage fallback from malformed `line.usage` to `message.usage`.
- reject invalid source adapter ids that are empty/whitespace.

### Documentation

- add contributor guide (`CONTRIBUTING.md`) and expand architecture/CLI/development docs.
- document source filtering and updated command usage.

### Chores

- remove bootstrap token publish workflow after initial package bootstrap.
- add npm provenance metadata in `package.json` (`repository`, `bugs`, `homepage`).

## 0.1.0 (2026-02-17)

### Features

- initial public release of `llm-usage-metrics`.
- add CLI reporting commands for `daily`, `weekly`, and `monthly` usage aggregation.
- parse local `.pi` and `.codex` session JSONL logs through source adapters.
- implement normalization and aggregation pipelines producing per-source/per-period totals plus grand totals.
- add terminal table, markdown table, and JSON output formats.
- add pricing engine with model mapping, cost estimation, and explicit-vs-estimated cost handling.
- add LiteLLM pricing support with cache/offline behavior and custom pricing URL override.
- add test coverage across adapters, aggregation, rendering, pricing, and end-to-end report generation.

### Bug Fixes & Improvements

- improve report readability and totals behavior in terminal/markdown rendering.
- refine Codex token accounting and monthly reporting behavior.
- harden CI/release bootstrap workflow for first npm publish.
- improve documentation structure and usage guidance for first-time users.
