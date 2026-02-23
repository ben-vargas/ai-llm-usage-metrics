<div align="center">

<img src="https://ayagmar.github.io/llm-usage-metrics/favicon.svg" width="64" height="64" alt="llm-usage-metrics logo">

# llm-usage-metrics

**Track and analyze your local LLM usage across coding agents**

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ayagmar/llm-usage-metrics)
[![npm version](https://img.shields.io/npm/v/llm-usage-metrics.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/llm-usage-metrics)
[![npm downloads](https://img.shields.io/npm/dt/llm-usage-metrics.svg?style=flat-square&color=10b981)](https://www.npmjs.com/package/llm-usage-metrics)
[![CI](https://img.shields.io/github/actions/workflow/status/ayagmar/llm-usage-metrics/ci.yml?style=flat-square&label=CI)](https://github.com/ayagmar/llm-usage-metrics/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/ayagmar/llm-usage-metrics?style=flat-square)](https://codecov.io/gh/ayagmar/llm-usage-metrics)

[📖 Documentation](https://ayagmar.github.io/llm-usage-metrics/) ·
[⚡ Quick Start](#quick-start) ·
[📊 Examples](#usage) ·
[🤝 Contributing](./CONTRIBUTING.md)

</div>

---

Aggregate token usage and costs from your local coding agent sessions. Supports **pi**, **codex**, and **OpenCode** with zero configuration required.

## ✨ Features

- **Zero-Config Discovery** — Automatically finds `.pi`, `.codex`, and OpenCode session data
- **LiteLLM Pricing** — Real-time pricing sync with offline caching support
- **Flexible Reports** — Daily, weekly, and monthly aggregations
- **Multiple Outputs** — Terminal tables, JSON, or Markdown
- **Smart Filtering** — By source, provider, model, and date ranges

## 🚀 Quick Start

```bash
# Install globally
npm install -g llm-usage-metrics

# Or run without installing
npx llm-usage-metrics daily

# Generate your first report
llm-usage daily
```

<div align="center">

![Terminal output showing token usage and cost breakdown](https://ayagmar.github.io/llm-usage-metrics/screenshot.png)

</div>

## 📋 Supported Sources

| Source       | Pattern                           | Discovery                        |
| ------------ | --------------------------------- | -------------------------------- |
| **pi**       | `~/.pi/agent/sessions/**/*.jsonl` | Automatic                        |
| **codex**    | `~/.codex/sessions/**/*.jsonl`    | Automatic                        |
| **OpenCode** | `~/.opencode/opencode.db`         | Auto or explicit `--opencode-db` |

## 🎯 Usage

### Basic Reports

```bash
# Daily report (default terminal table)
llm-usage daily

# Weekly with timezone
llm-usage weekly --timezone Europe/Paris

# Monthly date range
llm-usage monthly --since 2026-01-01 --until 2026-01-31
```

### Output Formats

```bash
# JSON for pipelines
llm-usage daily --json

# Markdown for documentation
llm-usage daily --markdown

# Detailed per-model breakdown
llm-usage monthly --per-model-columns
```

### Filtering

```bash
# By source
llm-usage monthly --source pi,codex

# By provider
llm-usage monthly --provider openai

# By model
llm-usage monthly --model claude

# Combined filters
llm-usage monthly --source opencode --provider openai --model gpt-4.1
```

### Custom Paths

```bash
# Custom directories
llm-usage daily --source-dir pi=/path/to/pi --source-dir codex=/path/to/codex

# Explicit OpenCode database
llm-usage daily --opencode-db /path/to/opencode.db
```

### Offline Mode

```bash
# Use cached pricing only
llm-usage monthly --pricing-offline
```

## ⚙️ Configuration

### Environment Variables

| Variable                         | Description                       |
| -------------------------------- | --------------------------------- |
| `LLM_USAGE_SKIP_UPDATE_CHECK`    | Skip update check (`1`)           |
| `LLM_USAGE_PRICING_CACHE_TTL_MS` | Pricing cache duration            |
| `LLM_USAGE_PARSE_MAX_PARALLEL`   | Max parallel file parses (`1-64`) |
| `LLM_USAGE_PARSE_CACHE_ENABLED`  | Enable parse cache (`1/0`)        |

See full environment variable reference in the [documentation](https://ayagmar.github.io/llm-usage-metrics/configuration/).

### Update Checks

The CLI performs lightweight update checks with smart defaults:

- 1-hour cache TTL
- Skipped for `--help`, `--version`, and `npx` runs
- Prompts only in interactive TTY sessions

Disable with:

```bash
LLM_USAGE_SKIP_UPDATE_CHECK=1 llm-usage daily
```

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Run quality checks
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run format:check

# Build
pnpm run build

# Run locally
pnpm cli daily
```

## 📚 Documentation

- **[Getting Started](https://ayagmar.github.io/llm-usage-metrics/getting-started/)** — Installation and first steps
- **[CLI Reference](https://ayagmar.github.io/llm-usage-metrics/cli-reference/)** — Complete command reference
- **[Data Sources](https://ayagmar.github.io/llm-usage-metrics/sources/)** — Source configuration
- **[Configuration](https://ayagmar.github.io/llm-usage-metrics/configuration/)** — Environment variables
- **[Architecture](https://ayagmar.github.io/llm-usage-metrics/architecture/)** — Technical overview

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

The codebase is structured to add more sources through the `SourceAdapter` pattern.

## 📄 License

MIT © [Abdeslam Yagmar](https://github.com/ayagmar)
