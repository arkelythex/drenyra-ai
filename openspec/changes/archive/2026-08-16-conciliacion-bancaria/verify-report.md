# Verify Report — conciliacion-bancaria

Status: **PARTIAL** — implementation verified PASS on all 8 spec requirements; strict-TDD
evidence gap (CRITICAL) and a scope-hygiene leftover (WARNING) must be reconciled by the
parent before archive.

## Per-requirement verification (8/8 PASS)

| # | Requirement | Result | Evidence |
|---|-------------|--------|----------|
| 1 | Canonical movement normalization (fail-closed rejections) | ✅ PASS | `normalize.ts` — `normalizeBankRows`/`normalizeLedgerRows` return `{movements, rejected}`; every malformed row (date, reference, amount, side token, sourceKey, duplicate key) rejected with a typed code, never skipped/partially accepted. Tests: missing date, empty ref, non-integer amount, unknown side, impossible date, duplicate sourceKey, mixed batch. |
| 2 | BigInt-cent amounts (fractional cents and negative amounts rejected) | ✅ PASS | `Movement.amountCents: bigint`; `parseAmountCents` rejects negative (`NEGATIVE_AMOUNT`), fractional (`FRACTIONAL_CENTS`), zero/non-decimal; accepts `"250"`/`"250.00"`. Type-level `@ts-expect-error` contract checks in `types.test.ts`. |
| 3 | RUC + fiscal-period scope (cross-RUC rejected; invalid scope throws) | ✅ PASS | `validateScope` (11-digit RUC, YYYYMM, month 01–12) throws `INVALID_SCOPE`; rows with foreign RUC rejected `CROSS_RUC_ACCESS`; re-validated in `reconcile()` and `buildReport()`. |
| 4 | Reference-first matching | ✅ PASS | `compare.ts` — reference-first pass; 1:1 → `matched`; >1 counterpart on either side → `conflict` (surfaced, never guessed, excluded from fallback); 1:0/0:1 fall through to fallback. |
| 5 | Amount+date fallback matching (never amount or date alone) | ✅ PASS | Fallback requires exact `amountCents` AND `date` AND equal canonical `side`; deterministic one-to-one greedy by `sourceKey`. Tests prove different-day no-match, same-day different-amount no-match, amount-alone no-match, date-alone no-match, side-mismatch no-match. |
| 6 | Fail-closed adjustment drafts | ✅ PASS | `adjust.ts` — drafts ONLY from `bankOnly`/`ledgerOnly`; `matched`/`conflict` never draft; unclassified → `UNCLASSIFIED_DIFFERENCE` throw; justification + `requireApproval` default true + per-draft override; deterministic `adj-N` ids. |
| 7 | Executive reconciliation report (identity check) | ✅ PASS | `report.ts` — balances, full difference detail, adjustments, `netAdjustmentCents = Σ inflow − Σ outflow` (BigInt); `reconciled = fullyMatched AND ledgerFinal + netAdjustmentCents === bankFinal`; false when unmatched differences exist even if arithmetic identity holds; `INVALID_SCOPE` rejection. |
| 8 | Skill registry entry `pe.conciliacion-bancaria` | ✅ PASS | `skills/pe.ts` `CONCILIACION_BANCARIA` in `BASE_PE_SKILLS` (7 total); sibling manifest `drenyra-skills/skills/registry.json` matches all six conformance fields (version, jurisdiction, maxAutonomy, normativeSources, inputs, outputs); `skills:conformance` PASS; `pe-skills.test.ts` updated (7 entries + surface assertions). |

## Evidence commands

| Command | Result |
|---------|--------|
| `bun run test bank-reconciliation` | ✅ 65 passed (6 files) |
| `bun run typecheck` | ✅ clean (exit 0) |
| `bun run skills:conformance` | ✅ PASS — 7 skills in sync |
| `bun run test` (broad spot check) | ✅ 1277/1277 passed (89 files) |

## Task completion status

- All 34 `implementation`-owned task checkboxes are `[x]` (phases 1–8, PR A–D).
- Three unchecked `- [ ]` remain, all in the "Lifecycle gates (parent-owned, post-apply)"
  section with `<!-- sdd-owner: parent -->` — NOT implementation tasks; they are the
  parent's post-apply delivery scope:
  - `- [ ] Ship the four work units (A → B → C → D) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge.`
  - `- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge.`
  - `- [ ] Validate the integrated change: full suite green, no frozen contract or conformance delta, then merge to main.`

## Strict TDD compliance (strict_tdd: true in openspec/config.yaml)

| Check | Result | Details |
|-------|--------|---------|
| TDD Cycle Evidence table in apply-progress | ❌ **CRITICAL** | `apply-progress.md` has NO `TDD Cycle Evidence` table (no RED/GREEN/TRIANGULATE rows; zero TDD keywords). Strict TDD was enabled but apply did not report the mandated evidence table. |
| Test files exist | ✅ | 6 suites, 65 tests, cross-referenced and present. |
| GREEN confirmed | ✅ | 65/65 pass on execution; full suite 1277/1277. |
| Assertion quality audit | ✅ | No tautologies, ghost loops, type-only-alone, smoke-only, or implementation-detail assertions. All suites assert concrete values/behaviors (e.g. exact `250n` amounts, classifications, deterministic ids). |
| Triangulation | ✅ | Multiple distinct-value cases per behavior (fractional/negative/zero amounts; same-day/different-day fallback; reconciled true/false both directions). |
| Test layer | Unit only | All 6 suites are unit tests; engine is a pure library module — appropriate. |

**TDD compliance summary:** the *process evidence* is missing from apply-progress
(CRITICAL, per `strict-tdd-verify.md`), though the *product evidence* (tests written,
green, well-triangulated, high-quality assertions) is present and verified. The RED→GREEN
cycle structure is fully visible in `tasks.md` (all `[x]`). Remediation: parent should have
apply add the TDD Cycle Evidence table to `apply-progress.md` or formally waive it.

## Review workload / PR boundary

- Forecast in `tasks.md`: single PR with recorded `size:exception` (delivery strategy
  `single-pr`; config `review_budget_lines: 300` exceeded by design and recorded).
- No chained PRs created; nothing shipped yet (verify runs pre-PR). Boundary holds.
- ⚠️ **WARNING — scope hygiene:** untracked `reconciliation-fuzzy/` directory (3 files:
  `index.ts`, `types.ts`, `matcher.ts`, created 2026-08-16, self-contained, defines its own
  `ReconciliationError`, Spanish field names, NO tests, NOT wired into tsconfig/package.json,
  never referenced by any change artifact). It contradicts the spec's "deterministic engine
  only" scope and the apply-progress claim that "all drift was removed". Inert (not shipped,
  not imported, does not affect build/tests) but should be deleted before the PR ships to
  avoid accidental inclusion.

## Exact blockers

1. **CRITICAL — strict-TDD evidence gap:** `apply-progress.md` lacks the mandated
   `TDD Cycle Evidence` table (strict TDD active in config). Report the gap; parent decides
   remediation (add table / formal waiver) before archive.
2. **WARNING — leftover scope drift:** untracked `reconciliation-fuzzy/` must be removed
   before shipping the PR.
3. **Parent-owned lifecycle gates** (3 unchecked `- [ ]`, `sdd-owner: parent`): ship PR
   commits, post-apply bounded review + terminal receipt, validate + merge. Archive readiness
   follows completion of these gates per the tasks.md ownership contract.

## Notes

- `bank-reconciliation/` root wiring verified: root `index.ts` star-export + explicit
  `IsoDate` re-export; `package.json` subpath `./bank-reconciliation`; `tsconfig.json`/
  `tsconfig.build.json` includes present (imports resolve; typecheck clean).
- Engine module-boundary test confirms no imports of `agents/`, `cmd/`, `ledger/`, `mcp/`,
  or `adapters/`, and `ledger/` never imports `bank-reconciliation`.
- Fiscal-compliance and ruc-scope skills honored: BigInt cents everywhere, no floats for
  money, RUC scoping with fail-closed rejection, RUC checksum-adjacent validation at the
  scope boundary.
