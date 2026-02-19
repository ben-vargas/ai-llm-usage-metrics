# Changelog

## [0.1.8](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.7...v0.1.8) (2026-02-19)

### Features

- **cli:** surface source parse diagnostics and explicit failures ([d60fff7](https://github.com/ayagmar/llm-usage-metrics/commit/d60fff7a17af4a52e7f6e802fa6df6983389fd57))
- **opencode:** add e2e coverage and skipped-row diagnostics ([1abae0b](https://github.com/ayagmar/llm-usage-metrics/commit/1abae0b7a974ac71a01c70dcb72e3301f83af45e))
- **opencode:** add pathExists check and corresponding error handling in OpenCodeSourceAdapter ([751471e](https://github.com/ayagmar/llm-usage-metrics/commit/751471e9246ad1ef3c65273918a0acd7bfea3ac3))
- **opencode:** add sqlite adapter with deterministic path resolution ([9c4f5f6](https://github.com/ayagmar/llm-usage-metrics/commit/9c4f5f6a2690f5654b4d9eabe8db736e0f9122b7))
- **opencode:** integrate provider into default reporting pipeline ([7fbddfe](https://github.com/ayagmar/llm-usage-metrics/commit/7fbddfe0658f6a035a3e06c3a9280212c347746a))
- **sources:** reserve opencode db override and enforce validation ([7b36998](https://github.com/ayagmar/llm-usage-metrics/commit/7b369984ca4a150ce0ad03797cd1d37a247f72b4))
- **update:** add session-scoped cache and shorten update ttl ([2c40c94](https://github.com/ayagmar/llm-usage-metrics/commit/2c40c94f64eb08338e55717263b5dcdf64af711f))

### Bug Fixes

- **cli:** tighten model matching and pricing load conditions ([8f13cee](https://github.com/ayagmar/llm-usage-metrics/commit/8f13cee31e429cab443a9d2a444a0cd3992a12a3))
- **opencode:** harden dist sqlite runtime path ([379f8dc](https://github.com/ayagmar/llm-usage-metrics/commit/379f8dc4f9ed86a3ab0e5ba7874efef09b202da5))
- **opencode:** ignore zero-usage rows and harden skip stats ([9e0c6c7](https://github.com/ayagmar/llm-usage-metrics/commit/9e0c6c70de2a482d6e1a1cfb8242aa87a13d6451))
- **release:** correct hook name for git release process ([d3f0338](https://github.com/ayagmar/llm-usage-metrics/commit/d3f0338ea0360caf4623cb977c7064f0c3c785ca))
- **release:** run changelog prettier before git staging ([1161ec4](https://github.com/ayagmar/llm-usage-metrics/commit/1161ec4a6b77ff72e3e8d1b6fb2aa93ca0b2e9bf))

## [0.1.7](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.6...v0.1.7) (2026-02-19)

### Features

- **report:** add per-model token and cost breakdown ([d292400](https://github.com/ayagmar/llm-usage-metrics/commit/d29240040b3be7d54227738746d648e3c320d6ca))
- **timestamps:** add normalization for timestamp candidates and improve fallback logic in parsing ([4a3d967](https://github.com/ayagmar/llm-usage-metrics/commit/4a3d9671d1fc143f0cbf7b2eab4c773e1931f928))
- **timestamps:** add support for unix-second timestamps and improve handling of millisecond timestamps ([45081b6](https://github.com/ayagmar/llm-usage-metrics/commit/45081b62d07de79b4c8b8323d2f5e63c490ec33a))

### Bug Fixes

- **sources:** harden source-dir and parse concurrency guards ([2ffd385](https://github.com/ayagmar/llm-usage-metrics/commit/2ffd385fbd5ea0195a8d3c3ebea5db4f9734bdd6))

## [0.1.6](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.5...v0.1.6) (2026-02-18)

### Features

- **cli:** integrate session logging, env var display, and report header into usage report ([4d82523](https://github.com/ayagmar/llm-usage-metrics/commit/4d8252387afec5ec344c5846683f9327c4ff9a87))
- **pricing:** return cache status from load() to indicate data source ([c843b09](https://github.com/ayagmar/llm-usage-metrics/commit/c843b09c507f479b30b53a76cda8ac3541556d53))
- **ui:** add enhanced terminal output with logger, report header, and bullet-point models ([86bc0e2](https://github.com/ayagmar/llm-usage-metrics/commit/86bc0e28292c3cc4c2a6f5cc16c3e7bac96f4b61))

### Bug Fixes

- **markdown:** render multiline model cells safely ([06e8c72](https://github.com/ayagmar/llm-usage-metrics/commit/06e8c72afddfaf189213f7dac8469157bfa2560a))
- **render:** keep terminal separators stable with color ([663485f](https://github.com/ayagmar/llm-usage-metrics/commit/663485fed927fea7061809c6f406fa5fbb25496f))
- **report:** address review feedback and edge cases ([2cf39fa](https://github.com/ayagmar/llm-usage-metrics/commit/2cf39fa224f5185e6a64bc71460c6656785ad71f))

## [0.1.5](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.4...v0.1.5) (2026-02-18)

### Features

- **cli:** add root --version option ([dba3005](https://github.com/ayagmar/llm-usage-metrics/commit/dba300541acca8d4ed38031a392ec3f305d8f1bf))
- **config:** add env runtime overrides for ops knobs ([b406d0d](https://github.com/ayagmar/llm-usage-metrics/commit/b406d0de6dece6c535e1aa2ca5b3142d353ac2fe))

### Bug Fixes

- **cli:** clarify root help for subcommand options ([771c349](https://github.com/ayagmar/llm-usage-metrics/commit/771c34973a061f0155032b54575979f19dd55eed))
- **release:** format changelog before git release step ([294736c](https://github.com/ayagmar/llm-usage-metrics/commit/294736c4868aa777c5d8539d3d58f7e1c766d5c8))
- **runtime:** tighten update, cache, and env edge handling ([020700a](https://github.com/ayagmar/llm-usage-metrics/commit/020700a3be2c69f1fd97fc09a1e8417ac701a7e0))

## [0.1.4](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.3...v0.1.4) (2026-02-18)

### Features

- **update:** add cached npm update notifier flow ([f9f93bf](https://github.com/ayagmar/llm-usage-metrics/commit/f9f93bffb4f02404ce42dfcf838adf7bc4bbc77e))

### Bug Fixes

- **update:** harden cache validation and skip logic ([6f752cd](https://github.com/ayagmar/llm-usage-metrics/commit/6f752cd7bc2e65e58548bce1a94ba8825f16bbf5))
- **update:** reuse stale cache when refresh fails ([525da2a](https://github.com/ayagmar/llm-usage-metrics/commit/525da2a4c18e591e7b460ac3775174649eacc369))

## [0.1.3](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.2...v0.1.3) (2026-02-18)

### Features

- **cli:** improve help text and source option hints ([0d2461d](https://github.com/ayagmar/llm-usage-metrics/commit/0d2461d17f33b51d507f55d1be94f100717cfdac))

### Bug Fixes

- **aggregate:** stabilize usd totals for many events ([e8296fa](https://github.com/ayagmar/llm-usage-metrics/commit/e8296fa14fddfebe4486a268c3be22f1d25417d1))
- **cli:** validate sources and skip needless pricing fetch ([1572b17](https://github.com/ayagmar/llm-usage-metrics/commit/1572b17dacf274ac904595740b6ee5bd1f31182f))
- **sources:** guard invalid numeric pi timestamps ([7d76ef5](https://github.com/ayagmar/llm-usage-metrics/commit/7d76ef5d8da1c4c685c05e36f47403296a607d92))

### Performance Improvements

- **pricing:** reduce allocations in prefix alias matching ([7d51487](https://github.com/ayagmar/llm-usage-metrics/commit/7d51487c7ea8eb3035430f66f79782a87116952b))

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
