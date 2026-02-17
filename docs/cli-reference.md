# CLI Reference

## Command structure

```bash
usage <command> [options]
```

Commands:

- `daily`
- `weekly`
- `monthly`

## Shared options

- `--pi-dir <path>`: override `.pi` sessions directory
- `--codex-dir <path>`: override `.codex` sessions directory
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
- output defaults to terminal table

## Examples

Daily report:

```bash
usage daily
```

Weekly report in Paris time:

```bash
usage weekly --timezone Europe/Paris
```

Monthly report for a range:

```bash
usage monthly --since 2026-01-01 --until 2026-01-31
```

JSON output for automation:

```bash
usage daily --json
```

Markdown output for docs:

```bash
usage daily --markdown
```

Custom directories:

```bash
usage daily --pi-dir /path/to/pi --codex-dir /path/to/codex
```

Offline pricing mode:

```bash
usage monthly --pricing-offline
```

## Validation rules

- `--since` and `--until` must be valid calendar dates in `YYYY-MM-DD`
- `--since` must be `<= --until`
- `--timezone` must be a valid IANA timezone
- `--pricing-url` must be `http` or `https`
- `--markdown` and `--json` are mutually exclusive
