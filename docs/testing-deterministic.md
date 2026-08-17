# Deterministic Testing — Drenyra AI

How this repository proves fiscal correctness without trusting narration. The rule behind everything here: **the deterministic core is tested byte-for-byte against frozen canonical vectors; agents are tested as orchestration, never as oracles.**

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); sequence/index/version fields are JSON integers, never floats. Every test that touches money asserts whole-number cents.

---

## Why deterministic

Fiscal work is not a merge conflict. A wrong rounding, a cross-RUC read, or a receipt that verifies after tampering is a product defect, not a flaky test. The suite is built so that:

- **The same input always produces the same output.** No ambient state, no clocks, no network, no randomness in the deterministic core.
- **Contract drift fails the build.** Frozen contracts are pinned by conformance suites that run in CI and fail on any byte drift.
- **A passing suite means the invariants held.** Receipts verify, the ledger chain is intact, gates fail closed, tenant isolation holds.

**The anti-pattern:** an E2E that asks a real (non-deterministic) model to "do accounting" and asserts on its prose. Models propose; the deterministic core decides. Tests assert on what the core decided, with the model's output stubbed or fixture-driven.

## The test layers

From [Design 05 — Testing, Releases, v1.0](design/design-05-testing-releases-v1.md):

| Layer | What it proves | Where it lives |
| --- | --- | --- |
| **Conformance** | The frozen contracts do not drift | `contracts/__tests__/*-conformance.test.ts` |
| **Unit** | Materiality, states, gates, hashes, and deterministic policies | each subsystem's `__tests__/` |
| **Property-based** | Monetary invariants, serialization, idempotency, ledger | `ledger/`, `receipts/`, `missions/` tests |
| **Integration** | PostgreSQL, object storage, keys, real transactions | opt-in, clearly marked |
| **Contract tests** | Every ERP, bank, SUNAT, or host honors its adapter | `contracts/` |
| **Recovery** | The process can be interrupted at any transition | `recovery/__tests__/` |
| **Cross-tenant** | No query or mutation crosses companies | `tenant-isolation/__tests__/` |
| **Adversarial** | Prompt injection, altered receipts, replay, forged approvals | `receipts/`, `gates/`, `agents/` tests |
| **E2E** | Complete monthly close of a synthetic Peruvian company | flagged, CI-stable |
| **Professional acceptance** | An accountant understands, reviews, and decides without the CLI | manual/review |

## Canonical vectors — the frozen source of truth

Anything cryptographic or deterministic ships **canonical vectors**: a frozen, key-sorted fixture with the expected output byte-for-byte.

```text
contracts/receipt-schema/
  fixtures/conformance-vectors.v1.json   # frozen vectors for receipt verification
  fixtures/dev-keys.test-only.json       # test-only key material (never prod)
  schemas/*.schema.json                  # canonical JSON schemas
contracts/__tests__/                     # conformance suites that fail CI on drift
  receipt-conformance.test.ts
  ledger-conformance.test.ts
  candidate-conformance.test.ts
  gate-conformance.test.ts
  mission-protocol-conformance.test.ts
  recovery-conformance.test.ts
```

**When a contract or crypto changes, the vectors change in lockstep — in the same PR.** A frozen contract without matching vectors is not frozen; it is a promise.

### How to add a vector

1. Change the deterministic behavior and its implementation.
2. Regenerate/extend the fixture (`contracts/receipt-schema/fixtures/...`) with the new canonical input/output pair.
3. Run the conformance suite: `bun run test -- contracts`.
4. The suite must pass byte-for-byte. If it does not, the implementation and the fixture disagree — fix the disagreement, never silence the test.
5. If the change alters the normative contract shape, bump the contract version and follow the [contract regime](../contracts/README.md).

## The agent problem

`agents/` are deterministic `IntentHandler`s — but in production they may drive non-deterministic models. The suite keeps that honest:

- **Test the handler, not the model.** Stub/fixture the model output; assert on what the handler staged (candidate, evidence request, gate pause).
- **The model's output is data.** "Model returning valid JSON that is accounting-inconsistent" is a mandatory scenario — the core must reject it, never forward it.
- **No agent narration proves execution.** A story about SUNAT, a bank, or an ERP executing something proves nothing; tests assert on receipts and evidence, not on prose.
- **Deterministic red-team scenarios** are mandatory: prompt injection inside a document, signed XML without acceptance evidence, attempts to use another company's evidence, repeated approver on an R3 operation, key rotation/revocation, ledger with removed/reordered entry, schema migration with active missions. See the full [mandatory scenario list](design/design-05-testing-releases-v1.md#mandatory-scenarios).

## Strict TDD in this repository

When the project context detects testing capabilities (via `sdd-init`), apply Strict TDD Mode: **RED → GREEN → TRIANGULATE → REFACTOR**.

```text
RED         write the canonical-vector or unit test first; watch it fail
GREEN       implement the smallest behavior that passes it
TRIANGULATE add a second, distinct case that forces real behavior (no hardcoding)
REFACTOR    remove duplication while the suite stays green
```

Conformance vectors are the strongest form of RED: they freeze the expected bytes before the implementation changes.

## Running the suite

```bash
bun install --frozen-lockfile
bun run typecheck            # tsc --noEmit
bun run lint                 # biome lint
bun run test                 # full vitest suite
bun run brand:conformance    # brand contract drift → fail
bun run skills:conformance   # skills registry drift → fail
bun run verify:package       # build + tests + release artifacts + file manifest
node scripts/verify-packed-install.mjs   # prove the packed artifact works
```

Run one subsystem's tests:

```bash
bun run test -- missions
bun run test -- contracts
```

## What a change must prove

- **Behavioral change** → unit tests for the new behavior; conformance vectors if crypto/contracts.
- **Contract change** → version bump + migration path + vectors in lockstep + explicit approval ([contract regime](../contracts/README.md)).
- **Agent/orchestration change** → handler tests with stubbed model output; mandatory adversarial scenarios still pass.
- **Docs-only change** → no new tests required, but the documentation index and links must resolve.

## Read next

- [Codebase Guide](CODEBASE-GUIDE.md) — where each test layer lives
- [Design 05 — Testing, Releases, v1.0](design/design-05-testing-releases-v1.md) — mandatory scenarios, release pipeline, v1.0 criteria
- [Architecture](architecture.md) — the core invariants the tests pin
