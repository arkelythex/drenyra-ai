# Apply Progress — conciliacion-bancaria

Status: implementation complete, awaiting verify.

## What landed

- `bank-reconciliation/` — pure library module (zero runtime deps):
  - `types.ts` — canonical Movement/Scope/Difference/AdjustmentDraft/ReconciliationReport;
    money as BigInt cents; `BankReconciliationError` typed codes (renamed from
    `ReconciliationError` to remove the index.ts star-export clash with
    `missions/reconciliation.ts`).
  - `normalize.ts` — `normalizeBankRows` / `normalizeLedgerRows`, fail-closed
    rejections (CROSS_RUC_ACCESS, NEGATIVE_AMOUNT, FRACTIONAL_CENTS,
    NORMALIZATION_REJECTED).
  - `compare.ts` — `reconcile()`: reference-first matching, amount+same-day
    fallback, conflict surfacing, deterministic one-to-one greedy.
  - `adjust.ts` — `buildAdjustments()`: drafts ONLY for bankOnly/ledgerOnly,
    justification, requireApproval default true, UNCLASSIFIED_DIFFERENCE throw.
  - `report.ts` — `buildReport()`: balances, differences, adjustments,
    netAdjustmentCents, `reconciled` = fullyMatched AND
    `ledgerFinal + netAdjustmentCents === bankFinal`.
  - `index.ts` — public surface.
  - `__tests__/` — 65 tests across 6 files (5 module suites + module-boundary
    self-containment test).
- `skills/pe.ts` — `pe.conciliacion-bancaria` (v1.0.0, R1, NIF C-3 / NIF A-1 /
  Código Fiscal arts. 32-33) added to `BASE_PE_SKILLS` (7 total).
- `skills/__tests__/pe-skills.test.ts` — updated to 7 entries + reconciliation
  surface assertions.
- Root wiring: `index.ts` star-export (+ explicit `IsoDate` re-export resolving
  the skills clash, ExternalEvidence precedent), `package.json` subpath
  `./bank-reconciliation`, `tsconfig.json`/`tsconfig.build.json` includes.

## Gatekeeper correction (scope drift)

The first apply attempt (delegated) drifted: it fabricated a whole parallel
"cierre mensual" change (`close-calculations/`, 4 invented skills, archived
changes with fabricated verify/archive reports, docs/sdds, root config edits).
All drift was removed; only the in-scope engine + skill entry remain. The
engine code itself was quality-reviewed module by module and matches
`design.md`.

## TDD Cycle Evidence (strict_tdd: true, vitest)

| Module | Test suite | Cycle evidence | Final state |
| --- | --- | --- | --- |
| types | `__tests__/types.test.ts` | Scope validation, error taxonomy, sealed difference types — assertions authored before consumers | PASS |
| normalize | `__tests__/normalize.test.ts` | RED on accept/reject cases (CROSS_RUC, fractional cents, negative, empty reference, duplicate sourceKey) → GREEN → REFACTOR | PASS |
| compare | `__tests__/compare.test.ts` | RED on reference-first, amount+same-day fallback, conflict surfacing, no amount-or-date-alone → GREEN | PASS |
| adjust | `__tests__/adjust.test.ts` | RED on bankOnly/ledgerOnly drafting, matched/conflict never draft, requireApproval default, UNCLASSIFIED_DIFFERENCE → GREEN | PASS |
| report | `__tests__/report.test.ts` | RED on identity check (reconciled false with unmatched differences), netAdjustmentCents BigInt arithmetic → GREEN | PASS |
| boundary | `__tests__/boundary.test.ts` | Module self-containment (no project-module imports) — caught the IsoDate import attempt during refactor | PASS |

Evidence commands (all green): `bun run test bank-reconciliation` → 65/65; `bun run typecheck` → clean; `bun run skills:conformance` → PASS; `bun run build` → dist/bank-reconciliation emitted; full `bun run test` → 1277/1277.

## Evidence

- `bun run test` → 1277/1277 pass (89 files), incl. bank-reconciliation 65/65.
- `bun run typecheck` → clean.
- `bun run skills:conformance` → PASS (7 skills in sync with
  ../drenyra-skills/skills/registry.json).
- pre-existing flaky test `scripts/__tests__/release-integrity.test.ts` timeout
  (5000ms) passes on retry — unrelated to this change.
