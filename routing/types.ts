/**
 * Routing type surface — organic accounting work routing (SDD-030, slice A+B).
 *
 * Transport-agnostic WorkUnit request envelope and WorkResult structured result
 * boundary. Advisory only: captures scope, evidence provenance, pinned skills
 * and policies, bounded attempts, candidate identity, and deterministic
 * transition compatibility without executing work, writing ledgers, or
 * changing authorization.
 *
 * Fiscal convention: monetary values are BigInt cents; sequence/index/version
 * fields are JSON integers; no float is ever used for money.
 *
 * Boundary: type-only imports from missions/ and candidates/ only. No agents/,
 * commands, adapters, stores, ledgers, receipts, journals, or transport code.
 */
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

/**
 * The canonical Core transition function, injected by the composition caller.
 * Routing never imports or duplicates VALID_TRANSITIONS.
 */
export type CanonicalTransitionValidator = typeof validateTransition;

/** Branded non-negative JSON integer (never a float, never unsafe). */
export type JsonInteger = number & { readonly __brand: "JsonInteger" };
/** Branded 64-character lowercase hexadecimal SHA-256 digest. */
export type Sha256Hash = string & { readonly __brand: "Sha256Hash" };

/** Research/technical execution attempt maximum: 1..3. */
export type ResearchAttemptLimit = 1 | 2 | 3;
/** Frozen-candidate correction maximum: exactly 1. */
export type CorrectionAttemptLimit = 1;

/** Evidence allowed by content hash over the exact bytes. */
export interface EvidenceRef {
  readonly algorithm: "sha256";
  readonly hash: Sha256Hash;
}

/** A skill or policy pinned by id and version. */
export interface VersionPin {
  readonly id: string;
  readonly version: string;
  readonly contentHash?: Sha256Hash;
}

/** Full fiscal scope of one unit of work. */
export interface WorkScope {
  readonly tenantId: string;
  readonly ruc: CandidateScope["ruc"];
  readonly companyId: MissionSnapshot["companyId"];
  readonly companyName?: string;
  readonly period: CandidateScope["period"];
  readonly intent: MissionIntent;
}

/** A tool the work is authorized to use. */
export interface AuthorizedTool {
  readonly id: string;
  readonly version: string;
  readonly operations: readonly string[];
}

/** A destination the work may propose output for. */
export interface AuthorizedDestination {
  readonly kind: "CORE" | "EVIDENCE_STORE" | "REVIEW_QUEUE";
  readonly id: string;
}

/** Mandatory output schema reference. */
export interface OutputSchemaRef {
  readonly id: string;
  readonly version: string;
  readonly contentHash: Sha256Hash;
}

/** Verifiable success condition for the unit. */
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

/** Distinct typed budgets; runtime enforcement is deferred to a later slice. */
export interface WorkBudgets {
  readonly timeLimitMs: JsonInteger;
  readonly tokenLimit: JsonInteger;
  readonly costLimitCents: bigint;
  readonly researchAttemptLimit: ResearchAttemptLimit;
  readonly correctionAttemptLimit: CorrectionAttemptLimit;
}

/** Closed union of typed stop reasons; free text is never authoritative. */
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

/** Discriminant values of the closed stop-reason union. */
export type WorkStopReasonKind = WorkStopReason["kind"];

/** One bounded unit of accounting work. */
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

/** Proposed candidate identified by subjectHash with structured materiality. */
export interface ProposedCandidateRef
  extends Pick<Candidate, "id" | "subjectHash" | "scope" | "materiality"> {
  readonly materialityBasis: MaterialityInput;
}

/** Structured outcome; only stopped/failed outcomes carry a typed reason. */
export type WorkOutcome =
  | { readonly kind: "SUCCEEDED" }
  | { readonly kind: "STOPPED"; readonly reason: WorkStopReason }
  | { readonly kind: "FAILED"; readonly reason: WorkStopReason };

/** Provenance of one tool operation. */
export interface ToolProvenance {
  readonly toolId: string;
  readonly version: string;
  readonly operation: string;
  readonly outputHash: Sha256Hash;
}

/** Cost and attempt accounting in the fiscal convention. */
export interface CostAndAttempts {
  readonly costIncurredCents: bigint;
  readonly researchAttempts: JsonInteger;
  readonly correctionAttempts: JsonInteger;
}

/** Proposed next mission stage, validated against the canonical matrix. */
export interface NextTransition {
  readonly from: AccountingMissionStatus;
  readonly to: AccountingMissionStatus;
}

/**
 * Structured result of one WorkUnit. Authoritative values are structured
 * fields only; explanation is optional non-authoritative free text.
 */
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
