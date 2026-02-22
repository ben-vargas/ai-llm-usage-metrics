# Website Migration Plan: `site/` -> Astro + Starlight

## Objective

Migrate the current hand-written static `site/` landing page to a production-grade docs + marketing website built on **Astro + Starlight**, with:

- mobile-first responsive UX
- performance-first implementation (low client JS, fast first render)
- clean documentation information architecture for a growing CLI/API product
- sustainable docs maintenance (manual + automated, with clear source of truth)

This plan follows a **single decisive path**: Astro + Starlight. After cutover, legacy static site files are removed from active deployment.

---

## Scope

### In scope

- migrate `site/index.html`, `site/style.css`, `site/main.js` into Astro/Starlight architecture
- ship a high-quality landing page + full docs navigation
- define docs governance (what is authored manually vs generated)
- integrate site checks into CI
- migrate deployment from raw static upload to built artifacts

### Out of scope

- rewriting CLI/runtime logic
- changing report semantics or CLI options
- introducing multiple parallel docs stacks long-term

---

## Repository Baseline Constraints (verified)

- package manager/workflow: **pnpm** (`pnpm-lock.yaml`, CI already pinned)
- existing docs live at repository root: `docs/`
- existing Pages deployment uploads `site/` directory directly (no build step)
- current website is plain static files:
  - `site/index.html`
  - `site/style.css`
  - `site/main.js`

These constraints drive migration tasks for scripts, CI, and docs source-of-truth.

---

## Stack Decision (final)

Adopt **Astro + Starlight**.

Why:

- Astro supports custom, high-end landing pages with minimal hydration.
- Starlight provides production docs UX (sidebar, search, edit links, content collections).
- Strong long-term fit for a CLI product with expanding documentation surface.

Alternative (VitePress) was considered based on ccusage reference, but Astro + Starlight is preferred for stronger custom landing control without compromising docs UX.

---

## Architecture Principles

1. **Static by default**
   - `.astro` for layout/content sections.
   - Hydrate only leaf interactive components.
2. **No unnecessary UI framework runtime**
   - Do not add React for simple interactions unless a later requirement explicitly needs it.
   - Implement copy/tabs/lightbox via lightweight client scripts or isolated islands.
3. **Performance before decoration**
   - transform/opacity-only animation
   - reduced-motion support
   - no scroll-handler-heavy effects for primary UX
   - self-host fonts and avoid render-blocking third-party font CSS
4. **Data fetching strategy for landing metadata**
   - resolve npm version badge at build time (or ISR/edge build hook), not per-client runtime fetch
   - define fallback behavior when registry is temporarily unavailable
5. **Single docs truth**
   - avoid long-term duplicated manual content in both `docs/` and `site/src/content/docs/`.

---

## Documentation Source-of-Truth Strategy

### Decision

During migration, **`site/src/content/docs/` becomes canonical for user-facing docs**.

### Repository root `docs/` role after cutover

- keep only contributor/internal technical docs that are repo-native and not part of end-user docs navigation (if needed)
- remove duplicated user-facing pages from root `docs/` to avoid drift
- update root README links to website docs routes

### Rationale

- Starlight needs structured content and frontmatter-driven navigation.
- Maintaining two manual copies is guaranteed drift.
- Single canonical source keeps maintenance cost predictable as CLI/API surface grows.

---

## Product IA (Information Architecture)

### Top navigation

1. **Home**
2. **Docs**
   - Getting Started
   - Installation
   - CLI Reference
   - Data Sources (`pi`, `codex`, `opencode`)
   - Pricing & Cost Modes
   - Output Formats (`terminal`, `json`, `markdown`)
   - Configuration
   - Troubleshooting
3. **Architecture** (surfaced docs section, not hidden)
4. **Changelog** (GitHub releases)
5. **GitHub** / **npm**

### Landing sections

1. Hero (value + install command + docs CTA)
2. How it works (`parse -> normalize -> price -> render`)
3. Source compatibility matrix
4. Output examples (terminal/json/markdown)
5. Feature deep sections (determinism, offline pricing, multi-source diagnostics)
6. Final CTA to docs + repository

---

## UX/UI System Requirements (dev-tool aesthetic)

- asymmetric desktop composition, strict single-column mobile fallback (`< md`)
- neutral dark base + single accent family (emerald)
- Geist + Geist Mono typography pairing
- no oversaturated/neon glows
- strong keyboard/focus states
- tactile active states on interactive controls

Mobile-first requirements:

- no horizontal overflow at any breakpoint
- use CSS `min-height: 100dvh` when full-height intent is needed (never `h-screen` semantics)
- minimum touch target size: 40px
- screenshot preview/lightbox fully keyboard and screen-reader accessible

---

## Performance and Quality Budgets

### Budgets (release gate)

- LCP < 2.5s (mobile emulation)
- CLS < 0.05
- INP < 200ms
- homepage shipped JS <= 120KB gzip
- typical docs page shipped JS <= 90KB gzip

### Implementation guardrails

- Astro islands only for required interactivity
- explicit image dimensions + modern formats where possible
- defer non-critical scripts
- avoid layout thrashing and paint-heavy effects
- support `prefers-reduced-motion`

---

## Site Workspace and Dependency Plan

### Workspace shape

- keep website under `site/` as a dedicated package
- manage with pnpm workspace-aware scripts from repository root

### Root scripts to add (planned)

- `site:dev`
- `site:build`
- `site:preview`
- `site:check` (type/content/build checks)
- `site:docs:generate` (generated reference pages)

### Dependency policy

Before adding Astro/Starlight-related dependencies:

1. verify latest stable compatible versions from official docs/npm
2. record version choice and compatibility rationale in migration notes/PR
3. avoid optional dependencies unless needed by requirements

---

## Target `site/` Structure

```text
site/
  package.json
  astro.config.mjs
  tsconfig.json
  src/
    content/
      docs/
        index.mdx
        getting-started.mdx
        cli-reference.mdx
        architecture.mdx
        sources/
          pi.mdx
          codex.mdx
          opencode.mdx
    layouts/
      MarketingLayout.astro
    components/
      landing/
        Hero.astro
        FeatureBento.astro
        SourceMatrix.astro
        OutputExamples.astro
    scripts/
      copy-install.ts
      examples-tabs.ts
      screenshot-lightbox.ts
      npm-version-badge.ts
    pages/
      index.astro
  public/
    screenshot.png
```

Notes:

- default to `.astro` + small script modules
- no React component layer unless strictly justified later
- keep interaction logic isolated and testable

---

## Documentation Automation Model

Use hybrid docs maintenance:

### Manual authored

- conceptual guides
- troubleshooting
- architecture explanations
- migration notes

### Generated

1. **CLI reference generation**
   - derive command/option tables from repository-local CLI invocation (`pnpm run cli -- --help` + subcommands)
   - publish to `site/src/content/docs/cli-reference.mdx`
   - normalize output deterministically so CI diff checks are stable
2. **API reference generation** (gated)
   - enable only when a stable public programmatic API exists
3. **CI drift checks**
   - fail CI if generated docs are stale
   - run markdown lint and link validation

No full-auto docs promise: only repetitive reference is automated; conceptual docs remain authored.

---

## CI/CD and Hosting Plan

### Primary recommendation

Use **Vercel** for preview deployments and production hosting.

- enables per-PR preview URLs
- simplifies review for UX/UI and responsive checks

### Alternative

Keep GitHub Pages if required.

If GitHub Pages is retained, workflow must be rebuilt to:

- install dependencies
- run Astro build
- upload `site/dist` artifact (not raw `site/` source)
- configure Astro `site`/`base` correctly for project-pages routing (e.g. `/llm-usage-metrics/`)

### Single-host rule

Choose one production host and remove parallel production deployment paths.

---

## Migration Phases

### Phase 1 — Foundation and infra

- scaffold Astro + Starlight in `site/`
- establish tokens, typography, and global styles
- define docs routing/sidebar configuration
- wire root pnpm scripts for site commands

Exit criteria:

- `site:build` and `site:check` pass locally
- baseline docs index + custom home route render correctly

### Phase 2 — Landing migration

- port hero/features/examples/screenshot sections from existing static site
- preserve behaviors: npm badge, copy install, tabs, lightbox
- move npm badge lookup from client runtime fetch to build-time data load with graceful fallback
- refactor interactions into isolated script modules/islands
- implement ARIA-consistent tabs/lightbox patterns (roles, labels, escape handling, focus management)
- validate accessibility states (focus, keyboard, aria labels)

Exit criteria:

- visual parity (or better) with current site
- no interaction regressions on keyboard/mobile

### Phase 3 — Docs migration and IA hardening

- migrate user-facing docs into Starlight content collection
- normalize doc taxonomy and URL slugs
- add cross-links between landing sections and docs entry pages
- remove duplicate manual docs copies to enforce single source of truth

Exit criteria:

- complete docs navigation for core flows
- no duplicated user-facing docs across roots

### Phase 4 — Automation and quality gates

- implement CLI reference generation script
- add link check + markdown lint + generated-doc drift checks
- add Lighthouse CI budget checks
- add PR preview deployment flow

Exit criteria:

- CI enforces docs/site quality gates
- contributors can regenerate docs with one command

### Phase 5 — Deployment cutover and cleanup

- switch production deployment to built Astro output
- remove legacy static deployment behavior
- update README and repo docs links to new canonical routes
- remove obsolete static site files from active deployment path

Exit criteria:

- single production site stack active
- no legacy static stack in deployment chain

---

## QA Verification Matrix

Before final cutover:

- Lighthouse mobile + desktop against budgets
- keyboard-only traversal (nav, docs sidebar, search, tabs, copy action, lightbox)
- screen-reader smoke checks on Home + Getting Started + CLI Reference
- full-docs broken-link scan
- responsive snapshots: `320`, `375`, `768`, `1024`, `1440`
- dark-mode visual pass for contrast and readability
- offline/network-failure UX check for npm badge fallback state

---

## Risks and Mitigations

1. **Docs drift during migration window**
   - Mitigation: short migration window + explicit canonical switch in Phase 3.
2. **Performance regression from unnecessary hydration**
   - Mitigation: no framework runtime by default; enforce JS budgets in CI.
3. **Deployment confusion (Pages + Vercel both active)**
   - Mitigation: enforce single-host production rule in cutover checklist.
4. **URL breakage from docs relocation**
   - Mitigation: maintain redirect map and update README/docs entry points in same release.

---

## Definition of Done

- Astro + Starlight is the only maintained website/docs platform under `site/`
- landing page is production-grade: responsive, accessible, performance-budget compliant
- docs IA is complete for core user workflows and future feature growth
- generated docs pipeline exists and is enforced via CI
- production hosting and preview strategy are clear and singular
- repository links/docs are aligned with new canonical documentation routes
