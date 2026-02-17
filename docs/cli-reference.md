# CLI Reference

## Command structure

```bash
llm-usage <command> [options]
```

Commands:

- `daily`
- `weekly`
- `monthly`

## Shared options

- `--pi-dir <path>`: override `.pi` sessions directory
- `--codex-dir <path>`: override `.codex` sessions directory
- `--source <name>`: source filter (repeatable or comma-separated)
- `--since <YYYY-MM-DD>`: inclusive start date (local to selected timezone)
- `--until <YYYY-MM-DD>`: inclusive end date (local to selected timezone)
- `--timezone <iana>`: IANA timezone for bucket boundaries
- `--provider <name>`: provider filter (substring match, case-insensitive)
- `--pricing-url <url>`: use custom LiteLLM pricing JSON source
- `--pricing-offline`: use cache only (no network)
- `--markdown`: render markdown table
- `--json`: render JSON rows

## Defaults

- timezone defaults to local system timezone
- provider filter defaults to `openai`
- source filter defaults to all parsed sources
- output defaults to terminal table

## Examples

Daily report:

```bash
llm-usage daily
```

Weekly report in Paris time:

```bash
llm-usage weekly --timezone Europe/Paris
```

Monthly report for a range:

```bash
llm-usage monthly --since 2026-01-01 --until 2026-01-31
```

JSON output for automation:

```bash
llm-usage daily --json
```

Markdown output for docs:

```bash
llm-usage daily --markdown
```

Custom directories:

```bash
llm-usage daily --pi-dir /path/to/pi --codex-dir /path/to/codex
```

Offline pricing mode:

```bash
llm-usage monthly --pricing-offline
```

Only codex rows:

```bash
llm-usage monthly --source codex
```

Only pi rows:

```bash
llm-usage monthly --source pi
```

Multiple sources (repeat or comma-separated):

```bash
llm-usage monthly --source pi --source codex
llm-usage monthly --source pi,codex
```

## Validation rules

- `--since` and `--until` must be valid calendar dates in `YYYY-MM-DD`
- `--since` must be `<= --until`
- `--timezone` must be a valid IANA timezone
- `--source` values must be non-empty source ids
- `--pricing-url` must be `http` or `https`
- `--markdown` and `--json` are mutually exclusive
