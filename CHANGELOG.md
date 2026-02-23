# Changelog

## [0.3.2](https://github.com/ayagmar/llm-usage-metrics/compare/v0.3.1...v0.3.2) (2026-02-23)

### Features

* add DeepWiki badge and auto-deploy site on changes ([bf37e4a](https://github.com/ayagmar/llm-usage-metrics/commit/bf37e4abad18febd7d3831be9b07f1c9d0952497))
* **ci:** restructure workflow with parallel jobs and add site linting ([5ee8894](https://github.com/ayagmar/llm-usage-metrics/commit/5ee889453d4894d787d9f0eee5afef9e26b99e3e))
* **docs:** add Mermaid diagram validation script and integrate into CI workflow ([d665152](https://github.com/ayagmar/llm-usage-metrics/commit/d665152ef9b9f3441274d08397a0d014f03c661e))
* **docs:** update homepage URL and enhance footer with links and branding ([7cb6509](https://github.com/ayagmar/llm-usage-metrics/commit/7cb6509a66f338e9dd4d69a1639e78741b48dcf6))
* enhance styling for docs page ([05ddb6e](https://github.com/ayagmar/llm-usage-metrics/commit/05ddb6ec64c4d0eba0d3d12784b2bf7e62bb3b1d))

### Bug Fixes

* **ci:** add main-mermaid to status check and fix coverage upload permissions ([0a81f73](https://github.com/ayagmar/llm-usage-metrics/commit/0a81f7312b227f7344dd551330dbc42ef5b5ddb9))

## [0.3.1](https://github.com/ayagmar/llm-usage-metrics/compare/v0.3.0...v0.3.1) (2026-02-23)

### Bug Fixes

* **docs:** update CLI version in reference to 0.3.0 ([8d5b88a](https://github.com/ayagmar/llm-usage-metrics/commit/8d5b88a80da9b2f398eb79b5a70d40b50936abb8))

## [](https://github.com/ayagmar/llm-usage-metrics/compare/v0.2.1...vnull) (2026-02-23)

### Features

* **site:** refine landing page layout and interactions ([f0b3447](https://github.com/ayagmar/llm-usage-metrics/commit/f0b344792e567385aa9775160791411f88853b0a))
* **site:** T1 foundation scaffold - Astro + Starlight setup ([4ed5503](https://github.com/ayagmar/llm-usage-metrics/commit/4ed5503fb184b7205b37852cf5750706f997c2a2))
* **site:** T2 design system - tokens, typography, responsive foundations ([9983b9e](https://github.com/ayagmar/llm-usage-metrics/commit/9983b9ec0e07b1ca4bfcb142898ec2768d1285a2))
* **site:** T3 landing page - hero, bento, tabs, lightbox, isolated interactivity ([ebbba4b](https://github.com/ayagmar/llm-usage-metrics/commit/ebbba4ba2acef5f01daeaa5b5d77a1feb60e2c1f))
* **site:** T4 docs IA - comprehensive content for all sections, architecture nav ([75cb63a](https://github.com/ayagmar/llm-usage-metrics/commit/75cb63a7a5e902319107450d2f7a6df65afff080))
* **site:** T6 docs automation - CLI reference generator script ([b6ef01a](https://github.com/ayagmar/llm-usage-metrics/commit/b6ef01afafe4d93bb68d5c443ccbc02fdfafce7d))

### Bug Fixes

* **ci:** force fresh CLI build for docs generation ([23893e5](https://github.com/ayagmar/llm-usage-metrics/commit/23893e5798fc61bd523aca4186d1f0de8e1e1841))
* **docs:** include all command options in CLI reference ([bdf3629](https://github.com/ayagmar/llm-usage-metrics/commit/bdf3629f39005475b51dcbc248eaff7fab2256cc))
* **site:** align docs config and canonical links ([e8466e6](https://github.com/ayagmar/llm-usage-metrics/commit/e8466e6fa9a5b9c48009cb4865e04a5113c9ecb8))

## [](https://github.com/ayagmar/llm-usage-metrics/compare/v0.2.0...vnull) (2026-02-22)

### Bug Fixes

* **cli:** restore local pnpm source execution ([6482500](https://github.com/ayagmar/llm-usage-metrics/commit/64825000dd11baa1efabea70c49f3312d591a7f1))
* **lint:** enforce safe assertions in runtime code ([12900ff](https://github.com/ayagmar/llm-usage-metrics/commit/12900ff6d30a0f6d247b12102e5ab21830db0a90))
* **parsing:** close cache bugs and raise test coverage ([9f644f9](https://github.com/ayagmar/llm-usage-metrics/commit/9f644f9422f7dece9bf120b2045673a32e93ccbe))
* **parsing:** harden and simplify parse cache loading ([b4c621c](https://github.com/ayagmar/llm-usage-metrics/commit/b4c621cdc30b98c354900fdf9c7bda405c744871))
* **parsing:** improve cache resilience and trim payload ([2275d18](https://github.com/ayagmar/llm-usage-metrics/commit/2275d18afb841c850819556967173300eb7cc594))
* **parsing:** keep precise mtimes and optimize cache trimming ([443f4b6](https://github.com/ayagmar/llm-usage-metrics/commit/443f4b66388d00dcd4fed25cf93ee35d6b12afa8))

### Performance Improvements

* **parsing:** add bounded parse cache and jsonl prefilters ([9a76986](https://github.com/ayagmar/llm-usage-metrics/commit/9a76986ce623eca3f21a2e56511e62133df586a7))

## [](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.11...vnull) (2026-02-22)

### Features

* add initial GitHub Pages deployment workflow and site structure ([e96f1c0](https://github.com/ayagmar/llm-usage-metrics/commit/e96f1c000d822e68e1ed6e05df52449dafa164a1))
* add pricing URL validation and normalization; enhance discoverJsonlFiles to skip unreadable directories ([6e32e7c](https://github.com/ayagmar/llm-usage-metrics/commit/6e32e7cf6486172ed2c4786d34e91cdb6f8dd417))
* **diagnostics:** include structured skipped-row reasons ([aa5c983](https://github.com/ayagmar/llm-usage-metrics/commit/aa5c983b3a31b18ca1ac0b214190781ff4a3ab34))
* enhance clipboard copy functionality and improve accessibility ([c5e2783](https://github.com/ayagmar/llm-usage-metrics/commit/c5e2783442d572bffcd2b7c51b4ad69bb97cdd8c))
* enhance cost handling and formatting; add support for streaming query results ([6308e2f](https://github.com/ayagmar/llm-usage-metrics/commit/6308e2fbfb1d41d572f472c466551b78d8d86619))
* enhance navigation links with improved accessibility and styling ([4f333a4](https://github.com/ayagmar/llm-usage-metrics/commit/4f333a43b31376ae2be8c8ef69e3a1bc46f48e79))
* replace terminal visual with screenshot and implement lightbox functionality ([ddae57e](https://github.com/ayagmar/llm-usage-metrics/commit/ddae57e71f78030ffc241baeb3005112db6c7bba))

### Bug Fixes

* **aggregate:** preserve unknown cost semantics and true code-point sort ([286ab95](https://github.com/ayagmar/llm-usage-metrics/commit/286ab95a209052f182fdc4216a03aa11c92c99c6))
* **ci:** setup pnpm before node cache initialization ([ebe0de8](https://github.com/ayagmar/llm-usage-metrics/commit/ebe0de89f427873f039afb88dc40f57e6ea2bdd6))
* **cli:** avoid false terminal overflow hints ([b29c06d](https://github.com/ayagmar/llm-usage-metrics/commit/b29c06dcb4e2cf0b59623947da7210a4ca062fec))
* **eslint:** update file ignores and enhance TypeScript file handling ([648de7e](https://github.com/ayagmar/llm-usage-metrics/commit/648de7ec8b5a1fcc4c08845e16e0d8908f421496))
* **opencode:** close patch coverage gaps ([348a6a5](https://github.com/ayagmar/llm-usage-metrics/commit/348a6a5b48ccd110dc1ac3b7852adc8df46e5c15))
* **output:** improve terminal fit and suppress sqlite warning ([8c7f6bb](https://github.com/ayagmar/llm-usage-metrics/commit/8c7f6bb5c5f521f3e15d7bc0411375d4eec07469))
* **pricing:** retry transient LiteLLM fetch failures ([8d9f16c](https://github.com/ayagmar/llm-usage-metrics/commit/8d9f16c879af45d9ef507301f589bd7b7d301ea8))
* **render:** enforce explicit terminal width constraints ([d83d1e1](https://github.com/ayagmar/llm-usage-metrics/commit/d83d1e16800e463414b04468fb50419823f7076b))
* **render:** normalize row groups before separator rendering ([5d4453e](https://github.com/ayagmar/llm-usage-metrics/commit/5d4453ee2b9dc62b7eedd2d9365e6ef8b08be355))
* **render:** unify column count handling in renderUnicodeTable ([4bdb237](https://github.com/ayagmar/llm-usage-metrics/commit/4bdb23739f0eb816c5d0d140f3f99de2b24d32a9))
* **render:** unify tty width checks and harden sqlite guards ([3b8c38a](https://github.com/ayagmar/llm-usage-metrics/commit/3b8c38a6e5a11946e2c1ced0e16b44617ddec739))
* **report:** preserve unknown costs and harden opencode parsing ([2a1c679](https://github.com/ayagmar/llm-usage-metrics/commit/2a1c6795ab62878ea9f5086248c9da83b4ca7fbb))
* **review:** address PR [#19](https://github.com/ayagmar/llm-usage-metrics/issues/19) inline feedback ([2469d54](https://github.com/ayagmar/llm-usage-metrics/commit/2469d54070740c1fbb5e283b8e1aecbe96ff7ac1))
* **review:** address remaining PR [#19](https://github.com/ayagmar/llm-usage-metrics/issues/19) feedback ([18f622c](https://github.com/ayagmar/llm-usage-metrics/commit/18f622c00157cd4e0dfbf0bb032aabce3f9dfa2a))
* **update:** retry transient checks without refreshing stale cache ([cb0b21a](https://github.com/ayagmar/llm-usage-metrics/commit/cb0b21a843eb6d5ec9618ecf0f00da5deedc6c5d))
* **update:** skip checks for local source execution ([2f8d30c](https://github.com/ayagmar/llm-usage-metrics/commit/2f8d30ce8f5b857facdeba349751190a55486d47))

## [0.1.11](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.10...v0.1.11) (2026-02-20)

### Bug Fixes

* **pricing:** add temporary alias for gpt-5.3-codex to fallback on gpt-5.2-codex pricing ([d0982b4](https://github.com/ayagmar/llm-usage-metrics/commit/d0982b4e14ed6def16083e0433352cb63949d00a))

## [0.1.10](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.9...v0.1.10) (2026-02-20)

### Features

* **render:** add normalization for line breaks and enhance emoji grapheme handling ([1d6d3aa](https://github.com/ayagmar/llm-usage-metrics/commit/1d6d3aa7fe8e242746bd229433aa1f70d0415e80))
* **render:** enhance emoji grapheme handling in width calculations ([6c42114](https://github.com/ayagmar/llm-usage-metrics/commit/6c42114119b5ca2c00fdc427e57d5bed10d68961))

### Bug Fixes

* **render:** enhance zero-width code point handling in width calculations ([b73af96](https://github.com/ayagmar/llm-usage-metrics/commit/b73af96dbaba329afa521bd5ad33059d364e8751))
* **render:** handle grapheme-aware table width and wrapping ([abc8d68](https://github.com/ayagmar/llm-usage-metrics/commit/abc8d68915ff6e5d4bc311c4b39112aafc69b3a3))

## [0.1.9](https://github.com/ayagmar/llm-usage-metrics/compare/v0.1.8...v0.1.9) (2026-02-19)

### Features

* **cli:** show supported sources in help output ([8fd338e](https://github.com/ayagmar/llm-usage-metrics/commit/8fd338eca31a4bdb314c73cb32beb2a772a195fb))

### Bug Fixes

* **cli:** align filters and diagnostics behavior ([a52aa61](https://github.com/ayagmar/llm-usage-metrics/commit/a52aa61d9e662ba57522dab821f243a3c5c9265b))
* **cli:** align model-filter semantics and docs ([3d73880](https://github.com/ayagmar/llm-usage-metrics/commit/3d7388019e69497770806a497427fdc8a779f4de))
* **opencode:** continue default db fallback discovery ([e697fcb](https://github.com/ayagmar/llm-usage-metrics/commit/e697fcb807ea6c8df61c4ca519e2b1f028a38743))
* **pricing:** skip needless loads and resolve alias chains ([4e0020f](https://github.com/ayagmar/llm-usage-metrics/commit/4e0020f65b135af20da651b1840bdaa0c7b1f554))
* **release:** restore changelog plugin and drop changelog formatting hooks ([3b72dd5](https://github.com/ayagmar/llm-usage-metrics/commit/3b72dd5849cc0d5830441bba1b0f3f56654ed48d))
* **render:** normalize markdown cells with CRLF lines ([f5f9bd4](https://github.com/ayagmar/llm-usage-metrics/commit/f5f9bd4fe0d156c4ba514d552a9df5d5885f689c))
* **render:** use row type for summary styling ([3f74120](https://github.com/ayagmar/llm-usage-metrics/commit/3f74120da1aa248bcd25f63246bde1b2028dd4b9))
* **update:** detect help and version in wrapped argv ([4dfa511](https://github.com/ayagmar/llm-usage-metrics/commit/4dfa511beb02fda4078af3783f6cd2f568fedaed))

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
