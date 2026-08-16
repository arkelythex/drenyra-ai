# Apply Progress — Close Vertical Wiring

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
  applyProgress: openspec/changes/close-vertical-wiring/apply-progress.md (created by this phase)
taskProgress: total 23, complete 0 at start -> 20 implementation complete, 3 parent-owned deferred
applyState: ready (at start; not all_done because parent-owned gates remain open)
dependencies: apply ready, verify blocked (post-apply, parent-owned)
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai
  allowedEditRoots: [/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai]
  warnings: []
nextRecommended: apply
isNonAuthoritative: false
```

## Review Workload Gate (resolved)

tasks.md records: `Decision needed before apply: No`, `Chained PRs recommended: No`
(user decision: single-pr with recorded size exception), `Chain strategy: n/a`,
`400-line budget risk: High`. The size exception is recorded in the authoritative
task artifact (`openspec/config.yaml` sets `review_budget_lines: 300`; the change
exceeds that aggregate and the exception is recorded as a user decision).
Delivery path: **single PR**, two work-unit commits W1 → W2.

## Start state confirmation (W1 task 1 & 2)

- `flow/close-wiring.ts`, `flow/__tests__/close-wiring.test.ts`,
  `flow/__tests__/close-integration.test.ts` did NOT exist.
- `flow/close.ts` had NO `bankRows?`/`ledgerRows?`/`closeInputs?` and no
  `close-wiring` import.
- Sibling `drenyra-ecosystem-cleanup` regex edits already landed: `flow/close.ts`
  imports `isValidRucChecksummed` (../candidates/ruc.js) and `isValidPeriod`
  (../candidates/types.js); `grep -rn "RUC_RE\|PERIOD_RE" flow/close.ts` → zero.
- Engines unmodified at start and at end (`git status` shows only the W1/W2 files
  plus the openspec change directory).
- Baseline suite at start: 1333 tests / 97 files; 1 order-dependent flake
  (`scripts/__tests__/release-integrity.test.ts` SBOM fidelity, passes in
  isolation 13/13). At end: full suite green twice (1363 tests / 99 files)
  including that file — no relation to this change.

## Work performed

### W1 — converters (flow/close-wiring.ts + flow/**tests**/close-wiring.test.ts)

RED: wrote all converter tests first; module import failed (`Cannot find module
'../close-wiring.js'`). GREEN: implemented both converters in one module (an ESM
import binding fails when either named export is missing, so the two converter
RED/GREEN cycles land in the same module file; each behavior was specified in a
failing test before its implementation). 21 wiring tests green.

`reconciliationToProposals(scope, bankRows, ledgerRows, opts?)`:
normalizeBankRows/normalizeLedgerRows (rejected rows → typed-code risks;
accepted rows proceed) → reconcile → buildAdjustments(differences, opts) →
one proposal per draft in draft order. Label `adjustment:{draftId}`; explanation
= draft justification; subject JSON with kind/draftId/reference/source/side/
requireApproval; amountCents = draft.amountCents.toString() (lossless);
reversibility = requireApproval ? "partially-reversible" : "reversible".

`closeEntriesToProposals(scope, closeInputs)` + exported `CloseEngineInputs`:
computeDepreciation / computeProvisions / computeProvisionalIsr (entry only;
cédula never a proposal) / closeResultAccounts; one proposal per balanced entry
in engine order. Label `close:{kind}:{id}`; explanation = id + line summaries;
subject JSON with entryId/closeKind/lines; amountCents = balanced magnitude
(debit-side total); reversibility per kind
(depreciation→irreversible, provision→partially-reversible, isr→irreversible,
closing→reversible).

Fail-closed: every engine throw (BankReconciliationError/CloseError) surfaces as
a risk preserving the typed code; no proposal is fabricated from failed output;
rejected rows never silently vanish.

### W2 — vertical integration (flow/close.ts + flow/**tests**/close-integration.test.ts)

RED: integration tests failed with `'bankRows' does not exist in type
'Partial<MonthlyCloseInput>'`. GREEN: extended `MonthlyCloseInput` with optional
`bankRows?`, `ledgerRows?`, `closeInputs?`; `runMonthlyClose` assembles
`allProposals = [...(input.proposals ?? []), ...generated]` (external first,
generated second, nothing dropped) and appends wiring risks to the local `risks`
array BEFORE the candidate loop. The candidate/guardian/receipt/ledger loop is
unchanged except iterating `allProposals`. 9 integration tests green (plus the 5
pre-existing close tests unchanged).

## Files changed

| Path | Kind | Purpose |
| --- | --- | --- |
| `flow/close-wiring.ts` | new | Deterministic converters (both) + `CloseEngineInputs` |
| `flow/close.ts` | modified | `MonthlyCloseInput` engine inputs + proposal assembly |
| `flow/__tests__/close-wiring.test.ts` | new | Converter unit tests (21) |
| `flow/__tests__/close-integration.test.ts` | new | Vertical integration tests (9) |
| `openspec/changes/close-vertical-wiring/apply-progress.md` | new | This progress report |
| `openspec/changes/close-vertical-wiring/tasks.md` | modified | Checkboxes 1–20 marked `[x]` |

## TDD Cycle Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED (converters) | `bun run test flow/__tests__/close-wiring.test.ts` | FAIL — module not found, no tests run |
| GREEN (converters) | `bun run test flow/__tests__/close-wiring.test.ts` | 21 passed (after fixing one test assertion to the engine's normalized reference `dep-001`, since the engine case-folds references) |
| RED (integration) | `bun run test flow/__tests__/close-integration.test.ts flow/__tests__/close.test.ts` | FAIL — `bankRows` does not exist on `Partial<MonthlyCloseInput>` |
| GREEN (integration) | `bun run test flow/__tests__/close-integration.test.ts flow/__tests__/close.test.ts` | 14 passed (9 new + 5 unchanged) |
| W1 slice verify | `bun run test` + `bun run typecheck` + `bun run build` | green |
| Full regression | `bun run test` | 1363 passed / 99 files (twice) |
| Full regression | `bun run typecheck` | clean |
| Full regression | `bun run build` | done |

## Deviations from design (documented, spec-normative)

1. **Close-entry `amountCents` = balanced magnitude (debit-side total), not the
   literal `reduce` over all lines.** The design/tasks snippet
   `entry.lines.reduce((sum, l) => sum + l.amountCents, 0n)` double-counts
   (debit + credit = 2× per-side total). The spec R2 scenario is normative: a
   depreciation entry with `1_200_000n` debit and `1_200_000n` credit carries
   `amountCents` "1200000" — the balanced magnitude. Implemented as
   `sum of debit-side lines` (balanced entry ⇒ equals credit side); the design
   text itself says "either side's total".
2. **Close-entry subject serializes `lines` with `amountCents` as strings.**
   `JSON.stringify` throws on BigInt, so the design's literal `lines: entry.lines`
   would crash. Lines are mapped to `{ accountCode, side, amountCents: string }`,
   keeping the subject deterministic and serializable.
3. **UNBALANCED_ENTRY and UNCLASSIFIED_DIFFERENCE are engine-internal
   invariants not reachable through the engines' public API** (every engine
   producer runs `assertBalanced` before emitting; the `Difference` union is
   sealed and fully handled by `buildAdjustments`). They cannot be triggered by
   any public input without monkey-patching (forbidden by design). The fail-closed
   mechanism that would surface them — `catch (error)` → typed-code risk, zero
   proposals from the failed call — is exercised by the reachable typed errors
   (`ACCOUNT_NOT_IN_CHART`, `UNCLASSIFIABLE_INPUT`, `INVALID_SCOPE`,
   `FRACTIONAL_CENTS`, `CROSS_RUC_ACCESS`, `NORMALIZATION_REJECTED`), which share
   the exact same code path. An invalid scope test also asserts the "engine call
   throws ⇒ no proposals" branch for the reconciliation path.

## Spec requirement mapping (R1–R7)

| Requirement | Evidence |
| --- | --- |
| R1 — reconciliation converter, one proposal per adjustment draft | `close-wiring.test.ts`: "produces exactly one proposal per classified adjustment draft", "yields zero proposals when every movement is matched", "is deterministic", "maps requireApproval=false …" |
| R2 — close converter, one proposal per balanced close entry | `close-wiring.test.ts`: "produces exactly one proposal per balanced close entry", "maps a depreciation entry's label, explanation, and balanced amount", "derives reversibility deterministically per entry kind", "derives exactly one proposal from the ISR entry and never from the cédula" |
| R3 — fail-closed conversion (typed risks, no fabrication/silent skip) | `close-wiring.test.ts`: FRACTIONAL_CENTS / NORMALIZATION_REJECTED / CROSS_RUC_ACCESS / ACCOUNT_NOT_IN_CHART / UNCLASSIFIABLE_INPUT / INVALID_SCOPE risk cases, "never fabricates a proposal when an engine call fails"; `close-integration.test.ts`: "surfaces a wiring engine error as a risk in ClosePackage.risks", "surfaces an unclassifiable close input as a risk" |
| R4 — vertical integration (internal proposal generation, optional engine inputs) | `flow/close.ts` (`MonthlyCloseInput.bankRows/ledgerRows/closeInputs`; `allProposals` merge) + `close-integration.test.ts`: "generates candidates from engine inputs end-to-end", "merges external proposals first…dropping nothing", "honors external proposals when engine inputs are absent", "produces zero candidates when neither source is supplied" |
| R5 — pipeline unchanged (candidate/guardian/receipt/ledger, no new gates/receipt types) | `close-integration.test.ts`: "produces exactly one candidate per generated proposal with the close scope and derived materiality", "blocks receipting for an irreversible generated candidate via the guardian", "produces identical outcomes for identical external and generated proposals"; unchanged `flow/close.ts` loop (only the iterable changed) |
| R6 — scope isolation (one RUC + one period; cross-RUC / invalid scope rejected) | `close-wiring.test.ts`: "rejects a cross-RUC row fail-closed with CROSS_RUC_ACCESS", "surfaces INVALID_SCOPE and produces no proposals for a malformed scope" (both converters); every integration candidate scope asserted equal to the close's `{ ruc, period }` |
| R7 — no engine or contract drift (diff boundary, public-exports-only imports) | `git status` shows only `flow/close.ts` modified + the three new files + openspec dir; no path under `bank-reconciliation/`, `close-calculations/`, `contracts/`, `ledger/`, `agents/`, `cmd/`, `mcp/`, `adapters/`, skills, missions; `flow/close-wiring.ts` imports only public engine exports + `flow/close.ts` types + `candidates/types.js` (`Reversibility`) |

## Out-of-scope surface confirmation

- No change to `bank-reconciliation/`, `close-calculations/`, `contracts/**`,
  `ledger/`, `agents/`, `cmd/`, `mcp/`, `adapters/`, skills, missions, CLI.
- No new skills, no conformance delta.
- No ledger writes: `validateLedger` unchanged; the ledger stays audit-only.
- Sibling `drenyra-ecosystem-cleanup` regex edits intact (zero
  `RUC_RE`/`PERIOD_RE`; `flow/__tests__/close.test.ts` passes unchanged;
  `git diff candidates/types.ts` empty).

## Remaining tasks (parent-owned, deferred — NOT implementation-owned)

```text
- [ ] Ship the two work units (W1 → W2) as sequential commits within the single user-approved PR (size exception recorded); validate each commit's candidate per native review contract before merge. <!-- sdd-owner: parent -->
- [ ] Run post-apply bounded review of the single PR candidate per native review contract and validate the terminal receipt before merge. <!-- sdd-owner: parent -->
- [ ] Validate the integrated change: full suite green (`bun run test`, `bun run typecheck`, `bun run build`), no frozen contract or conformance delta, sibling `drenyra-ecosystem-cleanup` regex edits intact, then merge to main. <!-- sdd-owner: parent -->
```

## Workload / PR boundary

~30 new tests + ~460 authored lines across the four files (≈230 converter +
tests, ≈230 integration + close.ts). Aggregate exceeds the 300-line
`review_budget_lines` config; the size exception is recorded in tasks.md as a
user decision. PR boundary: single PR with two sequential work-unit commits
(W1 converters, W2 vertical integration), per `work-unit-commits` skill.
Commit messages (suggested, parent-owned to execute):

- `feat(flow): bind bank-reconciliation and close-calculations engines into close proposals (close-vertical-wiring W1)`
- `feat(flow): generate monthly-close candidates from engine inputs in runMonthlyClose (close-vertical-wiring W2)`

Rollback boundary: remove `flow/close-wiring.ts` + the two test files and revert
`flow/close.ts` (or the W2 commit alone); no engine or contract file is touched,
so rollback cannot disturb the engines or frozen contracts.

## Risks

- The release-integrity SBOM test is order-dependent (pre-existing; passed green
  in both final full-suite runs; unrelated to flow/).
- UNBALANCED_ENTRY / UNCLASSIFIED_DIFFERENCE typed-code paths are covered by the
  shared catch mechanism with reachable errors only (see deviations).
- Native review / commit / PR lifecycle is parent-owned and has not run yet.
