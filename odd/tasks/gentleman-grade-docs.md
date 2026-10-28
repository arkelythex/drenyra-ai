# Feature — Gentleman-grade documentation and Dreamcoder visuals

**Status:** in progress · **Branch:** `docs/gentleman-grade-docs` · **Engram mirror:** `odd/gentleman-grade-docs/tasks`
Rewrite the README and every Markdown document to the editorial bar of the Gentle-AI README, with
SVGs, diagrams, and visuals drawn from the Dreamcoder Light and Dreamcoder Dark palettes.

## Specs

- **S1** — The README MUST follow the Gentle-AI README model: "me encanta el readme de este proyecto , <https://github.com/Gentleman-Programming/gentle-ai> , asi debe ser para este proyecto". Concretely: hero banner, palette-matched `for-the-badge` badges, a pain-first pitch, a `Features` section where each concept gets one full-width visual, one problem-first paragraph and a `Docs →` link, then Get started, a Documentation table, ecosystem, and closing — with section dividers and "Back to top" links.
- **S2** — The whole documentation set MUST reach the same quality: "y toda su documentacion con la calidad de gentleman". Scope (owner decision 2026-10-28): **all repository Markdown (~97 files)**.
- **S3** — SVGs, diagrams, and other visuals MUST take their inspiration from the Dreamcoder themes: "ademas para los svgs , diagramas y mas visuales deben inspirarse de dreamcmoder light y dreamcoder dark". Tokens come from `dreamcoder-dots/DreamcoderThemes/dreamcoder/tokens.json` (`modes.light`, `modes.dark`).
- **S4** — Diagram approach (owner decision 2026-10-28): **hybrid**. Hand-crafted SVGs for README brand and feature visuals; Archify artifacts re-themed to Dreamcoder for the technical maps under `docs/`. `docs/documentation-standard.md` §5 MUST be amended to record the hybrid rule.
- **S5** — Every visual MUST ship as a Light/Dark pair embedded with `#gh-light-mode-only` / `#gh-dark-mode-only` (or `<picture>`), with descriptive `alt` text, and MUST NOT depict a claim the prose does not make (money as floats, unscoped access, unreceipted actions).
- **S6** — Facts MUST stay true: versions, statuses, and contract states match the repository (for example `package.json` is `0.6.0`; the README still says `v0.5.0`).
- **S7** — Normative surfaces (`contracts/`, `specs/`, `program/`) get presentation-only changes: navigation, headers, callouts, tables. Normative wording, requirement IDs, and versions MUST NOT change.

## Tasks

| ID | Specs | Task | Status | Commit |
| --- | --- | --- | --- | --- |
| T0 | S3 | brand-system v0.4: Dreamcoder Dark tokens, checker accent fix, schema v0.4 | done | (this commit) |
| T1 | S3, S4 | Dreamcoder docs palette and amended diagram rule in `documentation-standard.md` | pending | |
| T2 | S1, S3, S5 | Brand kit: hero banner, divider mark, badge palette (Light/Dark) | pending | |
| T3 | S1, S3, S5, S6 | README rewrite with feature diagrams (Light/Dark) | pending | |
| T4 | S3, S4, S5 | Re-theme the Archify maps to Dreamcoder Light/Dark | pending | |
| T5 | S2, S6 | Entry docs: quickstart, intended-usage, usage, sdk | pending | |
| T6 | S2 | `docs/architecture.md` and `docs/architecture/*` | pending | |
| T7 | S2 | CODEBASE-GUIDE, testing-deterministic, governance, fiscal-authority-kernel-chain | pending | |
| T8 | S2, S6 | Root files: AGENTS, CONTRIBUTING, AI_POLICY, SECURITY, CODE_OF_CONDUCT, RELEASING, ROADMAP, CHANGELOG, CONTRIBUTORS, PR template | pending | |
| T9 | S2, S7 | `contracts/` presentation pass | pending | |
| T10 | S2 | `docs/design`, `docs/runbooks`, `docs/roadmaps`, `docs/assets/brand/*.md` | pending | |
| T11 | S2, S7 | `program/drenyra-dominion` presentation pass | pending | |
| T12 | S2, S7 | `specs/` presentation pass | pending | |
| T13 | S2, S5 | Verification: markdownlint, relative links, SVG validity, render check | pending | |

## Log

- **L1** (2026-10-28, owner): "me encana el readme de este proyecto , <https://github.com/Gentleman-Programming/gentle-ai> , asi debe ser para este proyecto y toda su documentacion con la calidad de gentleman , ademas para los svgs , diagramas y mas visuales deben inspirarse de dreamcmoder light y dreamcoder dark ❯ pwd /home/dreamcoder08/Documents/PROYECTOS/dreamcoder-dots"
- **L2** (2026-10-28, owner): scope "Todo el repo (~97 .md)"; diagrams "Híbrido" (hand-crafted SVG for README brand/features; Archify themed to Dreamcoder for technical maps).
- **L3** (2026-10-28, evidence): existing `docs/assets/brand/*.svg` already use Dreamcoder Light only; the Archify maps in `docs/diagrams/` use Archify's default slate palette in both modes; `docs/documentation-standard.md` §5 currently forbids hand-drawn diagrams.
- **L4** (2026-10-28, evidence): `contracts/brand-system` v0.3 pinned the dark theme to Anthracite Steel (`#070A13`) and banned OLED black, while the current Dreamcoder Dark in `dreamcoder-dots` is OLED `#000000` with indigo `#A5B4FC` / lavender `#D4B5FD`. The checker also collected the banned `cyan`/`violet` accents instead of `cocoa`/`terracotta`, and `tokens.schema.json` was still v0.2.
- **L5** (2026-10-28, owner): "Dreamcoder Dark actual de dots" — approve brand-system v0.4 with the current Dreamcoder Dark (contract change, added as T0).
