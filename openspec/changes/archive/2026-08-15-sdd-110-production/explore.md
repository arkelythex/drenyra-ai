# SDD-110 (Production) — Exploration: connector-conformance first slice

> Status: exploration · Scope: drenyra-ai-side Core contribution only (first slice).
> This is a READ-ONLY sizing study; nothing here is implemented, tested, or claimed (R17).

## Purpose

SDD-110 is `lifecycle:planned` (wave 4). Its full scope (real ERP/SUNAT/SIRE/bank/
e-invoicing/document connectors, KMS, production storage, observability, pilots,
open-core gate) is far outside any single review unit. This exploration sizes the
FIRST slice: the piece **drenyra-ai owns** — a connector-adapter conformance
contract that future restricted adapters can be tested against **without shipping a
real connector**, so the Core's mutation boundary is conformance-pinned before any
vendor integration exists.

The scope question is narrow: what does drenyra-ai must ADD so a future adapter for
ERP/SUNAT/SIRE/banks/e-invoicing/documents can be conformance-tested against the
Core without network, credentials, or a live system? Constitutional rule 10 keeps
the Core independent of cloud/UI/commercial connectors; the connector contract is
the seam, not the vendor.

## Current-state inventory

### 1. Adapter surface (drenyra-ai)

- **Module** `adapters/` — exported as `./adapters` → `./dist/adapters/index.js`
  (package.json). Barrel `adapters/index.ts` re-exports `registry.js` + `local.js`.
- **`adapters/registry.ts`** — the current adapter contract is **fetch-only**:
  - `interface EvidenceAdapter { name; declareCapability(): AdapterCapability; fetch(input): Promise<AdapterResult>; }`
  - `AdapterCapability { system; jurisdiction; evidenceTypes }` (scope: system + jurisdiction).
  - `EvidenceFetchInput { missionId; ruc; period; requiredTypes }` — tenant-bound (RUC + fiscal period).
  - `AdapterResult { items; missingRequired; complete }` — `complete` only when every required type obtained; absence surfaces as `WAITING_FOR_EVIDENCE` (absence is never zero).
  - `class AdapterRegistry` — register (dedups by system/jurisdiction), resolve, list.
  - Helpers `evidenceItem` (sha256 id), `evidenceManifestHash` (order-independent, via `computeEvidenceHash`), `missingTypes`. Depends only on `node:crypto` + `receipts`.
- **`adapters/local.ts`** — `class LocalFileAdapter implements EvidenceAdapter`, system `local-files`/PE. Explicitly TEST-ONLY ("Never for production"). Reads a local JSON directory.
- **Consumer** — `flow/close.ts` (`runMonthlyClose`) imports `AdapterRegistry` + `EvidenceFetchInput`; this is the monthly-close (SDD-050) deterministic local core.
- **CLI adapters** — `cmd/adapters/` are IO plumbing, not connectors: `file-mission-store.ts`, `schema-loader.ts`, `package-metadata.ts`. Distinct from external connectors.
- **Declared surface** — `cmd/declared-surface.ts` sets `DECLARED_ADAPTERS = []` (CLI/MCP declares zero adapters).

**Assessment:** the existing adapter surface is a read-only **evidence-fetch** port. It
has NO execution, NO idempotency, NO UNKNOWN outcome, NO stable-identifier
reconciliation. Production connectors are **mutation boundaries** (submit a document,
declare to SUNAT/SIRE, settle a bank line) — a materially different contract.

### 2. RDA idempotency / UNKNOWN-reconciliation primitives (SDD-040 coordinates)

The pieces a connector-conformance contract must plug into already exist in Core:

- **Idempotency** — `missions/idempotency.ts`: `IdempotencyStore` port,
  `defaultIdempotencyKey`, `isValidIdempotencyKey`, `IdempotencyConflict`.
  `missions/runtime.ts` `apply()`: idempotency key → `canonicalHash(command)`,
  records `EXECUTING` before any mutation, rejects reuse-with-different-payload
  (`IDEMPOTENCY_CONFLICT`), guards concurrent `ALREADY_EXECUTING`, caches success
  and failure outcomes for replay. Postgres `idempotency_records` table
  (`missions/store.postgres.ts`). `versioning.ts` declares `idempotency.key.v1`,
  `idempotency.replay.v1`.
- **UNKNOWN reconciliation** — `missions/transitions.ts`: `reconcileTransition(from
  UNKNOWN, resolution → RUNNING|FAILED|COMPLETED)`, `isValidRecoveryPath`.
  `missions/reconciliation.ts`: `reconcileExternalCall(resolver, call)` maps
  `ExternalOutcome = "executed" | "not-executed" | "indeterminate"` →
  `ReconciliationDecision = "record" | "retry" | "human-intervention"`. Fail-closed:
  missing resolver is an error; `executed` **requires verifiable evidence**
  (`ExternalEvidence { identifier, state, provenance, moment, responseHash }`);
  `not-executed` permits only an **idempotent** retry; `indeterminate` requires a
  professional. Port `interface ExternalSystemResolver { resolve(call) }`.
- **Receipts** — `receipts/types.ts` already defines `ReceiptType.EXTERNAL_SUBMISSION`
  ("EXTERNAL_SUBMISSION"), conformance-tested in
  `receipts/__tests__/conformance-vectors.test.ts:128`. This is the receipt kind a
  successful external submission produces.
- **Ledger** — `ledger/` append-only audit hash chain (capability
  `audit-ledger-hash-chain: implemented`). Audit-only; not a write path.
- **Scope isolation** — `tenant-core/` (export `./tenant`): `validateTenantScope`,
  `sameTenantScope`, `TenantScope { companyId, ruc, period }`,
  `ValidatedTenantScope` (branded). Enforced fail-closed in `journal/validate.ts`
  and `evidence/authority/authority.ts`. Capabilities `tenant-core` + `tenant-isolation`
  are `implemented`.

**Assessment:** Core already owns idempotency keys, UNKNOWN state, evidence-bound
reconciliation, the `EXTERNAL_SUBMISSION` receipt, and tenant scope. What is missing
is a **type-level contract that forces a connector adapter to uphold all of them**
plus the conformance suite that proves it.

### 3. Contracts discipline

- `contracts/README.md`: six contracts FROZEN at v0.1 + `brand-system` DRAFT at v0.2.
  **Freezing = the normative surface is pinned by a conformance suite that runs in
  CI and fails on drift.** The `brand-system` precedent is directly relevant: it
  ships its conformance suite NOW and freezes only when the ecosystem adopts it.
- Pattern confirmed by CI — `.github/workflows/ci.yml` jobs: `typecheck`, `lint`,
  `test` (vitest; runs contract conformance vectors such as
  `receipts/__tests__/conformance-vectors.test.ts`), plus dedicated
  `brand-conformance` and `skills-conformance` drift gates. A new connector
  conformance can follow either the in-`test` vector suite or a dedicated job.
- `receipt-schema/` is the frozen conformance source of truth for the receipt
  contract (schemas + `fixtures/conformance-vectors.v1.json`).
- **No existing contract names an adapter/connector surface** (grep of `contracts/`
  for `adapter|connector|EvidenceAdapter` returns no matches). This is greenfield.

**Assessment:** the authoring recipe for a DRAFT-with-conformance-then-freeze
contract is established and CI-enforced. A `connector-adapter` contract can be
authored DRAFT with its conformance suite now, without claiming any adapter exists.

## Gap analysis

For future restricted adapters to be **conformance-tested against the Core without
shipping real connectors**, drenyra-ai must ADD:

1. **A connector-adapter contract** (`contracts/connector-adapter.md`, DRAFT v0.1) —
   a transport-agnostic, type-level surface for MUTATION adapters (unlike the
   fetch-only `EvidenceAdapter`), specifying:
   - **Idempotent execution semantics** — every `execute` takes an idempotency key,
     binds to a canonical command hash; reuse of the key with the same payload
     returns the same result (replay) without re-executing; reuse with a different
     payload fails closed (`IDEMPOTENCY_CONFLICT`). Leverages `missions/idempotency.ts`.
   - **UNKNOWN outcome handling** — `execute` may return `UNKNOWN` (result
     indeterminate after a partial/interrupted call); the adapter exposes a
     `stableIdentifier` so `reconcileExternalCall` (record/retry/human) can run.
     Maps onto `ExternalSystemResolver` + `reconcileTransition`. The adapter must
     **never** fabricate an executed/not-executed verdict and must **never** claim
     external execution without verifiable evidence (`ExternalEvidence`).
   - **Scope-isolation invariants** — every execution binds to a
     `ValidatedTenantScope` (`companyId`/`ruc`/`period`); the adapter must not read
     or write across tenants; `sameTenantScope` guards any cross-boundary access.
   - **Restricted authority** — the adapter performs only its declared
     capability (`system`/`jurisdiction`), never decides materiality, and never
     skips a gate (governance amendment W3). Credentials are out of scope (KMS
     runbooks, SDD-110 later); the Core contract asserts none are embedded.
   - **Verifiable response** — mirrors `ExternalEvidence`: a successful submission
     is hash-addressed and provenance-tagged; `EXTERNAL_SUBMISSION` is the receipt
     kind produced.
2. **A type-level implementation in a library module** (node:crypto only) — e.g.
   `adapters/connector.ts` defining `ConnectorAdapter`, `ConnectorExecuteInput`,
   `ConnectorExecuteResult` (including an `UNKNOWN` branch), `ConnectorReconcile`
   port, and small fail-closed validators (idempotency-key + scope guards + evidence
   verifiability). No I/O, no network, no `http`/`net`/`pg` import.
3. **A conformance suite with a mock/driver adapter** — following the
   `LocalFileAdapter` TEST-ONLY precedent: an in-memory `MockConnectorAdapter`
   driving the conformance vectors (idempotent replay, UNKNOWN → reconcile
   record/retry/human, scope-isolation rejections, evidence-bound execution). This
   is the proof the contract is freezable, without any real connector.
4. **CI drift coupling** — the conformance suite runs in CI (`test` job) so the
   DRAFT contract fails on drift, mirroring `brand-system`.

**Not added in this slice:** real connectors, credentials, network, `cmd/declared-surface`
adapter population, KMS, observability, pilots, or any capability-matrix promotion.

## First-slice options

### Option A — Connector-adapter DRAFT contract + type-level surface + mock conformance suite (RECOMMENDED)

- Author `contracts/connector-adapter.md` (DRAFT v0.1) — the mutation-adapter
  contract with idempotent-execute, UNKNOWN-reconcile, scope-isolation, and
  verifiable-response invariants.
- Add `adapters/connector.ts` (node:crypto only) — `ConnectorAdapter` interface +
  fail-closed validators, reusing `missions/idempotency.ts`, `reconciliation.ts`,
  `tenant-core`, `receipts` (EXTERNAL_SUBMISSION).
- Add `adapters/__tests__/connector-conformance.test.ts` — `MockConnectorAdapter`
  driver proving the vectors (replay, UNKNOWN→record/retry/human, scope rejection,
  evidence-bound success).
- Update `adapters/index.ts` barrel + `contracts/README.md` index row.
- Mirrors SDD-100 slice A and the `brand-system` DRAFT-with-conformance precedent.
- Fits the ~300–400-line budget; no size exception needed.

### Option B — Option A + wire into the declared surface and flow

- Everything in A, plus populate `cmd/declared-surface.ts` `DECLARED_ADAPTERS` and
  thread the connector port through `flow/close.ts`. More complete, but crosses the
  budget and touches the live monthly-close consumer (SDD-050) — higher risk.

### Option C — Refactor/replace the existing `EvidenceAdapter` fetch contract

- Redefine `EvidenceAdapter` to a unified execution+fetch port. Larger surface
  change that breaks `flow/close.ts` and the SDD-050 local core; unnecessary for
  conformance pinning.

## Recommendation

**Option A.** It produces the durable, CI-pinned Core contribution SDD-110 needs
(an adapter contract future connectors conform to) while staying inside the budget,
reusing existing RDA primitives instead of inventing new ones, and making zero
capability claims (R17). Option B is a clean follow-up slice; Option C is rejected as
disruptive to a working surface.

## Non-goals (this slice)

- No real connectors, no credentials, no network, no `http`/`net`/`pg`/`fs` I/O in
  the contract module.
- No KMS, observability, pilots, runbooks, or open-core gate (later SDD-110 slices).
- No capability-matrix promotion; `adapters-ERP-SUNAT-banks` stays `planned`.
- No change to the frozen `EvidenceAdapter` fetch surface or `flow/close.ts`.
- No `cmd/declared-surface.ts` adapter population.

## Risks

1. **Scope creep toward a live connector** — the slice must stay type-level + mock;
   any real-system import or credential path defeats the purpose and violates the
   budget. Mitigate: node:crypto-only constraint in the module header and conformance
   gating.
2. **Contract drift / premature freeze** — a DRAFT connector contract that ships a
   conformance suite must not be treated as frozen or as an implemented capability.
   Mitigate: keep `brand-system` DRAFT status precedent; CI `test` job fails on drift
   without claiming adoption.
3. **Surface collision with the fetch-only `EvidenceAdapter`** — introducing a
   separate `ConnectorAdapter` risks confusion with the existing read port and could
   tempt a disruptive merge (Option C). Mitigate: document the two ports distinctly
   and keep `flow/close.ts` untouched.

## Test / metric hints

- Conformance vectors: idempotent replay returns same result without re-execution;
  key reuse with different payload fails closed; UNKNOWN → `record` requires
  verifiable evidence, `not-executed` permits only idempotent retry, `indeterminate`
  requires human; scope mismatch rejects; success emits `EXTERNAL_SUBMISSION`.
- Metric: adapter conformance — idempotency, UNKNOWN reconciliation, scope isolation
  (per SDD-110 README tests section).
- Run: `bun run typecheck`, `bun run test` (conformance vector file), `bun run lint`.
