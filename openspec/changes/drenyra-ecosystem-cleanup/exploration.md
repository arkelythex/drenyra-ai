# Exploration — drenyra-ecosystem-cleanup

> SDD phase: explore · Date: 2026-08-11 · Store: openspec (Engram unavailable)
> Scope: drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel.
> **EXCLUDED: drenyra-command-center** (concurrent agent session active — concurrency hazard).

## Executive summary

The headline finding is the **RUC Módulo 11 validator has no single source of
truth**: the released canonical core (drenyra-ai) ships the *weakest*
(shape-only `isValidRuc`) version while drenyra-pi's port does the full
checksum, and drenyra-ai `flow/close.ts` re-declares RUC/PERIOD regexes
instead of importing them. drenyra-skills and drenyra-guardian-angel are
near-empty pre-alpha scaffolds referencing banner PNGs and skill content that
don't exist where claimed (split-brain with `drenyra-ai/skills`). Otherwise
drenyra-ai and drenyra-pi are disciplined (JSON.parse guarded, switches have
defaults). Real duplicated-helper debt: drenyra-ai `flow/close.ts` regexes and
drenyra-pi's repeated NDJSON-parse helper across ~7 files.

## Artifacts (grouped by repo)

### drenyra-ai

- **RUC duplication**: `candidates/types.ts` (`isValidRuc`, shape-only
  `/^\d{11}$/`) vs `flow/close.ts:78-79` (re-declares `RUC_RE`/`PERIOD_RE`;
  `guardian/guardian.ts` imports from candidates correctly — flow is the
  outlier).
- **Stale doc**: `contracts/README.md` says brand-system "DRAFT at v0.1"
  (tokens.json says 0.2) — verify exact spot.
- **Dependabot high**: `nanoid@3.3.16` (transitive: vitest → vite → postcss),
  CVE-2024-55565; fixed in `3.3.17`. Add `overrides` or bump postcss.

### drenyra-pi

- `runtime/ruc.ts` — ported checksum validator; header cites a
  `drenyra-command-center packages/shared/...` source path that no longer
  exists (ported-with-no-source-of-truth).
- Duplicated fail-closed NDJSON/JSON parse helper across `lib/mission-store.ts`,
  `lib/authority-store.ts`, `lib/receipt-store.ts`, `lib/evidence-graph.ts`,
  `chains/verify.ts`, `chains/evidence.ts`, `chains/reconcile.ts`,
  `chains/monthly-close.ts`.
- **User-owned uncommitted files — DO NOT touch** (`__tests__/agents.test.ts`,
  `__tests__/extension.test.ts`, `scripts/verify-package-files.mjs`).

### drenyra-skills

- Scaffold only. Claims to be the content layer, but all content lives in
  `drenyra-ai/skills` (`BASE_PE_SKILLS`) — split-brain to resolve in design.
- Missing referenced `assets/branding/drenyra-skills-banner.png` (expected —
  banner generation pending).

### drenyra-guardian-angel

- Near-empty scaffold; `docs/` and `src/` are planned-but-empty placeholders.
- Missing referenced `assets/branding/drenyra-guardian-angel-banner.png`
  (expected — banner generation pending).

### Cross-repo

- `assets/branding/BRAND.md` template duplicated across pi/skills/guardian
  (same normative refs + validate block); all embed **absolute machine paths**
  (`/home/dreamcoder08/...`) — portability issue for the freeze gate.
- DTCG brand tokens mirror command-center `apps/web` pipeline (source of the
  palette; command-center is out of scope this round).

## Next recommended

1. **Safe self-contained slice (drenyra-ai)**: `flow/close.ts` imports
   RUC_RE/PERIOD_RE from `candidates/types.ts`; fix stale contracts/README.md
   brand-system version note; add nanoid override. Zero release-surface
   change, no cross-repo, no concurrency risk.
2. **Higher-value follow-up (own slice)**: consolidate a checksummed
   `isValidRuc` into drenyra-ai as single source of truth; drenyra-pi consumes
   the released package. Requires design + version-policy compliance
   (drenyra-ai is a released package; public export change → major bump +
   migration path).
3. **Skills content migration** (own slice): move BASE_PE_SKILLS content from
   drenyra-ai/skills to drenyra-skills, keep registry mechanics in the runtime.

## Risks

- drenyra-pi uncommitted user files block pi-side edits this round.
- drenyra-command-center actively modified by another session — out of scope.
- drenyra-ai is a released package (contracts frozen v0.1): internal dedup is
  safe; public export changes need major bump + migration.
- `brand-ecosystem-status.mjs` assumes sibling repos at `../<repo>`.
