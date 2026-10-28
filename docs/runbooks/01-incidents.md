# Runbook 01 — Incidents

← [Runbooks index](README.md) · [Usage reference](../usage.md)

Use this procedure with the affected mission, artifacts, and deployment owner identified.
Preserve evidence first; a diagnostic command does not authorize corrective mutation.

> [!IMPORTANT]
> **A gate that fails blocks the action; `needs_input` returns the complete decision envelope and the human answers — the gate never guesses.** An incident is a surface stopped by authority, integrity, or evidence failure — never a reason to bypass the gates.

<!-- -->

> **Part of:** [Runbooks](README.md) · **Last updated:** 2026-08-10

## Before you start

- Confirm the artifact paths and scope with the deployment owner.
- Consult [CLI syntax](../usage.md) before running commands shown below. For example,
  receipt verification needs an input file (`drenyra-ai receipt verify ./receipt.json`),
  and ledger validation needs a JSON file (`drenyra-ai ledger validate ./ledger.json`).
- Treat those paths as examples, not production defaults. Key rotation, migration,
  replay, and fencing steps require the deployment's approved integration tooling;
  the diagnostic CLI does not perform them automatically.

## When to use

- A gate, receipt, or ledger check fails in production.
- An authority surface is stopped (integrity failure).
- Evidence verification reports an invalid hash or signer trust issue.

## Detection and classification

| Class | Signal | First response |
| --- | --- | --- |
| Scope | RUC/company mismatch | Fail closed, alert the operator, do not proceed |
| Evidence | Missing source or invalid hash | Wait for evidence; absence is never zero |
| Integrity | Invalid signature, receipt, or ledger | Stop the affected surface immediately |
| Unknown outcome | Connection lost after an external send | Run [Recovery](04-recovery.md), never a blind retry |

## Response steps

1. **Stop the affected surface.** Preserve the failing artifact (receipt, ledger entry, evidence hash) — never delete evidence during an incident.
2. **Confirm the failure class** using the table above and the error taxonomy (Design 04 §10).
3. **Run diagnostics read-only:** `drenyra-ai doctor run`, then re-validate the artifact (`drenyra-ai receipt verify`, `drenyra-ai ledger validate`).
4. **Do not retry blindly.** If the failure is an unknown external outcome, reconcile first (see [Recovery](04-recovery.md)).
5. **Escalate to a professional** when the decision cannot be derived from evidence and gates.
6. **Record the incident** as an explicit event with the failing artifact hash, the classification, and the resolution.
7. **Post-mortem:** update this runbook if the failure class was not covered.

## Fail-closed rules

- No incident is resolved by converting a failure into success.
- No consumer converts a Core rejection into an approval.
- Every corrective action produces a receipt.

---

**Read next:** [02 — Key rotation](02-key-rotation.md) · [Runbooks index](README.md)
