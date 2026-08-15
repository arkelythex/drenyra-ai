# SDD-030 — Organic Accounting Work Routing Design

> Phase: Design · Status: PROPOSED · Change: `sdd-030-routing` · Slice: A+B (`WorkUnit` + `WorkResult`)

## 1. Design objective

Add a transport-independent `routing/` library module that describes one bounded accounting work request and its structured result. The module is advisory: it can construct and validate envelopes, hash evidence, and record a proposed mission transition, but it cannot execute work or authorize a transition.

This design preserves the existing authority boundaries:

- `missions/` remains the frozen Core and owns the canonical 15-state lifecycle and `validateTransition` behavior.
- `candidates/` remains the source of candidate identity, scope, materiality, reversibility, and `BigInt` cents conventions.
- `routing/` depends only on mission and candidate types. It never imports `agents/`, commands as a runtime dependency, adapters, stores, receipts, ledgers, journals, or transport code.
- A canonical transition validator is supplied by the composition caller. Production routing code does not import or duplicate `VALID_TRANSITIONS`.

## 2. Decisions

| Decision | Resolution | Rationale and code evidence |
| --- | --- | --- |
| Module placement | Add a sibling library module at `routing/`, with `routing/index.ts` as its public entry point. Re-export it from the package `index.ts`. | `missions/index.ts` is the public Core surface and already owns status and transition behavior. Putting routing under `missions/` would blur advisory routing with authority and make future reverse imports more likely. A sibling module follows the configured `contracts -> library modules -> agents -> cmd` direction. |
| Frozen Core | Do not modify any file under `missions/`, `candidates/`, or `agents/`. | `missions/status.ts` is the single source of truth for all 15 states and `VALID_TRANSITIONS`; `missions/transitions.ts` is the canonical throwing validator. This slice is additive and must not alter those contracts. |
| Mission state type | `WorkUnit.stage` and `NextTransition.from/to` use the imported `AccountingMissionStatus` type. `createWorkUnit` always supplies the canonical `DRAFT` value and does not accept an initial stage from callers. | This reuses the real enum rather than defining a parallel routing status union. The hard-coded entry literal is locally asserted to the imported enum type because the boundary requires a type-only import; it is not a new state vocabulary. Tests compare it with `AccountingMissionStatus.DRAFT`. |
| Transition validation without runtime coupling | Define `CanonicalTransitionValidator = typeof validateTransition` through a type-only import. `createWorkResult`, `validateWorkResult`, and `advanceWorkUnit` receive that validator as an argument and call it before returning an accepted value. | Directly importing `validateTransition` would violate the type-only boundary. Re-encoding `VALID_TRANSITIONS` in routing would create a second state machine. Dependency injection keeps the production import type-only while requiring composition to provide the exact Core-compatible signature. Tests pass the real `missions.validateTransition`; a rejecting or absent validator fails closed. |
| Mission-derived construction | `createWorkUnit(mission, input)` derives `missionId`, `companyId`, `period`, `intent`, and initial `stage` from the `MissionSnapshot`; callers provide tenant, RUC, company display identity, and routing-specific constraints. | `MissionSnapshot` actually exposes `id`, `companyId`, `fiscalPeriod`, `intent`, and `status`. Deriving those fields prevents callers from supplying conflicting mission linkage. RUC and tenant are not present in the snapshot and therefore remain explicit routing inputs. |
| Scope representation | Use a flat, immutable `WorkScope` containing `tenantId`, `ruc`, `companyId`, optional `companyName`, `period`, and `intent`. | It preserves the complete scope required by the specification while agreeing with the actual mission and candidate fields. `ruc` and `period` follow `CandidateScope`; intent follows `MissionIntent`. |
| JSON-integer bounds | Use branded `JsonInteger` for non-negative integer quantities, plus literal bounds `ResearchAttemptLimit = 1 | 2 | 3` and `CorrectionAttemptLimit = 1`. Construction helpers create brands only after `Number.isSafeInteger` checks. | TypeScript `number` alone admits floats. Literal attempt types make the configured maxima unrepresentable outside the approved bounds. Validation concerns configuration shape and bounds only; consuming/enforcing a budget during execution remains out of scope. |
| Monetary representation | Every cost field is `bigint` cents and is named with a `Cents` suffix. | This matches the fiscal convention and `candidates/types.ts` `MaterialityInput.value`. JavaScript `number` is not accepted for monetary values. |
| Evidence identity | Represent evidence as `{ algorithm: "sha256"; hash: Sha256Hash }`. `createEvidenceRef(bytes)` computes SHA-256 over the exact bytes with `node:crypto`; `parseSha256Hash` accepts only 64 lowercase hexadecimal characters. | This prevents memory IDs or explanations from masquerading as evidence. `node:crypto` is the only permitted runtime dependency for library modules. |
| Candidate proposal identity | Each proposal is a `Pick<Candidate, "id" | "subjectHash" | "scope" | "materiality">` plus `materialityBasis: MaterialityInput`. | The real `Candidate` carries `subjectHash` but not its `BigInt` value, reversibility, or jurisdiction. Pairing the candidate reference with the real `MaterialityInput` preserves identity and makes the authoritative materiality inputs structured rather than agent prose. |
| Typed stop reasons | Define one closed discriminated union, `WorkStopReason`, and use its `kind` values in `WorkUnit.stopConditions`. A stopped or failed result must carry a member of that union. Explanation is a separate optional non-authoritative field. | A discriminated union makes unknown stop kinds fail typechecking. Runtime helpers reject empty stop conditions and malformed reason payloads rather than accepting free text. |
| Structured outcome | Make `WorkOutcome` a discriminated union: `SUCCEEDED`, `STOPPED`, or `FAILED`. Only stopped/failed outcomes carry typed stop reasons; no free-text field can establish status or authority. | This keeps outcome authority structured and still permits an optional top-level explanation for human context. |
| Validation API | Helpers return `ValidationResult<T>` rather than silently coercing values. All invalid inputs return typed issues; construction returns no partial envelope. Hashing is deterministic; transition callback exceptions are translated into an `INVALID_TRANSITION` issue. | Explicit result handling is fail-closed and transport-neutral. Throwing remains confined to the injected Core validator and `node:crypto`; routing callers receive a stable result union. |
| No router in Slice A+B | Do not define route kinds, materiality thresholds, direct/agent/mission selection, or §5 policy tables. | Those decisions belong to Slice C. Adding route policy now would widen this type-surface slice and prematurely freeze router behavior. |

## 3. Public type surface

The following signatures are the intended contract. Names may be documented further during implementation, but their authority and dependency semantics must not change.

```ts
// routing/types.ts
import type {
  AccountingException,
  AccountingMissionStatus,
  MissionIntent,
  MissionSnapshot,
  validateTransition,
} from "../missions/index.js";
import type {
  Candidate,
  CandidateScope,
  MaterialityInput,
} from "../candidates/index.js";

export type CanonicalTransitionValidator = typeof validateTransition;

export type JsonInteger = number & { readonly __brand: "JsonInteger" };
export type Sha256Hash = string & { readonly __brand: "Sha256Hash" };
export type ResearchAttemptLimit = 1 | 2 | 3;
export type CorrectionAttemptLimit = 1;

export interface EvidenceRef {
  readonly algorithm: "sha256";
  readonly hash: Sha256Hash;
}

export interface VersionPin {
  readonly id: string;
  readonly version: string;
  readonly contentHash?: Sha256Hash;
}

export interface WorkScope {
  readonly tenantId: string;
  readonly ruc: CandidateScope["ruc"];
  readonly companyId: MissionSnapshot["companyId"];
  readonly companyName?: string;
  readonly period: CandidateScope["period"];
  readonly intent: MissionIntent;
}

export interface AuthorizedTool {
  readonly id: string;
  readonly version: string;
  readonly operations: readonly string[];
}

export interface AuthorizedDestination {
  readonly kind: "CORE" | "EVIDENCE_STORE" | "REVIEW_QUEUE";
  readonly id: string;
}

export interface OutputSchemaRef {
  readonly id: string;
  readonly version: string;
  readonly contentHash: Sha256Hash;
}

export type SuccessCondition =
  | {
      readonly kind: "OUTPUT_SCHEMA_VALID";
      readonly schema: OutputSchemaRef;
    }
  | {
      readonly kind: "EVIDENCE_HASHES_PRESENT";
      readonly required: readonly Sha256Hash[];
    }
  | {
      readonly kind: "CANDIDATE_SUBJECT_HASH_PRODUCED";
      readonly minimumCount: JsonInteger;
    };

export interface WorkBudgets {
  readonly timeLimitMs: JsonInteger;
  readonly tokenLimit: JsonInteger;
  readonly costLimitCents: bigint;
  readonly researchAttemptLimit: ResearchAttemptLimit;
  readonly correctionAttemptLimit: CorrectionAttemptLimit;
}

export type WorkStopReason =
  | {
      readonly kind: "MISSING_EVIDENCE";
      readonly requiredHashes: readonly Sha256Hash[];
    }
  | {
      readonly kind: "POLICY_BLOCKED";
      readonly policy: VersionPin;
    }
  | {
      readonly kind: "APPROVAL_REQUIRED";
      readonly approvalType: string;
    }
  | {
      readonly kind: "BUDGET_EXHAUSTED";
      readonly budget: "TIME" | "TOKENS" | "COST" | "RESEARCH_ATTEMPTS" | "CORRECTION";
    }
  | {
      readonly kind: "SCOPE_MISMATCH";
      readonly fields: readonly (keyof WorkScope)[];
    }
  | {
      readonly kind: "INVALID_TRANSITION";
      readonly from: AccountingMissionStatus;
      readonly to: AccountingMissionStatus;
    }
  | {
      readonly kind: "EXTERNAL_SYSTEM_UNAVAILABLE";
      readonly systemId: string;
    }
  | {
      readonly kind: "AMBIGUOUS_INPUT";
      readonly fields: readonly string[];
    }
  | {
      readonly kind: "UNSUPPORTED_WORK";
      readonly intent: MissionIntent;
    };

export type WorkStopReasonKind = WorkStopReason["kind"];

export interface WorkUnit {
  readonly id: string;
  readonly missionId: MissionSnapshot["id"];
  readonly objective: string;
  readonly stage: AccountingMissionStatus;
  readonly scope: WorkScope;
  readonly evidenceAllowed: readonly EvidenceRef[];
  readonly skills: readonly VersionPin[];
  readonly policies: readonly VersionPin[];
  readonly authorizedTools: readonly AuthorizedTool[];
  readonly authorizedDestinations: readonly AuthorizedDestination[];
  readonly outputSchema: OutputSchemaRef;
  readonly budgets: WorkBudgets;
  readonly successConditions: readonly SuccessCondition[];
  readonly stopConditions: readonly WorkStopReasonKind[];
}

export interface ProposedCandidateRef
  extends Pick<Candidate, "id" | "subjectHash" | "scope" | "materiality"> {
  readonly materialityBasis: MaterialityInput;
}

export type WorkOutcome =
  | { readonly kind: "SUCCEEDED" }
  | { readonly kind: "STOPPED"; readonly reason: WorkStopReason }
  | { readonly kind: "FAILED"; readonly reason: WorkStopReason };

export interface ToolProvenance {
  readonly toolId: string;
  readonly version: string;
  readonly operation: string;
  readonly outputHash: Sha256Hash;
}

export interface CostAndAttempts {
  readonly costIncurredCents: bigint;
  readonly researchAttempts: JsonInteger;
  readonly correctionAttempts: JsonInteger;
}

export interface NextTransition {
  readonly from: AccountingMissionStatus;
  readonly to: AccountingMissionStatus;
}

export interface WorkResult {
  readonly workUnitId: WorkUnit["id"];
  readonly missionId: WorkUnit["missionId"];
  readonly outcome: WorkOutcome;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly proposedCandidates: readonly ProposedCandidateRef[];
  readonly unresolvedExceptions: readonly AccountingException[];
  readonly policyVersions: readonly VersionPin[];
  readonly toolProvenance: readonly ToolProvenance[];
  readonly costAndAttempts: CostAndAttempts;
  readonly nextTransition: NextTransition;
  readonly explanation?: string; // non-authoritative
}
```

## 4. Construction and validation helpers

```ts
// routing/helpers.ts
import { createHash } from "node:crypto";
import type { MissionSnapshot } from "../missions/index.js";
import type {
  Candidate,
  MaterialityInput,
} from "../candidates/index.js";
import type {
  CanonicalTransitionValidator,
  EvidenceRef,
  JsonInteger,
  NextTransition,
  ProposedCandidateRef,
  Sha256Hash,
  WorkResult,
  WorkUnit,
} from "./types.js";

export interface ValidationIssue {
  readonly code:
    | "INVALID_ID"
    | "INVALID_SCOPE"
    | "INVALID_HASH"
    | "INVALID_INTEGER"
    | "INVALID_BUDGET"
    | "MISSING_CONDITION"
    | "INVALID_STOP_REASON"
    | "INVALID_TRANSITION"
    | "MISSION_MISMATCH";
  readonly path: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export type WorkUnitInput = Omit<
  WorkUnit,
  "missionId" | "stage" | "scope"
> & {
  readonly scope: Pick<WorkUnit["scope"], "tenantId" | "ruc" | "companyName">;
};

export type WorkResultInput = Omit<WorkResult, "workUnitId" | "missionId"> & {
  readonly workUnitId?: never;
  readonly missionId?: never;
};

export function toJsonInteger(value: number): ValidationResult<JsonInteger>;
export function parseSha256Hash(value: string): ValidationResult<Sha256Hash>;
export function createEvidenceRef(bytes: Uint8Array): EvidenceRef;

export function createWorkUnit(
  mission: MissionSnapshot,
  input: WorkUnitInput,
): ValidationResult<WorkUnit>;

export function validateWorkUnit(
  unit: WorkUnit,
  mission: MissionSnapshot,
): ValidationResult<WorkUnit>;

export function advanceWorkUnit(
  unit: WorkUnit,
  to: WorkUnit["stage"],
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkUnit>;

export function createProposedCandidateRef(
  candidate: Candidate,
  materialityBasis: MaterialityInput,
): ValidationResult<ProposedCandidateRef>;

export function createWorkResult(
  unit: WorkUnit,
  input: WorkResultInput,
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkResult>;

export function validateWorkResult(
  result: WorkResult,
  unit: WorkUnit,
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkResult>;
```

### Helper invariants

1. `createWorkUnit` derives `missionId`, `companyId`, `period`, and `intent` from the mission and sets `stage` to canonical `DRAFT`; it never trusts duplicate caller values.
2. It rejects a mission whose `companyId` or `fiscalPeriod` cannot form the declared scope, invalid RUC/period shapes, empty identities/objective/schema/conditions, malformed hashes, negative costs, unsafe or floating-point counters, research limits outside `1..3`, and correction limits other than `1`.
3. `advanceWorkUnit` invokes the supplied canonical validator before returning an immutable copy. Validator rejection returns `INVALID_TRANSITION`; the original unit is unchanged.
4. `createEvidenceRef` hashes the exact supplied bytes. It does not accept memory keys, URLs, or prose.
5. `createProposedCandidateRef` copies identity and materiality from a real `Candidate`, requires a non-negative `bigint` value, and preserves reversibility and jurisdiction as structured fields.
6. `createWorkResult` derives `workUnitId` and `missionId` from the `WorkUnit`, requires `nextTransition.from === unit.stage`, and invokes the canonical validator for the pair. It rejects costs expressed outside `bigint`, floating/unsafe attempt counts, malformed evidence/tool hashes, candidate scope mismatch, unpinned policy versions, and stopped/failed outcomes without a typed reason.
7. `validateWorkResult` never infers authority from `explanation`; removing or changing explanation cannot change validation.
8. Helpers validate declared budget values but do not track elapsed time, token consumption, cost consumption, retries, or corrections. Runtime enforcement remains deferred.

## 5. Data flow

```text
MissionSnapshot (Core-owned)
        + routing-specific constrained input
        |
        v
createWorkUnit() --structural validation--> WorkUnit(stage = DRAFT)
        |
        | advisory executor may read, but cannot authorize or mutate Core
        v
structured result input + Candidate references + exact evidence bytes/hashes
        |
        v
createWorkResult(..., canonical validateTransition callback)
        |
        +-- callback rejects pair --> ValidationResult failure (fail closed)
        |
        v
WorkResult with validated proposed transition
        |
        v
Core/authorized adapter independently decides and applies any transition
```

The callback proves compatibility at construction/validation time; it does not grant execution authority. A consumer must still submit an authorized Core operation. No routing helper writes state or calls an adapter.

## 6. Boundary compliance

### Production import allowlist

| File | Runtime imports | Type-only imports | Forbidden |
| --- | --- | --- | --- |
| `routing/types.ts` | None | `../missions/index.js`: `AccountingException`, `AccountingMissionStatus`, `MissionIntent`, `MissionSnapshot`, `validateTransition`; `../candidates/index.js`: `Candidate`, `CandidateScope`, `MaterialityInput` | Any `agents/`, `cmd/`, `adapters/`, stores, ledgers, receipts, journals, network, or third-party package |
| `routing/helpers.ts` | `node:crypto`: `createHash` | `../missions/index.js`: `MissionSnapshot`; `../candidates/index.js`: `Candidate`, `MaterialityInput`; local routing types | Runtime import from missions/candidates; all downstream surfaces |
| `routing/index.ts` | Re-export only | N/A | Any direct downstream dependency |
| package `index.ts` | Existing exports plus `export * from "./routing/index.js"` | N/A | No change to lower-level module imports |

`import type { validateTransition }` is intentional: `typeof validateTransition` captures the real function signature without loading mission runtime code. The callback value comes from the composition caller. Routing must not import `VALID_TRANSITIONS`, duplicate its map, or add a second recovery table.

### Reverse-import rule

No `missions/**`, `candidates/**`, or `agents/**` file changes in this slice. Tests must statically inspect routing production imports and scan `missions/` for routing imports. The package-root export does not create a reverse dependency because it is a top-level aggregation point.

### Side-effect rule

The only production side effect is local SHA-256 computation over caller-provided bytes. There is no filesystem, process, environment, clock, random, transport, network, store, ledger, receipt, journal, approval, authorization, or adapter access.

## 7. File-by-file change plan

| File | Change | Estimated changed lines |
| --- | --- | ---: |
| `routing/types.ts` | Add all immutable routing contracts, bounded integer/literal types, typed stop reasons, candidate/evidence references, and transition-validator type alias. | 115–135 |
| `routing/helpers.ts` | Add deterministic hash, integer/hash parsing, mission-derived construction, structural validation, immutable stage advance, candidate reference, and WorkResult validation helpers. | 75–95 |
| `routing/index.ts` | Public type and helper exports. | 5–8 |
| `index.ts` | Add the routing module to the package public surface. | 1 |
| `routing/__tests__/work-unit.test.ts` | Mission-derived construction, all-state transition matrix, budgets, scope, hashes, and stop-reason cases. | 40–50 |
| `routing/__tests__/work-result.test.ts` | Structured result, candidate identity/materiality basis, evidence, cost/attempt, transition, and explanation cases. | 40–50 |
| `routing/__tests__/boundary.test.ts` | Import allowlist, type-only checks, no reverse imports, no side effects, deterministic/offline assertions. | 20–28 |
| **Estimated total** | Slice A+B only. | **296–367** |

Implementation must target **300–390 lines**. If the forecast exceeds 400, reduce test fixture duplication or split at the WorkUnit/WorkResult boundary; do not omit scenarios or widen the slice.

## 8. Test plan

Strict TDD applies: add failing conformance tests first, implement the minimum surface, triangulate invalid cases, then refactor without changing behavior. Run `bun run typecheck`, focused Vitest tests, and the existing mission/agent/candidate suites before the full `bun run test`.

### `routing/__tests__/work-unit.test.ts`

- **Mission construction:** build from a real `MissionSnapshot`; assert mission id, company id, period, and intent are derived and initial stage equals `AccountingMissionStatus.DRAFT`.
- **Scope mismatch:** reject invalid 11-digit RUC, invalid `YYYYMM`, empty tenant/company identity, and any mission/scope mismatch.
- **All 15 states:** assert the canonical enum has exactly the 15 specified values. For every source/target pair, pass the real `validateTransition` to `advanceWorkUnit`; acceptance must equal the real `VALID_TRANSITIONS` matrix. Include `QUEUED -> RUNNING` accepted and `QUEUED -> COMPLETED` rejected.
- **Recovery:** verify `UNKNOWN -> RUNNING|FAILED|COMPLETED` is accepted by the same canonical validator and every other `UNKNOWN` target is rejected.
- **Budget representation:** accept positive `bigint` cents, research limits `1|2|3`, and correction limit `1`; reject negative cents, floating/unsafe counters, research `0`/`4`, and any correction value other than `1` at the runtime validation boundary.
- **Typed stop reasons:** cover each discriminant at least once; compile-time fixtures use `@ts-expect-error` for an unknown kind, while runtime validation rejects malformed payloads and empty free-text-only stops.
- **Evidence allowlist:** hash known bytes and compare with the known SHA-256 vector; reject malformed hashes and non-hash references.
- **Fail-closed construction:** any issue returns `{ ok: false }` and no partial `WorkUnit`.

### `routing/__tests__/work-result.test.ts`

- **BigInt costs and integer attempts:** accept `bigint` cents and safe integer counts; reject number/float costs through type fixtures and floating/unsafe counters at runtime validation.
- **Evidence provenance:** known bytes produce the exact expected SHA-256; memory keys, prose, and malformed strings cannot become `EvidenceRef`.
- **Candidate identity:** construct from a real `Candidate`, preserve `subjectHash`, scope, and materiality, and require `MaterialityInput.value` as `bigint` with structured reversibility and jurisdiction.
- **Candidate mismatch:** reject a candidate whose RUC/period differs from the WorkUnit scope or whose subject hash is malformed.
- **Transition consistency:** with the real `validateTransition`, accept `RUNNING -> AWAITING_APPROVAL`, all other canonical pairs, and recovery pairs; reject absent pairs and a `from` value that differs from the WorkUnit stage.
- **Typed outcomes:** `STOPPED` and `FAILED` require a valid `WorkStopReason`; `SUCCEEDED` carries no free-text authority.
- **No free-text authority:** changing `explanation` does not alter validation, amounts, candidate identity, policy pins, outcome, or transition.
- **Structured exceptions/provenance:** preserve canonical `AccountingException`, policy versions, tool operation/version, and output hashes without coercion.

### `routing/__tests__/boundary.test.ts`

- Parse or inspect production routing source imports and assert the exact allowlist above.
- Assert all imports from `missions/` and `candidates/` use `import type`.
- Assert no production routing source mentions `agents/`, `cmd/`, `adapters/`, ledger, receipt, journal, store, network, or external package imports.
- Scan `missions/**/*.ts` and assert no import from `routing/`; compare canonical status count and transition behavior to prove the Core was not changed.
- Run the focused suite twice with fixed fixtures; no test uses clock, randomness, network, transport, or external services.

### Existing behavior regression

Run the existing mission and agent handler tests unchanged. `IntentHandler.execute` currently returns a staged `MissionSnapshot | null`, and `PlanIntentHandler` advances one legal state per call while Core validates the transition. Routing must not be wired into this contract in Slice A+B. Candidate lifecycle and materiality tests also run unchanged.

## 9. Rollout and rollback

This slice has no migration or persisted state. Rollout consists only of publishing the additive routing exports after typecheck and conformance tests pass. Existing consumers are unaffected until they explicitly import the new module.

Rollback removes the root export and `routing/` files. No mission state, candidate, ledger, receipt, journal, or authorization record requires repair because this slice creates none.

## 10. Risks retained for implementation

- Type-only enum usage requires one localized assertion for the canonical `DRAFT` literal. Keep it private to `helpers.ts` and prove it against the real enum in tests; do not export a second status constant set.
- The injected transition callback must be the Core validator at composition sites. Its `typeof validateTransition` signature prevents incompatible call shapes, while conformance tests bind the real function. It still does not authorize applying the transition.
- Source-line estimates are near the 400-line review threshold. Shared fixtures and table-driven transition tests should control duplication; if the implementation forecast exceeds 400, split A and B rather than weakening coverage.
- This pure type surface validates values already in memory. Parsing untrusted transport JSON, including BigInt serialization, remains a transport concern and is not introduced here.
