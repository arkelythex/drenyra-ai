```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:be9dbf3c87c7aa4a7dbfbdd63df664cb951f0ccfcc3748f8ce31cf01aeeb4e72
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 24/24
test_command: bun run test
test_exit_code: 0
test_output_hash: sha256:80047e32a8b952a9b11deac462468142636a996d4fcd46de1334f7168c02de7d
build_command: bun run typecheck
build_exit_code: 0
build_output_hash: sha256:1383d3b3e514b0940d50f6b0e77596f839420a9680372de8c536ec57c0ce6e98
```

# Verification Report — SDD-CON-003 Declaración Anual

- **Change**: `sdd-con-003-declaracion-anual`
- **Artifact store**: `openspec` (all planning artifacts on disk, `all_done`)
- **Verifier**: `sdd-verify` executor (fresh context, read against real code, not apply-progress)
- **Date**: verification run at execution time
- **Skill loaded**: `fiscal-compliance` (paths-injected) — money as BigInt cents, no floats, fail-closed, RUC scope respected

## Status consumed (native, authoritative)

Native dispatcher (`gentle-ai sdd-status --json --instructions`):

- `changeName`: `sdd-con-003-declaracion-anual`, `artifactStore`: `openspec`
- `actionContext`: `mode: repo-local`, workspace `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai`, `allowedEditRoots` present (no edit-root warning)
- `dependencies`: proposal/specs/design/tasks `all_done`, apply `ready`, verify `blocked`, archive `blocked`
- `blockedReasons`: `[]`
- `nextRecommended` (native): `"apply"` — mechanical artifact of the three unchecked **parent-owned** lifecycle-gate checkboxes in `tasks.md` (see Task Checkbox Verification); the implementation itself is complete.

## Execution summary

| Command | Result |
| --- | --- |
| `bun run test annual-declaration` | **9 files / 61 tests PASS** (exactly the forecast 61/61) |
| `bun run test` (full repo) | **110 files / 1471 tests PASS** (zero failures; previously-flaky `release-integrity` passed this run) |
| `bun run typecheck` (`tsc --noEmit`) | Clean (exit 0) — no root-barrel name clash from the annual star-export |
| `bun run build` (`node scripts/build.mjs`) | Clean (exit 0); emits `dist/annual-declaration/` (index + 7 modules + `.d.ts`, tests excluded) |
| `git diff --exit-code -- contracts close-calculations bank-reconciliation` | Exit 0 — **empty diff** (frozen paths byte-identical) |

## Requirement-by-requirement verification (PASS/FAIL with evidence)

### R1 — Annual scope isolation (one RUC, one fiscal year) — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Valid scope accepted | `__tests__/boundary.test.ts` "models an annual scope…"; full vertical with valid scope in `__tests__/index.test.ts` "chains the full annual vertical…" | PASS |
| Malformed RUC → `INVALID_SCOPE` | `boundary.test.ts` "rejects a malformed RUC with INVALID_SCOPE"; `close-results.test.ts` "rejects a malformed annual scope with INVALID_SCOPE" | PASS |
| Non-`YYYY` year → `INVALID_SCOPE` | `boundary.test.ts` "rejects a non-YYYY fiscal year with INVALID_SCOPE"; `settlement.test.ts` "rejects a malformed scope with INVALID_SCOPE" | PASS |
| Cross-RUC input → `CROSS_RUC_ACCESS` | `boundary.test.ts` "rejects a monthly input from another RUC…" and "rejects a cross-RUC settlement cédula…"; `net-income.test.ts` "rejects a month outside the year…" | PASS |
| No cross-RUC observability | Fail-closed throw before any sum/credit is computed (`net-income.ts` validates scope + per-month RUC/year before summing; `settlement.ts` same) | PASS |

### R2 — Annual net income determination — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| 12 closed months `12_000_000n` + `500_000n` − `200_000n` = `12_300_000n`, no rounding | `__tests__/net-income.test.ts` "sums the twelve closed months plus additions minus deductions, no rounding" (`expect(netIncome).toBe(12_300_000n)`) | PASS |
| Eleven closed months → `INCOMPLETE_INPUT` | `net-income.test.ts` "rejects eleven closed months…"; `boundary.test.ts` "rejects an incomplete monthly set…" | PASS |
| Unclosed month → `INCOMPLETE_INPUT` | `net-income.test.ts` "rejects an unclosed month…"; `boundary.test.ts` "rejects an unclosed monthly period…" | PASS |
| Duplicate months / out-of-order → fail-closed (TRIANGULATE) | `net-income.test.ts` "rejects a duplicate-month set…" + "accepts months in any order when the twelve periods are present" | PASS |

### R3 — Annual ISR liability (configurable statutory rate) — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Default 2950 bp on `10_000_000n` → `2_950_000n` | `__tests__/isr.test.ts` "applies the default statutory rate (2950 bp)…" | PASS |
| Configured 2950 bp on `3_333_333n` → `983_333n` (BigInt floor) | `isr.test.ts` "applies the configured statutory rate with deterministic BigInt floor" (`toBe(983_333n)`) | PASS |
| `15000` bp → `RATE_OUT_OF_BOUNDS` | `isr.test.ts` "rejects a rate above the default legal envelope…" (`statutoryRateBp: 15000`) | PASS |
| Negative base `−500_000n` → `NEGATIVE_AMOUNT` | `isr.test.ts` "rejects a negative taxable base…" | PASS |
| Envelope boundaries (TRIANGULATE) | `isr.test.ts`: at-max accepted (15000 with max 15000; 10000 default), just above rejected (10001), non-positive rejected (0), fractional rate rejected (2950.5), `0n` base → `0n` | PASS |

### R4 — Annual settlement against cumulative provisional payments — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Payable: `2_500_000n` vs `2_000_000n` → `payable` `500_000n` + full breakdown | `__tests__/settlement.test.ts` "reports a payable balance…" (`toEqual` full cédula: annualIsr 2_500_000n, credit 2_000_000n, balance 500_000n, kind payable) | PASS |
| In favor: `2_500_000n` vs `2_700_000n` → `in-favor` `200_000n` (magnitude) | `settlement.test.ts` "reports a balance in favor…" (`balanceKind "in-favor"`, `balanceCents -200_000n`, credit 2_700_000n — negative sign per documented deviation #5; spec narrative "200_000n" is the magnitude) | PASS |
| Zero: `2_500_000n` vs `2_500_000n` → `zero` `0n` | `settlement.test.ts` "reports a zero balance…" | PASS |
| Fewer than twelve cédulas → `INCOMPLETE_INPUT` | `settlement.test.ts` "rejects fewer than twelve cédulas…"; `boundary.test.ts` same | PASS |
| Cross-RUC / out-of-year cédula → `CROSS_RUC_ACCESS` | `settlement.test.ts` both cases; `boundary.test.ts` cross-RUC | PASS |
| Duplicate / missing month (TRIANGULATE) | `settlement.test.ts` "rejects a duplicated-month cédula set…" and "rejects a missing-month cédula set (2025-13)…" | PASS |

### R5 — Year-end closing of result accounts to retained earnings — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Accounts `70` (credit `500_000n`) + `60` (debit `200_000n`) close into PCGE `59`, balanced, positive BigInt cents, December period | `__tests__/close-results.test.ts` "closes result accounts into retained earnings balanced, in December" (exact `lines` `toEqual`, scope `202512`, per-entry `assertBalanced` + `amountCents > 0n`) | PASS |
| Unbalanced draft → `UNBALANCED_ENTRY`, never auto-corrected | `close-results.test.ts` "inherits the unbalanced-entry invariant (never auto-corrected)" (`assertBalanced` on a 500/400 draft → `UNBALANCED_ENTRY`) | PASS |
| Account absent from chart → `ACCOUNT_NOT_IN_CHART` | `close-results.test.ts` "rejects an account absent from the chart…" | PASS |
| Zero-balance account skipped (TRIANGULATE) | `close-results.test.ts` "skips zero-balance result accounts" | PASS |
| Extra safety: PCGE 59 as result source → `UNCLASSIFIABLE_INPUT` (inherited) | `close-results.test.ts` "rejects retained earnings as a result source account" | PASS (superset) |

### R6 — Structured annual declaration payload — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Payload contains RUC, fiscal year, net income, taxable base, ISR, credit, balance amount + kind, and supporting cédulas (net income, ISR with rateBp, settlement) | `__tests__/declaration.test.ts` "compiles the full settlement with every field and supporting cédula" (all fields + `cédulas.netIncome` / `cédulas.isr` / `cédulas.settlement` asserted) | PASS |
| Identical inputs → deep-equal (deterministic) | `declaration.test.ts` "is deterministic: identical inputs yield deep-equal payloads" | PASS |
| Pure data, no I/O, no network, no CDR | `declaration.test.ts` "emits pure data with no external side effect" + `declaration.ts` is a synchronous pure assembly (no I/O imports) | PASS |

### R7 — Annual settlement report with balance identity — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Report states entries, `trialBalanceBalanced === true`, settlement cédula, PCGE 59 movement before/after | `__tests__/report.test.ts` "reports balanced entries with the settlement cédula and the PCGE 59 movement" (`afterCents 300_000n` from 0n) and "derives the after-balance from a non-zero opening balance" (1_000_000n → 1_500_000n) | PASS |
| `afterCents = beforeCents + netClosingMovement` across debit+credit 59 lines | `report.test.ts` "computes the net PCGE 59 movement across debit and credit lines" | PASS |
| Unbalanced state → `UNBALANCED_ENTRY`, never emitted | `report.test.ts` "rejects an unbalanced state…" (per-entry) and "rejects a state that aggregates unbalanced across entries" (cross-entry identity) | PASS |

### R8 — Composition without modification of frozen modules — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Frozen paths byte-identical | `git diff --exit-code -- contracts close-calculations bank-reconciliation` → exit 0, empty diff; `git status` shows none of those paths modified | PASS |
| Runtime surface node:crypto-only (no third-party) | Source scan: runtime files import only `./types.js` and `../close-calculations/index.js`; `__tests__/module-boundary.test.ts` enforces `node:` builtins / self / `../close-calculations/` only, rejecting `agents/`, `cmd/`, `ledger/`, `mcp/`, `adapters/`, `bank-reconciliation/`, and any third-party specifier | PASS |
| Composition by import only | `close-results.ts` delegates to `closeResultAccounts`; `report.ts` reuses shared `assertBalanced` + `RETAINED_EARNINGS_ACCOUNT`; `types.ts` aliases `AnnualEntry = CloseEntry` — no reimplementation of the invariants | PASS |

### R9 — Closed-month counting helper — **PASS**

| Spec point | Test evidence | Result |
| --- | --- | --- |
| Counts only closed periods (12 of 13, ignoring one unclosed), computes no amount | `__tests__/net-income.test.ts` "counts only closed monthly periods and ignores unclosed ones" (`toBe(12)`) + "is a pure count and computes no amount" + "returns zero when no period is closed" | PASS |

### Wiring (tasks W4) — **PASS**

| Check | Evidence |
| --- | --- |
| `tsconfig.json` includes `annual-declaration` | line 53 |
| `tsconfig.build.json` includes `annual-declaration` | line 40 |
| `package.json` exports `./annual-declaration` → `./dist/annual-declaration/index.js` | line 22 |
| Root `index.ts` star-exports the module | line 37 (`export * from "./annual-declaration/index.js";`), typecheck-clean (no barrel clash) |
| Capability matrix row | `openspec/programs/drenyra-dominion/capability-matrix.yaml` line 60: `annual-declaration: implemented # SDD-CON-003 — annual-declaration/ (net-income/isr/settlement/close-results/declaration/report)` |
| Build emits `dist/annual-declaration/` | confirmed (index + 7 modules + declarations) |

## Strict TDD compliance

`strict_tdd: true` in `openspec/config.yaml`; project-local support file absent, global `~/.pi/agent/gentle-ai/support/strict-tdd-verify.md` loaded.

| Check | Result | Details |
| --- | --- | --- |
| TDD Cycle Evidence reported | ✅ | `apply-progress.md` "Strict TDD evidence" table (W1–W4 RED/GREEN rows + commands) |
| RED confirmed (test files exist) | ✅ 9/9 | All 9 files in `annual-declaration/__tests__/` exist and were created by this change |
| GREEN confirmed (tests pass now) | ✅ | 61/61 module; 1471/1471 full suite on execution |
| Triangulation adequate | ✅ | Distinct-value triangulation across R2/R3/R4/R7 (see tables above); every spec scenario mapped to ≥1 test |
| Safety Net for modified files | ✅ | All module files are **new** (`?? annual-declaration/` untracked); "N/A (new)" is correct |
| REFACTOR | — | Not verifiable; trusted per module guidance |

**Test layer distribution**: Unit — 61 tests / 9 files (pure-function tests; no render, no HTTP, no E2E). Integration/E2E not applicable (library module; no tools installed).

**Coverage**: skipped — `coverage.available: false` in `openspec/config.yaml` (informational, not a failure).

**Quality metrics**: Linter — not configured (`quality.linter: none`). Type checker — ✅ clean (exit 0). Build — ✅ clean.

### Assertion quality audit

113 `expect()` calls across 9 files; 0 mocks (`vi.mock` count 0). No banned patterns found:

- No tautologies (`expect(true).toBe(true)` etc.).
- No ghost loops: the only assertion loop (`close-results.test.ts`, per-entry `assertBalanced`/`amountCents > 0n`) is preceded by `expect(entries).toHaveLength(2)` — guaranteed non-empty.
- No type-only-standalone assertions: the single `toBeDefined()` (`declaration.test.ts`) is combined with value assertions in the same test.
- No smoke-only behavior tests: the only `typeof` surface checks are the barrel contract test in `index.test.ts`, paired in the same file with a full end-to-end vertical asserting exact values (`12_300_000n`, `3_628_500n`, `1_228_500n`, `300_000n`).
- No implementation-detail (CSS/class/mock-call-count) assertions.
- Mock/assertion ratio: 0 mocks / 113 assertions — excellent.

**Assertion quality**: ✅ All assertions verify real behavior (0 CRITICAL, 0 WARNING).

## Review workload / PR boundary

- Forecast in `tasks.md`: `Chained PRs recommended: Yes`, `Chain strategy: feature-branch-chain`, `400-line budget risk: High`.
- apply-progress reports the parent resolved delivery: implement the complete module in the working tree, **no commits/PRs created** (parent-owned). Boundary respected: no commits, no PRs, no scope creep beyond `annual-declaration/` + the four 1-line wiring edits + capability-matrix row.
- Verified no out-of-scope surface: no FSD `declaracion` mission/gate/receipt wiring, no SUNAT/CDR/DJ submission, no `flow/` orchestration, no ledger writes, no new PE skills, no `contracts/**` changes.
- Estimated authored lines ~700 exceed the 300-line budget as one unit; the parent must honor the two-PR split (PR1 = W1–W3, PR2 = W4–W5) when cutting candidates.

## Task checkbox verification

All W1–W5 implementation tasks in `tasks.md` are checked `[x]` (types, net-income, isr, settlement, close-results, declaration, report, barrel, module-boundary, wiring, capability matrix, slice + final integration verification). **No unchecked implementation tasks remain.**

Remaining unchecked lines are the three **parent-owned lifecycle gates** (`<!-- sdd-owner: parent -->`), not implementation tasks:

```text
- [ ] Ship the work units as two chained PRs under feature-branch-chain strategy: PR1 (W1–W3, calculation core) then PR2 (W4–W5, composition + report + barrel + wiring); validate each PR candidate per native review contract before merge.
- [ ] Run post-apply bounded review of each PR candidate per native review contract and validate the terminal receipt before merge.
- [ ] Validate the integrated change: full suite green, no frozen-contract delta, then merge to main.
```

These gate **archive**, not implementation completeness. Native `nextRecommended: "apply"` / `verify: blocked` is the mechanical consequence of these unchecked parent boxes.

## Risks / observations

1. **Unrelated in-progress change in the working tree**: `mcp-bank-reconcile-tool` (modified `cmd/commands/mcp-serve.ts`, `mcp/index.ts`, `mcp/tools.ts`, untracked `mcp/__tests__/reconcile.test.ts`, `openspec/changes/mcp-bank-reconcile-tool/`, plus the `bank-reconciliation` comment line in the capability matrix). Verified disjoint from this change (`mcp/index.ts` diff has zero annual-declaration references; frozen paths untouched). **Must not be bundled into this change's PRs.**
2. **Full-suite count delta vs apply-progress**: apply-progress recorded 1450/1451 (1 pre-existing `release-integrity` timeout flake); this run: **1471/1471 PASS** — the flaky test passed, and the +20 tests are from the unrelated mcp change. Zero new failures; zero broken pre-existing tests; annual module adds exactly +61 tests, all passing.
3. **Documented deviations from design** (apply-progress #1–#7): all verified in code and consistent with the normative spec — (a) `closeAnnualResults` takes `readonly ResultBalance[]` (composed primitive's real contract), (b) `AnnualDeclarationInput.netIncome` needed to produce the spec-required `cédulas.netIncome`, (c) payload/report types live in their modules and are re-exported, (d) `computeAnnualSettlement` validates scope (`INVALID_SCOPE`) per R1, (e) `in-favor` balance is negative BigInt with kind `in-favor` (spec magnitude `200_000n`), (f) fractional rates rejected `RATE_OUT_OF_BOUNDS` (fail-closed superset), (g) `assertAnnualScope` exported (unique name, typecheck-clean). None violate a requirement; all are fail-closed.
4. No floats anywhere in the module: all monetary values are BigInt cents; `rateBp` is an integer policy input (bp), never a monetary amount — compliant with the fiscal-compliance skill and repo convention.
5. Archive readiness: implementation is complete and verified; archive must wait for the parent-owned PR shipping, native review per candidate, and merge (lifecycle gates above).

## Final verdict

**APPROVED**

- All 9 spec requirements (R1–R9) **PASS** against the real code with exact spec values (`12_300_000n`, `2_950_000n`, `983_333n`, payable `500_000n`, in-favor `200_000n` magnitude, zero `0n`, `RATE_OUT_OF_BOUNDS` @ 15000 bp, `INCOMPLETE_INPUT` @ 11 months, `CROSS_RUC_ACCESS`).
- Module suite `bun run test annual-declaration` → **61/61 PASS**; full regression 1471/1471; typecheck and build clean.
- Frozen paths byte-identical; runtime surface node-crypto/intra-repo-only; wiring complete (tsconfig ×2, exports, root barrel, capability matrix, dist emission).
- Strict TDD evidence complete; assertion quality clean.
- Archive is **not yet ready**: the three parent-owned lifecycle gates (chained PRs, native review + terminal receipt, merge) remain open and gate close-out.
