# Contract: gate

> Version: 0.1-draft · Status: draft · Transport-agnostic.

A **gate** is a lifecycle checkpoint that validates authority, scope, and receipts before an action is allowed. Gates replace trust with verification: a transition that fails a gate is rejected, never ignored.

## Purpose

- Prevent unapproved, out-of-scope, or unreceipted actions from ever landing.
- Make approval an explicit, recorded event instead of an ambient assumption.
- Give CI/CD and humans the same enforcement surface.

## Lifecycle gates

| Gate          | Validates                                                              |
| ------------- | ---------------------------------------------------------------------- |
| `mission`     | Legal state transition, scope, materiality tier                        |
| `pre-commit`  | Receipts for all staged mutations, no secrets, no scope leaks          |
| `pre-push`    | Commit receipts + authority, branch policy                             |
| `pre-pr`      | Review evidence, chained-PR boundaries, workload forecast              |
| `release`     | Full authority chain, receipt ledger continuity, immutable target      |
| `approval`    | Explicit human approval at R2/R3 with dual approval at R3              |

## Authority

- Authority is **derived**, never asserted by the actor.
- A gate validates the exact owner-issued receipt/authorization and never reopens review for unchanged content.
- Changed authority fails closed.
- Recovery never reopens a closed review lineage or resets its budget.

## Behavior

1. A gate runs before the action, on the exact bytes that will be released.
2. Failures produce a structured verdict: `allowed | blocked | needs_input`.
3. `blocked` carries the reason; the action does not proceed.
4. `needs_input` returns the complete decision envelope — the caller answers, the gate never guesses.
5. Gates are deterministic and testable; every gate ships with pass/fail vectors.

## Human approval

Approval is a first-class event:

- R2: explicit approval by an authorized professional.
- R3: explicit **dual** approval; single approval is insufficient.
- Approval is receipted with the approver, scope, and timestamp. Memory (Drenyra Engram) never authorizes — only a professional does.

## Conformance

Vectors cover: allowed/blocked transitions per gate, authority derivation, receipt requirement, dual-approval enforcement at R3, and fail-closed behavior on unknown states.

## Reference implementation

`drenyra-ai` ships a zero-dependency TypeScript reference implementation under `gates/`:

- `gates/approval.ts` — `ApprovalGate`: materiality-proportional approval (R0/R1 none, R2 single, R3 dual distinct approvers; `needs_input` carries the approval envelope).
- `gates/receipt.ts` — `ReceiptGate`: signed-receipt authenticity + trusted signer lifecycle (allow-list keys, embedded-key self-trust fallback documented as weak).
- `gates/mission.ts` — `MissionStateGate`: validates a target status against the canonical mission transition table; illegal or terminal transitions are blocked.
- `gates/runner.ts` — `GateRunner`: deterministic fail-closed pipeline — the first non-allowed verdict stops the run and is returned with its envelope.
