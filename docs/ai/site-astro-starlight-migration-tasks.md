# Site Migration Tasks: Astro + Starlight

Source plan: `docs/ai/site-astro-starlight-migration-plan.md`

## Workflow rule

After each task:

1. Run the listed verification commands.
2. Record outcome in `docs/ai/site-astro-starlight-migration-progress.md` before moving to next task.
3. Do not start downstream tasks until upstream acceptance criteria are met.

---

## Task checklist

- [ ] T1 - Foundation scaffold in `site/`
  - Scope:
    - initialize Astro project in `site/`
    - add Starlight integration
    - set baseline `astro.config.*`, `tsconfig`, and site package scripts
    - keep project managed by pnpm workflow
  - Acceptance:
    - site builds locally
    - docs homepage and marketing homepage routes both resolve
  - Verify:
    - `pnpm install`
    - `pnpm run site:check`
    - `pnpm run site:build`

- [ ] T2 - Design system and global UX foundations
  - Scope:
    - migrate visual tokens (colors, typography, spacing) from current `site/style.css`
    - keep Geist + Geist Mono pairing
    - define responsive breakpoints and mobile-first defaults
    - enforce reduced-motion and keyboard focus states globally
  - Acceptance:
    - no horizontal overflow at target breakpoints
    - dark-mode readability + contrast validated
  - Verify:
    - `pnpm run site:check`
    - manual responsive sweep (`320`, `375`, `768`, `1024`, `1440`)

- [ ] T3 - Landing page migration with isolated interactivity
  - Scope:
    - migrate hero, feature bento, output examples, screenshot sections from legacy site
    - implement copy command interaction
    - implement examples tab system
    - implement screenshot lightbox (focus trap/escape/backdrop/keyboard)
    - move npm version badge behavior to build-time fetch with runtime-safe fallback state
  - Acceptance:
    - behavioral parity (or better) with legacy landing
    - no unnecessary global hydration
    - tabs/lightbox follow ARIA interaction semantics
  - Verify:
    - `pnpm run site:check`
    - `pnpm run site:build`
    - keyboard-only interaction pass

- [ ] T4 - Docs IA and content collection setup
  - Scope:
    - implement top-level docs taxonomy from plan
    - configure Starlight sidebar/nav
    - create canonical docs content paths under `site/src/content/docs`
    - include architecture section in visible nav
  - Acceptance:
    - users can navigate core paths: Getting Started, CLI Reference, Sources, Pricing, Output, Config, Troubleshooting
    - no placeholder dead routes
  - Verify:
    - `pnpm run site:check`
    - full-site link check

- [ ] T5 - User-facing docs migration and canonical switch
  - Scope:
    - migrate user-facing docs from root `docs/` into Starlight docs content
    - decide and execute canonical switch (remove duplicated user-facing copies)
    - update root README links to canonical web docs routes
  - Acceptance:
    - no duplicated user-facing docs maintained in two places
    - canonical location is explicit and documented
  - Verify:
    - `pnpm run site:check`
    - `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run format:check`

- [ ] T6 - Docs automation pipeline (generated references)
  - Scope:
    - add CLI reference generation script using repo-local invocation (`pnpm run cli -- --help` + subcommands)
    - write deterministic output to `site/src/content/docs/cli-reference.mdx`
    - add stale-generated-doc CI check
  - Acceptance:
    - generated CLI docs are reproducible
    - CI fails when generated output is outdated
  - Verify:
    - `pnpm run site:docs:generate`
    - `pnpm run site:check`

- [ ] T7 - CI integration for site quality gates
  - Scope:
    - integrate site checks/build into CI workflow
    - add link checker and markdown lint for site docs
    - add Lighthouse budget checks for homepage/docs templates
  - Acceptance:
    - CI blocks regressions in docs/UX/performance budgets
  - Verify:
    - CI run on PR passes all site gates

- [ ] T8 - Hosting implementation (single-host production)
  - Scope:
    - choose final production host (Vercel recommended)
    - configure preview deploys per PR
    - if GitHub Pages path is kept, ensure artifact deploys `site/dist` and proper Astro `base/site` config
    - remove parallel production deploy ambiguity
  - Acceptance:
    - one production host only
    - preview URLs available for review
  - Verify:
    - successful preview deployment
    - successful production deployment dry run

- [ ] T9 - Accessibility and quality hardening pass
  - Scope:
    - run structured a11y audit on Home + Getting Started + CLI Reference
    - validate SR labels, heading order, focus order, keyboard traps
    - validate offline/network failure behavior for npm badge fallback
  - Acceptance:
    - no critical accessibility defects
    - degraded network states remain understandable
  - Verify:
    - manual a11y checklist
    - optional automated pass (`axe`/equivalent)

- [ ] T10 - Final cutover and cleanup
  - Scope:
    - switch docs/site links everywhere to canonical routes
    - remove legacy raw static deployment path
    - archive or delete obsolete website files not used post-cutover
    - publish migration summary and maintenance guidance
  - Acceptance:
    - Astro + Starlight is the only active website/docs stack
    - no legacy deployment behavior remains in workflows
  - Verify:
    - `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run format:check`
    - `pnpm run site:check && pnpm run site:build`
