# Feature: sdd-to-odd-migration

**Objective:** retire SDD/OpenSpec in Drenyra AI and make ODD the only workflow, as Drenyra Shell and Drenyra Engram did. The Drenyra Dominion program master is **converted, not deleted**.
**Branch:** `chore/purge-sdd-full-odd`
**Gates:** `bun run typecheck`, `bun run lint`, `bun run test`, markdownlint on touched files.

## Specs

- **S1 — "eliminar sdd legacy full ODD de gentleman".** `openspec/` is removed from the tree.
- **S2 — Program master converted, not deleted** (owner decision in L2). `openspec/programs/drenyra-dominion/` moves **verbatim** to `program/drenyra-dominion/`, including the 16 program SDDs, `charter.md`, `gate-0.md`, `program-lock.json`, and its schema. The `SDD-0x0` identifiers stay as the program's names for its vertical documents.
- **S3 — Release integrity keeps working.** `scripts/checksum-lock.mjs` and `scripts/promoted-composition.mjs` default to `program/drenyra-dominion/program-lock.json`, test-first. `release:generate` output is unchanged.
- **S4 — No requirement lost.** Each active change's spec moves verbatim to `specs/<capability>/spec.md`. The 202 archived files stay in git history.
- **S5 — No pending work dropped.** Every unchecked task is classified as SDD ceremony (obsolete under ODD) or real work. Real work becomes an open ODD feature document, quoted verbatim: `ecosystem-coherence` (15 items, including 4 owner-gated governance decisions) and `monthly-close-core-integration` (proposal only, not started).
- **S6 — No rule lost.** `openspec/config.yaml` context, testing, and rules move to `AGENTS.md`.
- **S7 — No dangling link in this repository.** Docs, the docs workflow, and the markdownlint config point to the new paths.
- **S8 — PR #100 (GO-000 native Go runtime constitution).** It is not rewritten here. It adds files under `openspec/`, so it is told to re-home them under `program/` and `odd/tasks/` after this lands.
- **S9 — Sync follow-up.** Drenyra Shell and Drenyra Engram links to `openspec/programs/drenyra-dominion` are updated right after this merges.

## Tasks

- [ ] **T1** — RED/GREEN: the release-integrity scripts default to `program/drenyra-dominion/program-lock.json`; tests updated first. *(S3)*
- [ ] **T2** — `git mv` the program master to `program/drenyra-dominion/`; fix links in this repository. *(S2, S7)*
- [ ] **T3** — Move the 6 active specs to `specs/`; open ODD documents for `ecosystem-coherence` and `monthly-close-core-integration`; delete `openspec/`. *(S1, S4, S5)*
- [ ] **T4** — `AGENTS.md` (config conventions + ODD workflow), CONTRIBUTING, CODEBASE-GUIDE, README, ROADMAP, governance, CHANGELOG. *(S6, S7)*
- [ ] **T5** — Gates, PR, and a note on PR #100. *(S8)*

## Log

### L1 — 2026-10-27 — original request (verbatim)

> yes te autorizo todo avanza ya que mi oobjetivo es que Drenyra-ai Drenyra-shell + Drenyra-engram esten bien sincornizados actualizados bien configurados 10/10 y eliminar sdd legacy full ODD de gentleman

### L2 — 2026-10-27 — owner decisions

- Program master: **"Convertir, no borrar"**, chosen from the options offered (the 16 SDDs move to the new location with their content preserved; the archive is deleted; #100 is redone as an ODD document).
- Work in the existing clones, on new branches from `origin/main`, without touching foreign unpushed work.

### L3 — 2026-10-27 — inventory

- `openspec/`: 269 files. 202 under `changes/archive`, 29 in `programs/drenyra-dominion`, 7 active changes, and `config.yaml`.
- Code that reads `openspec/`: `scripts/checksum-lock.mjs` and `scripts/promoted-composition.mjs` (`DEFAULT_LOCK`) and their tests, the docs workflow `--exclude-path`, and the markdownlint ignore. Also two `docs/sdds/*.yaml` comments.
- The `ecosystem-10-10-backlog` tracker lists two unpushed branches touching `openspec/`. Both have since merged (#105, #108), so there is no collision. Of the open PRs, only #100 touches `openspec/`.

### L4 — 2026-10-27 — unchecked tasks classified

- Ceremony, obsolete under ODD (bounded review, `sdd-verify`, `sdd-archive`, receipt or lifecycle gates owned by the SDD parent): `drenyra-ecosystem-cleanup` 2, `ecosystem-script-resilience` 2, `gentle-ai-quality-parity` 1, `release-integrity-evidence` 1, `reproducible-lint-gate` 3.
- Real work: `ecosystem-coherence`, 15 items moved verbatim to `odd/tasks/ecosystem-coherence.md`. `monthly-close-core-integration` has only a proposal, moved verbatim to `odd/tasks/monthly-close-core-integration.md`.
