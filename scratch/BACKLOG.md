# Backlog (Audit Scan)

- [ ] Evaluate self-hosting Geist/Geist Mono fonts for docs site (privacy + cache-control), then remove external Google Fonts import if approved.
- [ ] Add a CI check that validates all Mermaid blocks in `docs/*.md` render with a lint/parser step to prevent broken diagrams.
- [ ] Add a short maintainer note in PR template reminding contributors to run `pnpm run site:docs:generate` before pushing doc-related changes.
