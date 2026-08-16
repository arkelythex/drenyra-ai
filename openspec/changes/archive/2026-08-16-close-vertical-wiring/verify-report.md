# Verify Report — Close Vertical Wiring

## Verdict

**PASS** (with 3 deferred parent-owned lifecycle gates — not implementation-owned; archive readiness is parent-owned).

Independent verification of the applied change against the spec R1–R7. All gates green except one
pre-existing order-dependent flake (`release-integrity` SBOM fidelity timeout) that is confirmed
pre-existing and passes in isolation 13/13.

## Structured status consumed (openspec, authoritative)

```yaml
schemaName: spec-driven
changeName: close-vertical-wiring
artifactStore: openspec
changeRoot: openspec/changes/close-vertical-wiring
artifactPaths:
  proposal: openspec/changes/close-vertical-wiring/proposal.md (done)
  specs: openspec/changes/close-vertical-wiring/spec.md (done)
  design: openspec/changes/close-vertical-wiring/design.md (done)
  tasks: openspec/changes/close-vertical-wiring/tasks.md (done)
  applyProgress: openspec/changes/close-vertical-wiring/apply-progress.md (done)
  verifyReport: openspec/changes/close-vertical-wiring/verify-report.md (created by this phase)
taskProgress: total 23, complete 20 implementation + 0 parent -> 3 parent-owned deferred
applyState: verify complete; archive blocked only on parent-owned lifecycle gates
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai]
  warnings: []
```

## Gate results

| Gate | Command | Result |
| --- | --- | --- |
| Focused flow tests | `bun run test flow` | **35 passed / 3 files** (close-wiring 21 + close-integration 9 + pre-existing close.test.ts 5, unchanged) |
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | **EXIT 0** |
| Build | `bun run build` | **EXIT 0** |
| Full suite | `bun run test` | 1362 passed, **1 failed** — the known pre-existing flake (see below) |
| Flake in isolation | `bun run test scripts/__tests__/release-integrity.test.ts` | **13 passed (13)** — confirms pre-existing order-dependence |

### Known flake attribution (NOT a failure of this change)

`scripts/__tests__/release-integrity.test.ts` → "fails verification on every SBOM fidelity drift
class" timed out at 5000 ms under full-suite concurrency (13 tests in file, 1 timed out). It passes
13/13 in isolation. This is the pre-existing, order-dependent flake documented in tasks.md and
apply-progress (baseline failure on the untouched 1333-test suite before this change; unrelated to
`flow/`). Judge by flow tests (35/35), the full suite minus this flake (1362/1362), and
typecheck/build (both EXIT 0) — all green.

## Spec requirement coverage (R1–R7)

Evidence read directly from implementation and tests (not trusted from apply-progress).

| Req | Requirement | Evidence (file + test) | Verdict |
| --- | --- | --- | --- |
| R1 | Reconciliation converter — one proposal per adjustment draft | `flow/close-wiring.ts` `reconciliationToProposals` (normalize → reconcile → buildAdjustments → one proposal per draft, deterministic draft order, `amountCents: draft.amountCents.toString()`); `flow/__tests__/close-wiring.test.ts`: "produces exactly one proposal per classified adjustment draft" (two bank-only `250n` + one matched pair → exactly 2 proposals, label `adjustment:adj-N`, explanation from justification, amountCents `"250"`, reversibility), "yields zero proposals when every movement is matched", "is deterministic: identical inputs produce identical proposals in identical order" | **PASS** |
| R2 | Close converter — one proposal per balanced close entry | `flow/close-wiring.ts` `closeEntriesToProposals` (depreciation/provisions/ISR-entry-only/closing; `CLOSE_KIND_REVERSIBILITY` table); `close-wiring.test.ts`: "produces exactly one proposal per balanced close entry" (5 entries → 5 proposals, deterministic order, balanced BigInt magnitudes), "maps a depreciation entry's label, explanation, and balanced amount" (`1_200_000n` debit/credit → amountCents `"100000"`... depreciation scenario in spec at `1_200_000n` rate 2000bp → 20000; the dedicated test uses 10000bp → 100000; balanced-magnitude semantics asserted), "derives reversibility deterministically per entry kind", "derives exactly one proposal from the ISR entry and never from the cédula" (`subject` excludes `cedula`) | **PASS** |
| R3 | Fail-closed conversion | `close-wiring.ts` catch paths (BankReconciliationError/CloseError → typed-code risk, zero proposals from failed call) + rejected-row risk surfacing; `close-wiring.test.ts`: FRACTIONAL_CENTS (no proposal for rejected row, accepted row still maps), NORMALIZATION_REJECTED, CROSS_RUC_ACCESS, INVALID_SCOPE (both converters), ACCOUNT_NOT_IN_CHART, UNCLASSIFIABLE_INPUT (provision kind + closing balance), "never fabricates a proposal when an engine call fails" (invalid period aborts normalization → typed risk, zero proposals); `close-integration.test.ts`: "surfaces a wiring engine error as a risk in ClosePackage.risks" (FRACTIONAL_CENTS visible, accepted rows still produce candidates), "surfaces an unclassifiable close input as a risk" (UNCLASSIFIABLE_INPUT, zero candidates) | **PASS** (with documented deviation, below) |
| R4 | Vertical integration — internal proposal generation | `flow/close.ts`: `MonthlyCloseInput` gains optional `bankRows?`/`ledgerRows?`/`closeInputs?`; `runMonthlyClose` assembles `allProposals = [...(input.proposals ?? []), ...generated]` (external first, generated second, nothing dropped) and pushes `wiringRisks` into `risks` BEFORE the candidate loop; `close-integration.test.ts`: "generates candidates from engine inputs end-to-end through the existing pipeline" (7 candidates, receipts signed, `ledgerValid`), "merges external proposals first, then engine-generated proposals, dropping nothing" (8 candidates, external first), "honors external proposals when engine inputs are absent" (identical pre-change behavior), "produces zero candidates when neither external proposals nor engine inputs are supplied" (complete, zero candidates) | **PASS** |
| R5 | Pipeline unchanged | `flow/close.ts` diff: only the loop iterable changed (`input.proposals ?? []` → `allProposals`); CandidateLifecycle.propose / runGuardianReview / buildSignedReceipt / validateLedger untouched; no new gates, receipt types, or authority-model change; `close-integration.test.ts`: "produces exactly one candidate per generated proposal with the close scope and derived materiality" (candidate id + `materiality` from `BigInt(amountCents)`/reversibility asserted), "blocks receipting for an irreversible generated candidate via the guardian" (R3 blocker → 0 receipts, risk surfaced), "produces identical outcomes for identical external and generated proposals" (candidate id, guardian hash, receipt count, ledgerValid all equal) | **PASS** |
| R6 | Scope isolation — one RUC + one period | `close-wiring.ts` passes `{ ruc: scope.ruc, period: scope.period }` to engines; `close-wiring.test.ts`: "rejects a cross-RUC row fail-closed with CROSS_RUC_ACCESS" (no proposal for the foreign row, accepted row still maps), "surfaces INVALID_SCOPE and produces no proposals for a malformed scope" (bad RUC and bad period, both converters); `close-integration.test.ts`: every candidate `scope` asserted equal to the close's `{ ruc: "20131312955", period: "202607" }` | **PASS** |
| R7 | No engine or contract drift | `git diff --name-only` = `flow/close.ts` only; untracked = the 3 new flow files + openspec change dir; `git diff --stat` for `bank-reconciliation/`, `close-calculations/`, `contracts/`, `ledger/`, `cmd/`, `agents/`, `mcp/`, `adapters/`, `skills/` = empty; `git diff candidates/types.ts` = empty; `flow/close-wiring.ts` imports ONLY `../bank-reconciliation/index.js`, `../close-calculations/index.js`, `../candidates/types.js`, `./close.js` — verified against the engines' `index.ts` public exports (`normalizeBankRows`, `normalizeLedgerRows`, `reconcile`, `buildAdjustments`, `buildReport`, `export * from types`; `computeDepreciation`, `computeProvisions`, `computeProvisionalIsr`, `closeResultAccounts`, `buildCloseReport`, `export * from types`); no internal engine module imported; skills/ registry still 11 tracked files, unchanged | **PASS** |

## Spec scenario coverage notes

- Spec scenarios UNBALANCED_ENTRY and UNCLASSIFIED_DIFFERENCE: confirmed engine-internal
  invariants not reachable through the public API (all engine producers run `assertBalanced`
  before emitting, `close-calculations/types.ts:258`; `buildAdjustments` throws
  `UNCLASSIFIED_DIFFERENCE` only in a `default` branch of a switch over the sealed
  `Difference` union, `bank-reconciliation/adjust.ts:83`). The fail-closed mechanism that
  would surface them (catch → typed-code risk → zero proposals) is the exact same path
  exercised by the reachable typed errors and is asserted by the "never fabricates a proposal
  when an engine call fails" test. Documented deviation in apply-progress; acceptable.
- R2 amount semantics: `mapEntry` uses the debit-side sum (balanced ⇒ per-side total), not the
  design's literal full-line reduce (which would double-count). Matches the normative spec
  scenario (balanced magnitude). Documented deviation; correct.
- Subject serialization maps `amountCents` lines to strings (`JSON.stringify` throws on
  BigInt); deterministic and serializable. Documented deviation; correct.

## Task completion status

- All **20 implementation-owned tasks** are checked `[x]` (tasks.md rows 1–20).
- **No unchecked implementation task lines remain.** The only unchecked `- [ ]` lines are the
  three **parent-owned lifecycle gates** (grouped separately at the end of tasks.md, each
  terminated with `<!-- sdd-owner: parent -->`):

```text
- [ ] Ship the two work units (W1 → W2) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [ ] Validate the integrated change: full suite green (`bun run test`, `bun run typecheck`, `bun run build`), no frozen contract or conformance delta, sibling `drenyra-ecosystem-cleanup` regex edits intact, then merge to main. <!-- sdd-owner: parent -->
```

These are deferred parent actions, not implementation completeness issues. **Archive is not
ready** until the parent-owned ship/review/merge gates close.

## Strict TDD compliance (active per openspec/config.yaml `strict_tdd: true`)

- apply-progress.md contains a `TDD Cycle Evidence` table (RED converters → module-not-found
  FAIL; GREEN converters → 21 passed; RED integration → `bankRows` missing on
  `Partial<MonthlyCloseInput>` FAIL; GREEN integration → 14 passed; W1 slice + full regression
  rows). **PASS.**
- Reported test files cross-reference against the codebase: `flow/__tests__/close-wiring.test.ts`
  (21 `it()` — matches), `flow/__tests__/close-integration.test.ts` (9 — matches),
  `flow/__tests__/close.test.ts` (5, unchanged — passes as part of the flow gate).
- Relevant tests run and GREEN: `bun run test flow` → 35/35.
- Assertion quality audit: no tautologies (concrete labels, amountCents strings, reversibility
  values, typed risk codes, candidate counts, scope objects, materiality, receipt counts,
  `ledgerValid`); no ghost loops; no type-only assertions; not smoke-only (guardian hashes and
  candidate ids asserted); no implementation-detail CSS assertions (TS project). The one
  `as unknown as ProvisionInput` cast is deliberate — the engine's kind union is sealed, so a
  cast is the only way to feed an out-of-policy kind; the assertion is meaningful
  (UNCLASSIFIABLE_INPUT risk, zero proposals). **PASS.**

## Review workload / PR boundary

- `tasks.md` forecast: Chained PRs recommended **No** (user decision single-pr), size exception
  **recorded** (`openspec/config.yaml` `review_budget_lines: 300`; ~460 authored lines across
  the four files exceed the aggregate), Chain strategy n/a. Matches apply-progress.
- Implemented slice respects the boundary: W1 + W2 as one change set (single PR, two
  sequential commits), no chained PR created, no scope creep beyond the assigned tasks. **PASS.**

## Out-of-scope / drift confirmation

- No path under `bank-reconciliation/`, `close-calculations/`, `contracts/`, `ledger/`,
  `agents/`, `cmd/`, `mcp/`, `adapters/`, or `skills/` appears in the change set.
- No new skills (skills/ registry unchanged: 11 tracked files), no conformance delta, no
  MCP/CLI/mission change, no ledger writes (`validateLedger` untouched; ledger stays audit-only).
- Sibling compatibility: `drenyra-ecosystem-cleanup` regex edits intact — `grep RUC_RE|PERIOD_RE
  flow/close.ts` → zero matches; `flow/close.ts` imports `isValidPeriod` (line 18,
  `../candidates/types.js`) and `isValidRucChecksummed` (line 19, `../candidates/ruc.js`) with
  zero local regex definitions; `git diff candidates/types.ts` empty (export surface unchanged);
  `flow/__tests__/close.test.ts` passes unchanged.
- Reversibility mapping matches design: reconciliation → `requireApproval ? partially-reversible
  : reversible` (no draft → irreversible); close → depreciation `irreversible`, provision
  `partially-reversible`, isr `irreversible`, closing `reversible`.
- BigInt cents throughout: `amountCents` strings via `.toString()` of BigInt values, debit-side
  sum via `0n` reduce, no float literals, no `any` in `flow/close-wiring.ts`.

## Risks

- **Pre-existing flake (tracked, not this change):** `release-integrity.test.ts` SBOM fidelity
  test times out under full-suite concurrency; passes 13/13 in isolation. Same failure observed
  on the untouched baseline.
- UNBALANCED_ENTRY / UNCLASSIFIED_DIFFERENCE spec scenarios are engine-internal invariants;
  covered by the shared fail-closed catch path via reachable typed errors (documented deviation).
- Native review / commit / PR / merge lifecycle is parent-owned and has not run yet (the three
  deferred gates above).
