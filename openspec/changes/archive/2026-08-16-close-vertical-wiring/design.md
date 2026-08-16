# Design — Close Vertical Wiring

## Decision summary

A thin, deterministic translation layer `flow/close-wiring.ts` that binds the two
verified engines into the monthly-close vertical `flow/close.ts`. Two pure
converters turn engine output into `ReconciliationProposal[]` (the vertical's
existing candidate-input shape): `reconciliationToProposals(scope, bankRows,
ledgerRows, opts?)` and `closeEntriesToProposals(scope, closeInputs)`. The
vertical gains optional engine inputs; when present it generates its candidates
internally instead of depending on external synthetic proposals. External
`proposals` stay supported (backward compatible). No engine is modified, no
contract changes, no authority-model change — the existing
candidate/guardian/receipt/ledger pipeline runs unchanged on the generated
candidates.

## Module layout

```text
flow/
  close.ts           monthly-close orchestrator (existing; extended inputs)
  close-wiring.ts    NEW — deterministic converters (this slice)
  __tests__/
    close-wiring.test.ts        NEW — unit tests for the converters
    close-integration.test.ts   NEW — end-to-end vertical test
```

Layer: `flow/` is the deterministic vertical layer (SDD-050). `close-wiring.ts`
imports only the two engines (`bank-reconciliation/`, `close-calculations/`),
`flow/close.ts` types (`ReconciliationProposal`, `CloseScope`), and
`candidates/types.js` (`Reversibility`). It imports nothing from `agents/`,
`cmd/`, `ledger/`, `mcp/`, `adapters/`. `close.ts` imports `close-wiring.js`.

## Converter 1 — reconciliationToProposals

```ts
function reconciliationToProposals(
  scope: CloseScope,
  bankRows: readonly BankRow[],
  ledgerRows: readonly LedgerRow[],
  opts?: ReconcileOptions & AdjustOptions,
): { proposals: ReconciliationProposal[]; risks: string[] }
```

Pipeline (all deterministic, BigInt cents, one RUC + one period):

1. `normalizeBankRows(scope, bankRows)` and `normalizeLedgerRows(scope,
   ledgerRows)` — rejected rows surface as risks (fail-closed, never skipped).
2. `reconcile(scope, bank, ledger, opts)` — every movement classified.
3. `buildAdjustments(differences, opts)` — drafts only from `bankOnly` /
   `ledgerOnly`; `matched`/`conflict` never draft; unclassified →
   `UNCLASSIFIED_DIFFERENCE` risk.
4. Map each draft to a proposal:

```ts
{
  label: `adjustment:${draft.draftId}`,
  explanation: draft.justification,
  subject: JSON.stringify({
    kind: "reconciliation-adjustment",
    draftId: draft.draftId,
    reference: draft.reference,
    source: draft.source,
    side: draft.side,
    requireApproval: draft.requireApproval,
  }),
  amountCents: draft.amountCents.toString(),  // pipeline reads BigInt(amountCents)
  reversibility: draft.requireApproval ? "partially-reversible" : "reversible",
}
```

**Reversibility mapping (deterministic, documented):** a draft that requires
approval is a controlled correction → `partially-reversible`; a draft that does
not require approval is a routine, fully reversible correction → `reversible`.
No draft maps to `irreversible` (reconciliation adjustments are corrections, not
final events).

**Return contract:** `{ proposals, risks }` — proposals carry every mapped draft;
risks carry every rejected row and every unclassified difference. Callers MUST
surface risks on the `ClosePackage.risks` channel; a non-empty risk never
silently drops the corresponding item.

## Converter 2 — closeEntriesToProposals

```ts
interface CloseEngineInputs {
  depreciation?: { assets: readonly FixedAsset[]; policy: DepreciationPolicy };
  provisions?: { inputs: readonly ProvisionInput[]; policy: ProvisionPolicy };
  isr?: { input: ProvisionalIsrInput; policy: IsrPolicy };
  closing?: { balances: readonly ResultBalance[]; chart: ReadonlySet<string> };
}

function closeEntriesToProposals(
  scope: CloseScope,
  inputs: CloseEngineInputs,
): { proposals: ReconciliationProposal[]; risks: string[] }
```

Pipeline (deterministic, BigInt cents, balanced-entry invariant from the
engine's `assertBalanced`):

1. `computeDepreciation(scope, assets, policy)` — one entry per asset.
2. `computeProvisions(scope, inputs, policy)` — one entry per classified input.
3. `computeProvisionalIsr(scope, input, policy)` — the ISR entry + cédula.
4. `closeResultAccounts(scope, balances, chart)` — one entry per non-zero
   result account.
5. Map each `CloseEntry` to a proposal:

```ts
{
  label: `close:${entry.kind}:${entry.id}`,
  explanation: `${entry.id} — ${entry.lines.map(l => `${l.accountCode} ${l.side} ${l.amountCents}`).join(", ")}`,
  subject: JSON.stringify({
    kind: "close-entry",
    entryId: entry.id,
    closeKind: entry.kind,
    lines: entry.lines,
  }),
  amountCents: entry.lines.reduce((sum, l) => sum + l.amountCents, 0n).toString(),
  reversibility: closeKindReversibility(entry.kind),
}
```

**Reversibility mapping (deterministic, documented):**

| entry.kind | reversibility | rationale |
| --- | --- | --- |
| `depreciation` | `irreversible` | consumes an asset's value across a closed period |
| `provision` | `partially-reversible` | estimate that can be adjusted/reversed with approval |
| `isr` | `irreversible` | statutory fiscal obligation (pago a cuenta) |
| `closing` | `reversible` | internal period close; re-openable |

**Amount:** sum of the entry's line amounts (balanced entry ⇒
sum(debits) === sum(credits), so either side's total; the reduce over all lines
is deterministic and equals the per-side total).

**Return contract:** `{ proposals, risks }` — every produced entry maps to a
proposal; engine errors (e.g. `UNBALANCED_ENTRY`, `ACCOUNT_NOT_IN_CHART`) surface
as risks and produce NO proposal for that input group.

## Vertical integration (flow/close.ts)

`MonthlyCloseInput` gains optional engine inputs:

```ts
export interface MonthlyCloseInput {
  // ... existing fields ...
  proposals?: readonly ReconciliationProposal[];
  /** NEW: engine inputs for deterministic candidate generation. */
  bankRows?: readonly BankRow[];
  ledgerRows?: readonly LedgerRow[];
  closeInputs?: CloseEngineInputs;
}
```

`runMonthlyClose` proposal assembly (deterministic order, both-sources merge):

```ts
const generated: ReconciliationProposal[] = [];
const wiringRisks: string[] = [];
if (input.bankRows && input.ledgerRows) {
  const r = reconciliationToProposals(scope, input.bankRows, input.ledgerRows);
  generated.push(...r.proposals);
  wiringRisks.push(...r.risks);
}
if (input.closeInputs) {
  const c = closeEntriesToProposals(scope, input.closeInputs);
  generated.push(...c.proposals);
  wiringRisks.push(...c.risks);
}
const allProposals = [...(input.proposals ?? []), ...generated];
```

- **Both-sources policy: MERGE (append).** External proposals first, then
  engine-generated. Nothing is dropped; every item enters the candidate
  pipeline.
- `wiringRisks` are appended to `ClosePackage.risks` BEFORE the candidate loop
  so a fail-closed conversion is always visible in the package.
- The existing loop over `allProposals` (CandidateLifecycle.propose →
  runGuardianReview → buildSignedReceipt → validateLedger) is UNCHANGED.

## Error model

The converters do not define new error codes. They are fail-closed by contract:

- Any rejected normalization row, unclassified difference, or engine error is
  surfaced as a human-readable risk string in the `risks` channel.
- No item is ever silently dropped; no proposal is fabricated from
  unclassifiable output.
- Deterministic: identical inputs ⇒ identical proposals and risks (no `any`, no
  floats, no Date-dependent behavior).

## Non-goals (restated)

No engine modification, no contract change, no ledger write, no new skills, no
MCP/CLI, no mission-intent change, no authority-model change, no real
connectors. The pipeline (candidate → guardian → receipt → ledger) is untouched;
this slice only feeds it deterministic candidates.

## Test plan (strict TDD)

- `close-wiring.test.ts`:
  - reconciliationToProposals: matching rows → one proposal per adjustment
    draft (label/explanation/subject/amountCents/reversibility asserted);
    requireApproval=false → `reversible`, true → `partially-reversible`;
    rejected row → risk, no fabrication; unclassified difference → risk.
  - closeEntriesToProposals: depreciation → `irreversible`, provision →
    `partially-reversible`, isr → `irreversible`, closing → `reversible`;
    unbalanced/engine error → risk, no proposal; amount = line sum.
- `close-integration.test.ts`: `runMonthlyClose` with bankRows+ledgerRows and
  closeInputs (no external proposals) → candidates generated, guardian reports
  present, receipts signed, ledger validates; external proposals + engine
  inputs together → merged (both present); engine error → risk in ClosePackage.
