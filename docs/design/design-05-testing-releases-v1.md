# Design 05 — Testing, Releases, and the v1.0 Definition

> [!IMPORTANT]
> **Status: APPROVED.** Drenyra AI does not reach v1.0 because "it works in a demo." It reaches v1.0 when its authority, recovery, and integration are verifiable by independent consumers.

<!-- -->

> **Part of:** [Architecture](../architecture.md) · **Design series:** Design 05 · **Last updated:** 2026-08-10

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Test strategy

| Layer | What it proves |
| --- | --- |
| **Conformance** | The frozen contracts do not drift |
| **Unit** | Materiality, states, gates, hashes, and deterministic policies |
| **Property-based** | Monetary invariants, serialization, idempotency, ledger |
| **Integration** | PostgreSQL, object storage, keys, real transactions |
| **Contract tests** | Every ERP, bank, SUNAT, or host honors its adapter |
| **Recovery** | The process can be interrupted at any transition |
| **Cross-tenant** | No query or mutation crosses companies |
| **Adversarial** | Prompt injection, altered receipts, replay, forged approvals |
| **E2E** | Complete monthly close of a synthetic Peruvian company |
| **Professional acceptance** | An accountant understands, reviews, and decides without the CLI |

## Mandatory scenarios

The suite must test, at minimum:

1. File altered after being approved.
2. Identical candidate executed concurrently.
3. Crash before and after an external call.
4. Lost external response.
5. Signed XML without acceptance evidence.
6. Tax skill out of validity.
7. Document with malicious instructions for the agent.
8. Attempt to use another company's evidence.
9. Repeated approver on an R3 operation.
10. Key rotation or revocation.
11. Ledger with a removed or reordered entry.
12. Schema migration with active missions.
13. Model returning valid JSON that is accounting-inconsistent.

## Release pipeline

Every version must pass:

- Typecheck and lint.
- Unit and conformance suite.
- PostgreSQL and cross-tenant tests.
- Monthly-close E2E.
- Packed-install from the artifact that will actually be published.
- CLI, SDK, and MCP verification.
- Dependency and secret analysis.
- SBOM generation.
- Artifact signing and checksums.
- Clean install and upgrade from the previous stable version.

> [!NOTE]
> The release promotes as an **immutable artifact**. Drenyra and Drenyra Pi consume exactly that artifact — never a checkout of `main`.

## Versioning

| Surface | Policy |
| --- | --- |
| Drenyra AI | SemVer |
| Contracts | Own versions and explicit compatibility |
| Skills | Version, jurisdiction, validity period |
| Adapters | Capability matrix |
| Storage schemas | Versioned migrations |
| Receipts | Preserve original versions for reproducibility |

Changing a frozen contract requires a **major version and a migration path**. Updating a Peruvian rule does not necessarily break the Core.

## Maturity stages

| Stage | Condition |
| --- | --- |
| **Alpha** | Complete synthetic close; APIs still changing |
| **Beta** | Supervised use by pilot accounting firms |
| **Release Candidate** | Stable contracts, migrations, and recovery demonstrated |
| **v1.0** | Three independent consumers and verifiable professional operation |

## Mandatory v1.0 criteria

1. Drenyra consumes the published package and removes its duplicated implementation.
2. Drenyra Pi uses an exact, verified version.
3. At least one third independent consumer exists: ERP, SaaS, or pilot integration.
4. An accountant completes a monthly close from Drenyra without technical commands.
5. SIRE, reconciliation, vouchers, and candidates converge in the same mission.
6. Every material action produces an offline-verifiable receipt.
7. Every authoritative transition passes gates.
8. Peruvian policies are versioned and linked to sources.
9. Unknown states are reconciled before any retry.
10. Cross-tenant, replay, tampering, and forged-approval attacks are blocked.
11. The system recovers after an interruption without repeating actions.
12. SDK, MCP, CLI, doctor, install, and sync have documentation and tests.
13. Incident, key-rotation, migration, and recovery runbooks exist.
14. Three pilot accounting firms confirm that blocks and evidence requests are understandable.

## Measurable invariants

- **100%** of material actions have a receipt.
- **100%** of approvals bind to the exact candidate hash.
- **100%** of fiscal operations carry full scope.
- **0** blind retries after unknown results.
- **0** paths where an agent can authorize itself.
- **0** consumers depending on an internal copy of the Core.
- **0** external-execution claims without verifiable evidence.

> [!IMPORTANT]
> **The v1.0 goal is not to automate 100% of the close.** It is for the system to rigorously distinguish what it can automate, what needs evidence, and what only a professional can decide.

## Relation to the design series

- [Design 02](design-02-monthly-close.md) defines the flagship flow this test strategy validates end-to-end.
- [Design 04](design-04-persistence-security-recovery.md) defines the storage, idempotency, and security invariants this suite pins.

---

**Read next:** [Architecture](../architecture.md) — back to the index · [Design 04](design-04-persistence-security-recovery.md) — persistence, security, and recovery
