# Feature — IGV determination engine (`pe.igv-validate`)

**Status:** done — PRs open for human fiscal review (not merged)
**Route:** ODD organic (explicit one-time exception — see rationale below), delegated writer
**Authorization:** user asked to implement the missing IGV determination engine as the first of 14
Peru skills that are declared in `skills/pe.ts` but have zero implementing code. User initially asked
for SDD, then explicitly requested ODD instead for this one change ("Usa ODD no SDD, ODD es mejor"),
and on being shown the tension with `CONTRIBUTING.md`'s just-documented SDD-reserved scope (fiscal
lifecycle / Ground Rules invariants), confirmed: **exception for IGV only** — `CONTRIBUTING.md`'s rule
stays as written; this one fiscal change is deliberately fast-tracked through the organic flow instead
of full proposal/spec/design/tasks.
**Engram mirror:** `odd/igv-determination-engine/tasks`

## Rationale / risk acceptance

- This IS fiscal logic (money math, normative citations, feeds candidates/receipts) — normally SDD
  scope per `CONTRIBUTING.md#development-workflow`.
- Compensating controls in place of the SDD ceremony: strict TDD (RED→GREEN→REFACTOR, this project's
  `strict_tdd: true` per `sdd-init` memory), the exact architectural pattern already proven twice
  (`close-calculations/isr.ts`, `bank-reconciliation/`), full existing test suite green before/after,
  and **no auto-merge** — this PR is left open for explicit human fiscal review, unlike this session's
  earlier mechanical/docs PRs.
- Ground Rules still apply in full: BigInt cents only, tenant/RUC scope, deterministic, tested.

## Scope

Implement a deterministic IGV (Impuesto General a las Ventas) determination engine:

- **Débito fiscal**: IGV on taxable sales invoices for a period.
- **Crédito fiscal**: IGV on purchase invoices for a period, filtered by formal/substantial validity
  (valid comprobante, not annulled, destined to taxed operations) per TUO IGV (D.S. 055-99-EF) Arts.
  18-19.
- **Net position**: payable / in-favor / zero, mirroring the existing `AnnualBalanceKind` pattern in
  `annual-declaration/types.ts`.
- New module `igv/` (types.ts, engine.ts, report.ts, `__tests__/`), same shape as
  `close-calculations/isr.ts` and `bank-reconciliation/`.
- Wire into `skills/pe.ts`'s existing `IGV_VALIDATE` card if its declared inputs/outputs need
  adjustment to match the real engine surface — if so, this requires a matching
  `arkelythex/drenyra-skills` registry PR (cross-repo sync, same pattern as `pe.renta-anual` earlier
  today).
- New `package.json` export subpath `./igv` if the module should be public (match existing
  `close-calculations`/`bank-reconciliation` precedent — they are exported).

## Explicitly out of scope

- SIRE, detracciones, retenciones, percepciones, PLE, PLAME (the other 13 unimplemented skills) —
  separate features.
- Wiring into `flow/close.ts` or any mission intent — this task delivers the pure engine + report
  only, matching how `bank-reconciliation/` and `close-calculations/` originally shipped standalone
  before later wiring.
- Any change to `mcp/`, `agents/`, or gates.

## Tasks

| # | Task | Status |
| --- | --- | --- |
| 1 | Study `close-calculations/isr.ts` + `bank-reconciliation/` as architectural templates | done |
| 2 | RED: write failing tests for `igv/types.ts`, `debit.ts`, `credit.ts`, `engine.ts`, `report.ts`, `index.ts`, `boundary.ts` (débito, crédito, net position, validity filtering) | done — 7 suites, "Cannot find module" (correct RED reason) |
| 3 | GREEN: implement the engine to pass those tests | done — 40/40 tests pass |
| 4 | `igv/report.ts` (executive report, matching sibling engines' report shape) | done — recomputes the débito-crédito identity, fails closed on mismatch |
| 5 | Wire `skills/pe.ts` `IGV_VALIDATE` card (and companion `drenyra-skills` PR since inputs/outputs changed) | done — 1.0.0 → 1.1.0; drenyra-skills PR #9 opened, not merged |
| 6 | `package.json` export subpath + `tsconfig.json`/`tsconfig.build.json` include + CHANGELOG entry | done |
| 7 | Full suite green (typecheck/lint/test/skills:conformance), branch + PR opened, left for human review (no auto-merge) | done |

## Verification

- `bun run typecheck` — PASS (0 errors)
- `bun run lint` — PASS (exit 0; 2 pre-existing biome schema-version infos, unrelated)
- `bun run test` — PASS, 118 files / 1528 tests (was 1488 before this change; +40 new)
- `bun run skills:conformance -- --manifest <drenyra-skills worktree registry.json>` — PASS, 20 skills in sync
- `npx markdownlint-cli2 CHANGELOG.md` — 0 issues

## Known pre-existing issue (not caused by this change)

The local `drenyra-skills` checkout at `/home/dreamcoder08/Documents/PROYECTOS/drenyra-skills` is on
branch `docs/align-skill-ownership`, which predates the already-merged `pe.renta-anual` PR #8 on
`main`. Running `bun run skills:conformance` with the default sibling-root manifest against that
checkout reports `pe.renta-anual` drift — this is stale local branch state, not a regression from this
IGV work. The IGV skill-registry PR was branched from `origin/main` in an isolated worktree instead,
where conformance passes cleanly.

## PRs opened (neither merged — left for human fiscal review)

- `drenyra-ai`: <https://github.com/arkelythex/drenyra-ai/pull/112> (branch `feat/igv-determination-engine`)
- `drenyra-skills`: <https://github.com/arkelythex/drenyra-skills/pull/9>
