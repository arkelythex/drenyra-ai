# Proposal: Monthly Close Core Integration

## Intent

Deliver the first end-to-end Peruvian fiscal vertical: a real monthly-close journey initiated in the Command Center and completed through a published, versioned Drenyra AI Core integration.

The change replaces duplicated Command Center runtime/signing behavior and mocked end-to-end success with one authoritative Core lifecycle for a single RUC and fiscal period. Core owns mission state, evidence registration, candidate identity, gate evaluation, approval recording, and immutable receipt issuance. The Command Center presents and orchestrates the workflow but does not recreate fiscal authority.

This is the first product slice of the Peru v1 roadmap. It exercises the approved architecture boundaries among tenant scope, evidence, fiscal lifecycle, candidates, gates, and receipts while preserving the distinction between AI advice and deterministic accounting authority, evidence and memory, and the audit ledger and accounting journal.

## Business Problem and Current-State Gap

Today, the Command Center duplicates runtime and signing responsibilities that should belong to Core, while its end-to-end journey is mocked. Users can see a monthly-close-shaped workflow, but the system cannot demonstrate that a real, versioned Core evaluated the same evidence and candidate that a human approved, or that the resulting receipt can be trusted independently on the server.

Core already has tested in-memory primitives for missions, candidates, gates, receipts, recovery, and audit behavior. It does not yet expose a published consumer integration that proves these primitives work together across the repository boundary. This leaves fiscal authority ambiguous, increases implementation drift, and makes support and audit explanations harder.

## Product Outcome

An authorized accountant can start a monthly close for one organization/RUC and period in the Command Center, review Core-registered evidence and a versioned close candidate, resolve deterministic gates, provide the required R2 approval, and receive a Core-issued immutable receipt whose authenticity and binding are verified by trusted Command Center server code.

The user experience must fail closed: an invalid tenant scope, incomplete evidence, failed gate, stale candidate, unauthorized approval, unsupported contract version, or unverifiable receipt cannot be presented as a completed close.

## Scope

### Core deliverables

- Define and version the consumer-facing contracts needed for one monthly-close lifecycle, including mission, evidence references, candidate identity, gate results, approval, and receipt verification outcomes.
- Compose existing Core primitives into one deterministic monthly-close application path for the fiscal `cierre` phase.
- Enforce organization, RUC, and fiscal-period scope at every material operation, including SUNAT modulo-11 RUC validation and authorization against the active organization context.
- Preserve the fiscal lifecycle order: `captura -> clasificacion -> conciliacion -> cierre`. A close cannot bypass unmet predecessor evidence or gates.
- Require an R2 human approval by an authorized accountant before the close is finalized.
- Bind every candidate, approval, and receipt to the RUC, period, mission, evidence set, contract version, sequence/version, actor, timestamp, and reason required by the audit model.
- Issue append-only, immutable receipts for material transitions and expose trusted verification using Core-owned canonicalization, signature rules, schemas, and trust metadata.
- Publish a versioned, installable Core artifact with frozen conformance vectors and packed-artifact/install verification suitable for use by the Command Center server.
- Provide deterministic integration fixtures that contain no credentials or customer data.

### Command Center integration slice

- Replace duplicate monthly-close runtime/signing logic with a server-side adapter to the published Core artifact.
- Keep secrets, trusted keys, signature verification, and authoritative verification results on the server; browser-side checks may improve UX but cannot establish trust.
- Render mission state, evidence status, candidate identity, gates, approval requirements, and receipt verification from authoritative Core results.
- Replace the mocked happy-path E2E with a real integration journey against the pinned Core version, plus fail-closed coverage for at least one invalid or tampered receipt.

### First-slice evidence boundary

The slice registers immutable, content-addressed evidence references and the metadata needed to evaluate readiness for close. It may use deterministic fixtures or existing upstream outputs for capture, classification, and reconciliation. It does not build all ingestion connectors or recalculate every upstream fiscal process.

Evidence is not conversational memory. Evidence used by a candidate must remain attributable and reproducible, and changing the evidence set must create a new candidate identity rather than mutating an approved candidate.

## Authority Boundary

### Drenyra AI Core owns

- Normative, versioned lifecycle and receipt contracts.
- Mission transitions and idempotency.
- Evidence registration and binding to RUC and period.
- Candidate identity, materiality, and versioning.
- Deterministic gate evaluation and fail-closed decisions.
- Approval policy, approval binding, and close finalization.
- Receipt creation, canonicalization, signing rules, and verification semantics.
- Append-only audit events for every material action.

### Command Center owns

- Authenticated user interaction and organization-context selection.
- Workflow presentation, explanations, and collection of explicit approval intent.
- A thin server-side integration adapter pinned to a supported Core version.
- Secure custody/configuration of deployment-specific trust material according to Core contracts.
- Display of authoritative results without reimplementing or overriding them.

### Explicit authority rules

- AI agents may advise, summarize, and stage intent; they cannot approve or finalize the monthly close.
- The Command Center cannot mint, self-sign, reinterpret, or mark a close complete without a valid Core receipt.
- Browser state, client claims, and locally reconstructed signatures are never authoritative.
- Core's `ledger/` remains an append-only audit trail; this slice does not turn it into the accounting journal.
- No operation may cross RUC or fiscal-period boundaries. Cross-RUC access remains prohibited unless a separately authorized and audited product capability is introduced.
- Fiscal-period closure is irreversible after valid R2 approval within this slice; correction requires a subsequent, explicitly modeled fiscal process rather than mutation of the approved record.

## Cross-Repository Sequencing

1. **Freeze the integration contract in Core.** Define the monthly-close contract version, conformance vectors, authority fields, compatibility policy, and verification API before consumer implementation.
2. **Complete the Core vertical.** Compose mission, evidence, candidate, gate, approval, receipt, recovery, and audit behavior behind the versioned public surface. Validate RUC/period isolation and deterministic replay.
3. **Publish and verify the Core artifact.** Produce an immutable version, verify its packed contents and installation, and make the exact version and integrity metadata available to the Command Center.
4. **Integrate the Command Center server.** Pin the published Core version, remove or bypass duplicate authority/signing paths for this journey, and map authenticated organization context into Core calls.
5. **Integrate Command Center UX.** Present authoritative states and approval requirements without duplicating decision logic.
6. **Run cross-repository conformance and E2E.** Prove the real happy path and fail-closed paths against the same pinned artifact and frozen vectors.
7. **Enable controlled rollout.** Release behind a monthly-close integration flag or equivalent server-controlled routing boundary, retaining the prior non-authoritative experience only as a clearly marked fallback during rollout.

Core contract publication is a hard dependency for Command Center integration. Consumer-specific requirements discovered after publication require an explicit compatible contract revision or a new version; they must not be patched through duplicated consumer logic.

## Measurable Outcomes

- One automated integration journey completes `mission -> evidence -> candidate -> gates -> R2 approval -> receipt -> server verification` for one valid PE RUC and fiscal period using the published Core artifact.
- The Command Center monthly-close path contains no independent receipt minting, signing, mission state machine, candidate identity algorithm, or gate decision implementation.
- Every material lifecycle event records RUC, period, actor, timestamp, reason, and immutable object identity.
- A changed evidence set or material candidate input produces a different candidate identity and invalidates approval of the prior candidate for finalization.
- Unsupported contract versions, invalid RUC scope, failed predecessor/gate state, unauthorized approval, and tampered receipts are rejected deterministically and cannot produce a completed-close UI state.
- Receipt verification occurs on the server and proves signature validity plus binding to the expected RUC, period, mission, candidate, approval, and contract version.
- The published artifact passes Core conformance vectors, package/install checks, typecheck, build, and relevant tests; the Command Center real integration and E2E checks pass against that exact pinned version.
- Deterministic retries do not create duplicate approvals, finalizations, or receipts.

## Acceptance Criteria

1. Given an authenticated accountant authorized for a valid RUC and open period, when the Command Center starts monthly close, then Core creates or resumes an idempotent RUC-and-period-scoped mission.
2. Given complete registered evidence for required predecessor phases, when Core builds a close candidate, then the candidate is deterministically bound to the evidence set, RUC, period, mission, and contract version.
3. Given missing, stale, cross-RUC, or conflicting evidence, when readiness is evaluated, then Core fails closed and no approvable close candidate is produced.
4. Given a candidate with unsatisfied gates, when approval or finalization is attempted, then Core rejects the transition and emits an auditable result without completing the close.
5. Given all deterministic gates pass, when an authorized accountant explicitly approves the exact current candidate, then Core records an R2 approval and issues an immutable receipt bound to that approval and candidate.
6. Given a stale candidate or an approval for a different candidate version, when finalization is attempted, then Core rejects it and requires review of the new candidate.
7. Given a valid Core receipt, when the Command Center server verifies it with the supported Core verifier and configured trust material, then it returns a structured verified result and the UI may present the close as completed.
8. Given a modified receipt, wrong expected RUC/period/candidate, unknown trust identity, or unsupported contract version, when server verification runs, then it returns a structured failure and the UI cannot present completion.
9. Given a retried request with the same idempotency identity, when Core processes it, then no duplicate material event, approval, finalization, or receipt is created.
10. Given the published Core package is installed in a clean consumer environment, when conformance and integration checks run, then the package exposes only the documented versioned surface and reproduces the frozen verification vectors.
11. Given any monthly-close operation, when its audit record is inspected, then RUC, period, timestamp, actor, reason, contract version, and relevant immutable identities are present.
12. Given two organization contexts, when either attempts to reference the other's RUC, evidence, mission, candidate, approval, or receipt, then the request is rejected before material action and the denied attempt is auditable where policy requires.

## Non-Goals

- Building the full 16-program Peru v1 roadmap in this change.
- Live SUNAT declaration submission, CDR filing, or the `declaracion` and `auditoria` phases.
- Implementing all ERP, banking, SIRE, document-capture, classification, or reconciliation connectors.
- Replacing the accounting system of record or introducing accounting journal posting into the audit-only Core ledger.
- Allowing AI agents, browser code, or Command Center business logic to approve closes or establish receipt trust.
- Generalizing the integration to every fiscal workflow, jurisdiction, or approval level.
- Migrating historical mocked closes into authoritative Core receipts.
- Defining a cross-RUC administrative workflow.
- Modifying unrelated OpenSpec changes, including `drenyra-ecosystem-cleanup`.

## Product Tradeoffs

- **Vertical proof over broad coverage:** the slice proves one real close deeply rather than offering shallow integrations for many fiscal workflows.
- **Pinned version over consumer flexibility:** the Command Center must upgrade deliberately when Core contracts change; this reduces drift at the cost of coordinated releases.
- **Fail-closed trust over availability:** verification or trust-configuration failures block completion instead of accepting an unverifiable result.
- **Evidence references over connector breadth:** the first slice validates authority and reproducibility while deferring most ingestion work.
- **Irreversible approval over convenient edits:** approved closes are not mutated; corrections require a later explicit fiscal process.

## Affected Areas

### Drenyra AI Core repository

- Versioned contracts and conformance vectors.
- Tenant/RUC/period context and evidence capabilities required by the Peru v1 roadmap.
- Missions, candidates, gates, receipts, recovery, and audit ledger composition.
- Package exports, packed-artifact verification, install checks, and integration documentation.

### Command Center repository

- Server-side Core dependency and adapter.
- Authentication-to-RUC/period context mapping.
- Monthly-close workflow UI and approval interaction.
- Removal or isolation of duplicate runtime/signing behavior.
- Real integration/E2E fixtures and receipt-tampering checks.

### Operational and support impact

- Coordinated package publication and consumer upgrade process.
- Trust-material configuration and rotation procedures.
- Version compatibility diagnostics visible to operators.
- Support guidance that distinguishes evidence readiness, gate failure, approval state, and receipt verification failure.

## Risks and Mitigations

- **Contract drift across repositories:** freeze conformance vectors first, pin the consumer version, and reject unsupported versions rather than adapting silently.
- **Authority leakage into the Command Center:** keep its adapter thin, prohibit local signing/state-machine implementations, and add architectural checks for duplicate authority paths.
- **Incorrect tenant isolation:** require organization-authorized RUC context on every operation, validate RUC checksums, and test cross-RUC denial across all object types.
- **Receipt accepted without complete semantic binding:** verification must validate both cryptographic authenticity and expected RUC, period, mission, candidate, approval, and contract version.
- **Key or trust-material misconfiguration:** keep trust operations server-side, expose structured diagnostics without secrets, and fail closed.
- **Approval race or stale evidence:** use immutable evidence/candidate identities, optimistic version checks, and candidate-bound approvals.
- **Duplicate effects during retries or network failure:** require idempotency and recovery semantics across every material transition.
- **Premature closure despite incomplete upstream work:** encode predecessor and close gates deterministically; fixtures cannot bypass production gate rules.
- **Publishing unverified package contents:** gate release on packed-artifact inspection, clean install, frozen vectors, tests, typecheck, and build.
- **Scope expansion into declarations or ingestion:** enforce the first-slice boundaries and track later connectors/SUNAT submission as separate changes.
- **Cross-repository rollout failure:** use a server-controlled rollout boundary and retain a non-authoritative fallback without allowing it to issue trusted completion.

## Rollback

- Disable the Command Center integration route and return users to the clearly marked non-authoritative prior experience; do not convert fallback results into Core receipts.
- Unpin or withdraw the affected Command Center deployment while retaining all Core-issued receipts and audit events as immutable records.
- Stop new missions on the affected Core package version and publish a corrected version; never rewrite an already published contract, package version, approval, or receipt.
- Resume incomplete missions only through Core recovery semantics after compatibility is established.
- Treat any close that already has a valid approved receipt as historically final. Operational rollback cannot erase or mutate it; correction follows a separately authorized fiscal process.

## Success Criteria

This proposal succeeds when the Command Center demonstrates one production-shaped, server-trusted monthly close against an immutable published Core version; Core is the sole authority for mission, evidence, candidate, gate, approval, and receipt semantics; all state remains RUC-and-period isolated; and both the valid journey and critical fail-closed cases are reproducible through automated cross-repository checks.
