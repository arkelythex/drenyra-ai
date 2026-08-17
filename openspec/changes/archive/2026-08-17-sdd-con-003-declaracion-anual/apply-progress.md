# Apply Progress — SDD-CON-003 Annual Declaration Engine

## Status consumed (structured, openspec store — authoritative)

- `changeName`: `sdd-con-003-declaracion-anual`
- `artifactStore`: `openspec` (proposal/spec/design/tasks present on disk, all `done`)
- `applyProgress`: none prior to this run (created here)
- `applyState`: `ready` at start → implementation completed in this run
- `actionContext`: `mode: repo-local`, workspace `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai`; no edit-root warnings
- `nextRecommended` (produced): `parent-lifecycle` — parent owns chained PRs (feature-branch-chain: PR1 = W1–W3, PR2 = W4–W5) and post-apply bounded review; do NOT launch verify directly.

## Review Workload Gate (delivery resolution)

tasks.md guard: `Decision needed before apply: Yes`, `Chained PRs recommended: Yes`,
`400-line budget risk: High`. The parent prompt explicitly resolved delivery: implement the
complete `annual-declaration/` module in the working tree; NO commits/PRs (parent-owned).
PR boundary reported below. Strict TDD active (`bun run test` = vitest).

## Completed work units (implementation-owned)

Per parent instruction the persisted tasks.md checkboxes were left untouched (orchestrator
manages checkbox state); completion evidence lives here. All W1–W5 implementation tasks are
complete:

| Task (tasks.md) | Evidence |
| --- | --- |
| W1 slice start confirm | `annual-declaration/` did not exist; `close-calculations/` exports `closeResultAccounts`, `assertBalanced`, `assertChartAccount`, `RETAINED_EARNINGS_ACCOUNT`, `CloseLine`, `CloseEntry`, `ResultBalance`; package exports already listed `./close-calculations`; capability matrix listed `close-calculations: implemented`; no annual public name collides with the root barrel (grep scan + `tsc --noEmit` clean with the root star-export wired) |
| W1 error model + types | `annual-declaration/types.ts` — `AnnualScope`, `AnnualMonthInput`, `AnnualStatutoryAdjustments`, `AnnualNetIncomeInput`, `AnnualIsrPolicy` (defaults 2950/10000), `MonthlyIsrCedula`, `AnnualBalanceKind`, `AnnualSettlement`, `AnnualEntry = CloseEntry`, `AnnualDeclarationErrorCode` (7 codes), `AnnualDeclarationError` class, shared `assertAnnualScope` |
| W1 net income | `annual-declaration/net-income.ts` — `countClosedMonthlyPeriods` (pure count) + `determineAnnualNetIncome` (scope → cross-RUC → completeness → BigInt sum + additions − deductions) |
| W2 ISR | `annual-declaration/isr.ts` — `computeAnnualIsr` (default 2950 bp, max 10000 bp, `RATE_OUT_OF_BOUNDS`, `NEGATIVE_AMOUNT`, BigInt floor) |
| W2 settlement | `annual-declaration/settlement.ts` — `computeAnnualSettlement` (CROSS_RUC_ACCESS / INCOMPLETE_INPUT, Σ credit, balance, kind payable\|in-favor\|zero) |
| W2 barrel (partial surface) | folded into final barrel `annual-declaration/index.ts` (all W1–W4 public names) |
| W2 slice verification | module suite green (61 tests) + typecheck + build green (see Verification) |
| W3 close-results | `annual-declaration/close-results.ts` — thin composition: annual scope → `{ruc, period: year+"12"}` → `closeResultAccounts`; inherits UNBALANCED_ENTRY / ACCOUNT_NOT_IN_CHART / zero-skip |
| W3 declaration | `annual-declaration/declaration.ts` — `AnnualDeclarationPayload` + `buildAnnualDeclaration` (pure, stable ordering, deep-equal deterministic) |
| W3 report | `annual-declaration/report.ts` — `AnnualReport` + `buildAnnualReport` (shared `assertBalanced` per entry + aggregate identity, PCGE 59 movement, never emitted unbalanced) |
| W4 import-boundary test | `annual-declaration/__tests__/module-boundary.test.ts` — only `node:` builtins, self, or `close-calculations/`; no agents/cmd/ledger/mcp/adapters/bank-reconciliation; no third party |
| W4 wiring | tsconfig.json + tsconfig.build.json include `annual-declaration`; package.json exports `./annual-declaration`; root `index.ts` star-export (clash-checked); capability-matrix row `annual-declaration: implemented # SDD-CON-003`; `bun run build` emits `dist/annual-declaration/` |
| W5 full regression | `bun run test` 1450/1451 pass; single failure is a pre-existing load-sensitive timeout (evidence below); `bun run typecheck` clean; `bun run build` clean |
| W5 frozen-path diff | `git diff` over `contracts/**`, `close-calculations/**`, `bank-reconciliation/**` = EMPTY (composition only) |
| W5 runtime surface | module-boundary test PASS; only `node:` builtins + `../close-calculations/` imports in runtime sources |
| W5 spec→evidence map | R1 scope isolation ✓ (boundary tests); R2 net income ✓; R3 ISR ✓; R4 settlement ✓; R5 year-end close ✓; R6 declaration payload ✓; R7 report identity ✓; R8 frozen modules untouched ✓; R9 counting helper ✓ |
| W5 out-of-scope check | no `flow/`, `gates/`, mission/receipt wiring, SUNAT/CDR/DJ rendering, new PE skills, ledger writes, or `contracts/**` changes |

## Files created (new module)

```
annual-declaration/
  types.ts           — canonical types + AnnualDeclarationError + assertAnnualScope
  net-income.ts      — countClosedMonthlyPeriods, determineAnnualNetIncome
  isr.ts             — computeAnnualIsr (+ rate defaults)
  settlement.ts      — computeAnnualSettlement
  close-results.ts   — closeAnnualResults (composes closeResultAccounts)
  declaration.ts     — AnnualDeclarationPayload + buildAnnualDeclaration
  report.ts          — AnnualReport + buildAnnualReport
  index.ts           — public barrel
  __tests__/
    boundary.test.ts        — canonical types + INVALID_SCOPE / CROSS_RUC_ACCESS / INCOMPLETE_INPUT
    net-income.test.ts      — countClosedMonthlyPeriods + determineAnnualNetIncome (12_300_000n etc.)
    isr.test.ts             — computeAnnualIsr (2_950_000n, 983_333n, RATE_OUT_OF_BOUNDS, NEGATIVE_AMOUNT)
    settlement.test.ts      — computeAnnualSettlement (payable 500_000n, in-favor, zero, errors)
    close-results.test.ts   — closeAnnualResults (PCGE 59, December period, inherited invariants)
    declaration.test.ts     — buildAnnualDeclaration (payload shape + determinism)
    report.test.ts          — buildAnnualReport (identity check, PCGE 59 movement)
    index.test.ts           — barrel surface + full annual vertical end-to-end
    module-boundary.test.ts — import-surface scan
```

## Files modified (wiring, 1 line each)

- `tsconfig.json` / `tsconfig.build.json` — `"annual-declaration"` in `include`
- `package.json` — `"./annual-declaration": "./dist/annual-declaration/index.js"` in `exports`
- `index.ts` — `export * from "./annual-declaration/index.js";`
- `openspec/programs/drenyra-dominion/capability-matrix.yaml` — `annual-declaration: implemented # SDD-CON-003 …`

## Strict TDD evidence

| Phase | RED (test first, failed) | GREEN (implementation, passed) | Command |
| --- | --- | --- | --- |
| W1 types + net income | boundary.test.ts + net-income.test.ts — `Cannot find module '../types.js|../net-income.js|../settlement.js'` (2 files failed, 0 tests ran) | types.ts + net-income.ts — 2 files passed (net-income 9 tests); boundary still RED awaiting settlement | `bunx vitest run annual-declaration` |
| W2 ISR | isr.test.ts — module not found (3 files failed RED) | isr.ts — 4 files passed, 44 tests | `bunx vitest run annual-declaration` |
| W2 settlement | settlement.test.ts — module not found | settlement.ts — 44 tests green | `bunx vitest run annual-declaration` |
| W3 close-results / declaration / report | 3 test files — module not found (RED) | close-results.ts + declaration.ts + report.ts — 58 tests green after fixing a test-authoring bug (JSON.stringify on BigInt throws; replaced with structural `toEqual` deep-equality) | `bunx vitest run annual-declaration` |
| W4 barrel | index.test.ts — module not found (RED) | index.ts — 9 files, 61 tests green | `bunx vitest run annual-declaration` |
| W4 wiring | — | typecheck + build + full suite green (see Verification) | `bun run typecheck`, `bun run build`, `bun run test` |

During W1 GREEN the typechecker caught a constructor-argument-order bug
(`new AnnualDeclarationError(message, code)` instead of `(code, message)`); corrected before
any test run — no test asserted a wrong behavior.

## Verification

- `bunx vitest run annual-declaration` — **9 files / 61 tests PASS** (module suite).
- `bun run typecheck` (`tsc --noEmit`) — clean (no root-barrel name clashes with the annual star-export).
- `bun run build` — clean; emits `dist/annual-declaration/` (index + 7 modules, declarations, tests excluded).
- `bun run test` (full repo) — **1450 passed / 1 failed (1451 total)**.
  - The single failure is `scripts/__tests__/release-integrity.test.ts > resolved SBOM fidelity > fails verification on every SBOM fidelity drift class` — a **5000ms test timeout under full parallel load**.
  - Pre-existing flake evidence: (a) passes in isolation (13/13); (b) reproduces identically with annual-declaration tests excluded from the full run (1389/1390 pass — i.e., at exactly the pre-change suite size of 1390 tests), so the annual module is not the trigger; (c) it builds its own fixture and never reads the changed files. **Zero new failures; zero broken pre-existing tests.**
  - Delta vs pre-change: +61 tests, all passing.

## Deviations from design (documented, fail-closed rationale)

1. `closeAnnualResults(scope, balances, chart)` takes `readonly ResultBalance[]` (the real
   `closeResultAccounts` parameter type) instead of the design sketch's `CloseLine[]`; the
   composed primitive's contract is authoritative — composition, not a fork.
2. `buildAnnualDeclaration` input gains `netIncome: AnnualNetIncomeInput`: the design's own
   payload type requires `cédulas.netIncome`, which is unproducible from the sketch's input
   set. Minimal necessary extension; payload shape unchanged.
3. `AnnualDeclarationPayload` / `AnnualReport` are defined in `declaration.ts` / `report.ts`
   (per the design's per-module sections), not in `types.ts` — the barrel re-exports them.
4. `computeAnnualSettlement` validates the annual scope (`INVALID_SCOPE`) before computing,
   per spec R1 ("every annual engine operation … MUST be scoped") — the design error table
   only named net-income/close-results, but R1 is normative.
5. `in-favor` settlements report `balanceCents = annualIsr − credit` as a negative BigInt
   (e.g. `−200_000n`) with `balanceKind: "in-favor"`, per the canonical type comment
   ("may be negative => in-favor"); the spec narrative's "200_000n" is the magnitude.
6. `isr.ts` additionally rejects non-integer rates with `RATE_OUT_OF_BOUNDS`
   (mirrors `close-calculations` `assertRateInBounds`; fail-closed).
7. `assertAnnualScope` (shared helper) is exported through the barrel via `export *` — an
   extra public name beyond the design's clash list; verified unique across the root barrel.

## Workload / PR boundary

- PR1 (W1–W3): types, net-income, isr, settlement + boundary/close-results/declaration/report
  core tests — deterministic calculation core.
- PR2 (W4–W5): barrel, module-boundary test, wiring (tsconfig ×2, package.json, root index.ts,
  capability matrix), full regression.
- Chain strategy: `feature-branch-chain` (parent-owned; no commits/PRs created by this phase).
- Estimated authored lines: ~700 (8 source modules + 9 test suites + wiring); parent should
  split per the tasks.md forecast when cutting the two PRs.

## Remaining tasks (parent-owned, deferred lifecycle actions)

- Ship the work units as two chained PRs (feature-branch-chain) and validate each candidate
  per native review contract before merge.
- Run post-apply bounded review of each PR candidate and validate the terminal receipt.
- Validate the integrated change (full suite green, no frozen-contract delta), then merge.
- Flip the tasks.md checkboxes for the completed W1–W5 implementation tasks (per parent's
  explicit instruction that the orchestrator manages checkbox state).

## Risks

- Pre-existing flaky test `scripts/__tests__/release-integrity.test.ts` (5s timeout under
  full parallel load) — unrelated to this change; monitor at verify/release gates.
- The change is one working-tree unit awaiting the parent's two-PR split; the aggregate
  exceeds the 300-line review budget, so the PR split must be honored.
