# Runbook 02 — Key Rotation

← [Runbooks index](README.md) · [Usage reference](../usage.md)

Use this procedure with the affected mission, artifacts, and deployment owner identified.
Preserve evidence first; a diagnostic command does not authorize corrective mutation.

> [!IMPORTANT]
> **Signer trust is checked at verification time.** Rotating or revoking a key must never break the verifiability of existing receipts: receipts preserve the original key versions for reproducibility, and revocation is a signed, explicit event.

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

- A signer key is suspected compromised.
- Key rotation is scheduled (Design 05 "key rotation" scenario).
- A connector secret must be replaced.

## Rotation steps

1. **Stage the new key** in the managed vault (KMS/Key Vault — see [Design 04](../design/design-04-persistence-security-recovery.md)); never in env, files, prompts, logs, or public receipts.
2. **Register the new key** with an explicit `issuedAt`; old receipts verify against the key that signed them (versioned signer material).
3. **Dual-run:** sign new receipts with the new key while verification still accepts the old key until its expiry/revocation date.
4. **Revoke the old key** as an explicit, receipted event with a reason. `KEY_REVOKED` fail-closed: receipts signed after the revocation moment are rejected.
5. **Update connector secrets** through the same vault; the resolver reads from the vault, never from ambient configuration.
6. **Verify:** `drenyra-ai receipt verify` on a pre-rotation and a post-rotation receipt, and `drenyra-ai ledger validate` on the affected chain.

## Compromise response

1. Revoke the affected key immediately (fail-closed).
2. Stop the affected signer surface.
3. Rotate to a fresh key per the steps above.
4. Audit evidence access and any artifact signed after the suspected compromise moment.

## Key facts

- A signed XML is not an accepted CPE — signature validity and SUNAT acceptance are separate evidence.
- Trusted-signer verification and key revocation are explicit controls (Design 04 §11).

---

**Read next:** [03 — Schema migration](03-migration.md) · [Runbooks index](README.md)
