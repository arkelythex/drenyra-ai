/**
 * Routing helpers — deterministic construction and validation (SDD-030, A+B).
 *
 * node:crypto is the only runtime dependency. Helpers validate declared budget
 * values but never track elapsed time, token/cost consumption, retries, or
 * corrections: runtime enforcement is deferred to a later slice.
 *
 * Fail-closed: invalid inputs return typed issues and no partial envelope.
 */
import { createHash } from "node:crypto";
import type {
  AccountingException,
  AccountingMissionStatus,
  MissionSnapshot,
} from "../missions/index.js";
import type { Candidate, MaterialityInput } from "../candidates/index.js";
import type {
  CanonicalTransitionValidator,
  EvidenceRef,
  JsonInteger,
  OutputSchemaRef,
  ProposedCandidateRef,
  Sha256Hash,
  SuccessCondition,
  ToolProvenance,
  VersionPin,
  WorkBudgets,
  WorkOutcome,
  WorkResult,
  WorkScope,
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
    | "MISSION_MISMATCH"
    | "AMBIGUOUS_INPUT";
  readonly path: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export type WorkUnitInput = Omit<WorkUnit, "missionId" | "stage" | "scope"> & {
  readonly scope: Pick<WorkUnit["scope"], "tenantId" | "ruc" | "companyName">;
};

export type WorkResultInput = Omit<WorkResult, "workUnitId" | "missionId"> & {
  readonly workUnitId?: never;
  readonly missionId?: never;
};

const RUC_RE = /^\d{11}$/;
const PERIOD_RE = /^\d{6}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const STOP_KINDS: readonly string[] = [
  "MISSING_EVIDENCE",
  "POLICY_BLOCKED",
  "APPROVAL_REQUIRED",
  "BUDGET_EXHAUSTED",
  "SCOPE_MISMATCH",
  "INVALID_TRANSITION",
  "EXTERNAL_SYSTEM_UNAVAILABLE",
  "AMBIGUOUS_INPUT",
  "UNSUPPORTED_WORK",
];
const DEST_KINDS: readonly string[] = ["CORE", "EVIDENCE_STORE", "REVIEW_QUEUE"];
const BUDGET_LABELS: readonly string[] = [
  "TIME",
  "TOKENS",
  "COST",
  "RESEARCH_ATTEMPTS",
  "CORRECTION",
];
const REVERSIBILITY: readonly string[] = [
  "reversible",
  "partially-reversible",
  "irreversible",
];
const SUCCESS_KINDS: readonly string[] = [
  "OUTPUT_SCHEMA_VALID",
  "EVIDENCE_HASHES_PRESENT",
  "CANDIDATE_SUBJECT_HASH_PRODUCED",
];

/**
 * Canonical entry state, locally asserted to the imported enum type. This is
 * not a parallel state vocabulary: tests prove it equals
 * AccountingMissionStatus.DRAFT and the matrix above it is the real Core one.
 */
const INITIAL_STAGE = "DRAFT" as AccountingMissionStatus;

function fail(issues: ValidationIssue[], code: ValidationIssue["code"], path: string): void {
  issues.push({ code, path });
}

function isEmpty(value: unknown): boolean {
  return typeof value !== "string" || value.length === 0;
}

function isValidJsonInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyStringArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((x) => typeof x === "string" && x.length > 0)
  );
}

function checkHash(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !HASH_RE.test(value)) fail(issues, "INVALID_HASH", path);
}

function checkVersionPin(pin: VersionPin, path: string, issues: ValidationIssue[]): void {
  if (isEmpty(pin.id) || isEmpty(pin.version)) fail(issues, "INVALID_ID", path);
  if (pin.contentHash !== undefined) checkHash(pin.contentHash, `${path}.contentHash`, issues);
}

function checkEvidenceRef(ref: EvidenceRef, path: string, issues: ValidationIssue[]): void {
  if (ref.algorithm !== "sha256") fail(issues, "INVALID_HASH", `${path}.algorithm`);
  checkHash(ref.hash, `${path}.hash`, issues);
}

function checkOutputSchema(schema: OutputSchemaRef, path: string, issues: ValidationIssue[]): void {
  if (isEmpty(schema.id) || isEmpty(schema.version)) fail(issues, "INVALID_ID", path);
  checkHash(schema.contentHash, `${path}.contentHash`, issues);
}

function checkBudgets(budgets: WorkBudgets, path: string, issues: ValidationIssue[]): void {
  if (typeof budgets.costLimitCents !== "bigint" || budgets.costLimitCents < 0n) {
    fail(issues, "INVALID_BUDGET", `${path}.costLimitCents`);
  }
  if (!isValidJsonInteger(budgets.timeLimitMs)) fail(issues, "INVALID_INTEGER", `${path}.timeLimitMs`);
  if (!isValidJsonInteger(budgets.tokenLimit)) fail(issues, "INVALID_INTEGER", `${path}.tokenLimit`);
  if (budgets.researchAttemptLimit !== 1 && budgets.researchAttemptLimit !== 2 && budgets.researchAttemptLimit !== 3) {
    fail(issues, "INVALID_BUDGET", `${path}.researchAttemptLimit`);
  }
  if (budgets.correctionAttemptLimit !== 1) {
    fail(issues, "INVALID_BUDGET", `${path}.correctionAttemptLimit`);
  }
}

function checkSuccessCondition(condition: SuccessCondition, path: string, issues: ValidationIssue[]): void {
  if (typeof condition !== "object" || condition === null) {
    fail(issues, "MISSING_CONDITION", path);
    return;
  }
  if (!SUCCESS_KINDS.includes(condition.kind)) {
    fail(issues, "MISSING_CONDITION", `${path}.kind`);
    return;
  }
  switch (condition.kind) {
    case "OUTPUT_SCHEMA_VALID":
      checkOutputSchema(condition.schema, `${path}.schema`, issues);
      break;
    case "EVIDENCE_HASHES_PRESENT":
      if (!Array.isArray(condition.required) || condition.required.length === 0) {
        fail(issues, "MISSING_CONDITION", `${path}.required`);
      } else {
        condition.required.forEach((h, i) => checkHash(h, `${path}.required[${i}]`, issues));
      }
      break;
    case "CANDIDATE_SUBJECT_HASH_PRODUCED":
      if (!isValidJsonInteger(condition.minimumCount)) {
        fail(issues, "INVALID_INTEGER", `${path}.minimumCount`);
      }
      break;
  }
}

function checkStopReasonKind(kind: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof kind !== "string" || !STOP_KINDS.includes(kind)) {
    fail(issues, "INVALID_STOP_REASON", path);
  }
}

function checkStopReason(reason: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof reason !== "object" || reason === null) {
    fail(issues, "INVALID_STOP_REASON", path);
    return;
  }
  const record = reason as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== "string" || !STOP_KINDS.includes(kind)) {
    fail(issues, "INVALID_STOP_REASON", `${path}.kind`);
    return;
  }
  switch (kind) {
    case "MISSING_EVIDENCE": {
      const hashes = record.requiredHashes;
      if (!Array.isArray(hashes) || hashes.length === 0) {
        fail(issues, "INVALID_STOP_REASON", `${path}.requiredHashes`);
      } else {
        hashes.forEach((h, i) => checkHash(h, `${path}.requiredHashes[${i}]`, issues));
      }
      break;
    }
    case "POLICY_BLOCKED":
      if (typeof record.policy !== "object" || record.policy === null) {
        fail(issues, "INVALID_STOP_REASON", `${path}.policy`);
      } else {
        checkVersionPin(record.policy as VersionPin, `${path}.policy`, issues);
      }
      break;
    case "APPROVAL_REQUIRED":
      if (isEmpty(record.approvalType)) fail(issues, "INVALID_STOP_REASON", `${path}.approvalType`);
      break;
    case "BUDGET_EXHAUSTED":
      if (typeof record.budget !== "string" || !BUDGET_LABELS.includes(record.budget)) {
        fail(issues, "INVALID_STOP_REASON", `${path}.budget`);
      }
      break;
    case "SCOPE_MISMATCH":
      if (!isNonEmptyStringArray(record.fields)) fail(issues, "INVALID_STOP_REASON", `${path}.fields`);
      break;
    case "INVALID_TRANSITION":
      if (isEmpty(record.from) || isEmpty(record.to)) fail(issues, "INVALID_STOP_REASON", path);
      break;
    case "EXTERNAL_SYSTEM_UNAVAILABLE":
      if (isEmpty(record.systemId)) fail(issues, "INVALID_STOP_REASON", `${path}.systemId`);
      break;
    case "AMBIGUOUS_INPUT":
      if (!isNonEmptyStringArray(record.fields)) fail(issues, "INVALID_STOP_REASON", `${path}.fields`);
      break;
    case "UNSUPPORTED_WORK":
      if (isEmpty(record.intent)) fail(issues, "INVALID_STOP_REASON", `${path}.intent`);
      break;
    default:
      fail(issues, "INVALID_STOP_REASON", path);
  }
}

function checkOutcome(outcome: WorkOutcome, path: string, issues: ValidationIssue[]): void {
  if (outcome.kind === "SUCCEEDED") {
    if ("reason" in outcome) fail(issues, "INVALID_STOP_REASON", `${path}.reason`);
    return;
  }
  checkStopReason(outcome.reason, `${path}.reason`, issues);
}

function checkToolProvenance(tool: ToolProvenance, path: string, issues: ValidationIssue[]): void {
  if (isEmpty(tool.toolId) || isEmpty(tool.version) || isEmpty(tool.operation)) {
    fail(issues, "INVALID_ID", path);
  }
  checkHash(tool.outputHash, `${path}.outputHash`, issues);
}

function checkException(exception: AccountingException, path: string, issues: ValidationIssue[]): void {
  if (
    isEmpty(exception.id) ||
    isEmpty(exception.missionId) ||
    isEmpty(exception.code) ||
    isEmpty(exception.severity) ||
    isEmpty(exception.subjectRef) ||
    isEmpty(exception.resolutionStatus) ||
    !Array.isArray(exception.evidenceRefs)
  ) {
    fail(issues, "INVALID_ID", path);
  }
}

function checkUnitShape(unit: WorkUnit, issues: ValidationIssue[]): void {
  if (isEmpty(unit.id)) fail(issues, "INVALID_ID", "id");
  if (isEmpty(unit.missionId)) fail(issues, "INVALID_ID", "missionId");
  if (isEmpty(unit.objective)) fail(issues, "INVALID_ID", "objective");
  const scope = unit.scope;
  if (isEmpty(scope.tenantId)) fail(issues, "INVALID_SCOPE", "scope.tenantId");
  if (typeof scope.ruc !== "string" || !RUC_RE.test(scope.ruc)) fail(issues, "INVALID_SCOPE", "scope.ruc");
  if (isEmpty(scope.companyId)) fail(issues, "INVALID_SCOPE", "scope.companyId");
  if (scope.companyName !== undefined && (typeof scope.companyName !== "string" || scope.companyName.length === 0)) {
    fail(issues, "INVALID_SCOPE", "scope.companyName");
  }
  if (typeof scope.period !== "string" || !PERIOD_RE.test(scope.period)) fail(issues, "INVALID_SCOPE", "scope.period");
  if (isEmpty(scope.intent)) fail(issues, "INVALID_SCOPE", "scope.intent");
  if (!Array.isArray(unit.evidenceAllowed)) fail(issues, "INVALID_HASH", "evidenceAllowed");
  else unit.evidenceAllowed.forEach((ref, i) => checkEvidenceRef(ref, `evidenceAllowed[${i}]`, issues));
  if (!Array.isArray(unit.skills)) fail(issues, "INVALID_ID", "skills");
  else unit.skills.forEach((pin, i) => checkVersionPin(pin, `skills[${i}]`, issues));
  if (!Array.isArray(unit.policies)) fail(issues, "INVALID_ID", "policies");
  else unit.policies.forEach((pin, i) => checkVersionPin(pin, `policies[${i}]`, issues));
  if (!Array.isArray(unit.authorizedTools)) fail(issues, "INVALID_ID", "authorizedTools");
  else
    unit.authorizedTools.forEach((tool, i) => {
      if (isEmpty(tool.id) || isEmpty(tool.version) || !Array.isArray(tool.operations) || tool.operations.length === 0) {
        fail(issues, "INVALID_ID", `authorizedTools[${i}]`);
      }
    });
  if (!Array.isArray(unit.authorizedDestinations)) fail(issues, "INVALID_SCOPE", "authorizedDestinations");
  else
    unit.authorizedDestinations.forEach((dest, i) => {
      if (typeof dest.kind !== "string" || !DEST_KINDS.includes(dest.kind) || isEmpty(dest.id)) {
        fail(issues, "INVALID_SCOPE", `authorizedDestinations[${i}]`);
      }
    });
  checkOutputSchema(unit.outputSchema, "outputSchema", issues);
  checkBudgets(unit.budgets, "budgets", issues);
  if (!Array.isArray(unit.successConditions) || unit.successConditions.length === 0) {
    fail(issues, "MISSING_CONDITION", "successConditions");
  } else {
    unit.successConditions.forEach((condition, i) => checkSuccessCondition(condition, `successConditions[${i}]`, issues));
  }
  if (!Array.isArray(unit.stopConditions) || unit.stopConditions.length === 0) {
    fail(issues, "INVALID_STOP_REASON", "stopConditions");
  } else {
    unit.stopConditions.forEach((kind, i) => checkStopReasonKind(kind, `stopConditions[${i}]`, issues));
  }
}

function assembleScope(
  mission: MissionSnapshot,
  input: Pick<WorkScope, "tenantId" | "ruc" | "companyName">,
): WorkScope {
  return {
    tenantId: input.tenantId,
    ruc: input.ruc,
    companyId: mission.companyId,
    period: mission.fiscalPeriod,
    intent: mission.intent,
    ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
  };
}

/** Brands a value as JsonInteger only after safe-integer checks. */
export function toJsonInteger(value: number): ValidationResult<JsonInteger> {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return { ok: false, issues: [{ code: "INVALID_INTEGER", path: "value" }] };
  }
  return { ok: true, value: value as JsonInteger };
}

/** Accepts only a 64-character lowercase hexadecimal SHA-256 digest. */
export function parseSha256Hash(value: string): ValidationResult<Sha256Hash> {
  if (typeof value !== "string" || !HASH_RE.test(value)) {
    return { ok: false, issues: [{ code: "INVALID_HASH", path: "value" }] };
  }
  return { ok: true, value: value as Sha256Hash };
}

/** SHA-256 over the exact supplied bytes; never accepts keys, URLs or prose. */
export function createEvidenceRef(bytes: Uint8Array): EvidenceRef {
  const hash = createHash("sha256").update(bytes).digest("hex") as Sha256Hash;
  return { algorithm: "sha256", hash };
}

/**
 * Constructs a WorkUnit from a mission snapshot. missionId, companyId, period,
 * intent, and the DRAFT entry stage are always derived from the mission.
 */
export function createWorkUnit(
  mission: MissionSnapshot,
  input: WorkUnitInput,
): ValidationResult<WorkUnit> {
  const value: WorkUnit = {
    ...input,
    missionId: mission.id,
    stage: INITIAL_STAGE,
    scope: assembleScope(mission, input.scope),
  };
  const issues: ValidationIssue[] = [];
  checkUnitShape(value, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value };
}

/** Re-validates a WorkUnit against its mission snapshot and the DRAFT entry stage. */
export function validateWorkUnit(
  unit: WorkUnit,
  mission: MissionSnapshot,
): ValidationResult<WorkUnit> {
  const issues: ValidationIssue[] = [];
  if (unit.missionId !== mission.id) fail(issues, "MISSION_MISMATCH", "missionId");
  if (
    unit.scope.companyId !== mission.companyId ||
    unit.scope.period !== mission.fiscalPeriod ||
    unit.scope.intent !== mission.intent
  ) {
    fail(issues, "MISSION_MISMATCH", "scope");
  }
  if (unit.stage !== INITIAL_STAGE) fail(issues, "INVALID_TRANSITION", "stage");
  checkUnitShape(unit, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: unit };
}

/**
 * Advances the unit's stage through the INJECTED canonical validator only. No
 * routing-local transition table exists; validator rejection returns an
 * INVALID_TRANSITION issue and the original unit is unchanged.
 */
export function advanceWorkUnit(
  unit: WorkUnit,
  to: WorkUnit["stage"],
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkUnit> {
  if (to === unit.stage) {
    return { ok: false, issues: [{ code: "INVALID_TRANSITION", path: "stage" }] };
  }
  try {
    validateTransition(unit.stage, to);
  } catch {
    return { ok: false, issues: [{ code: "INVALID_TRANSITION", path: "stage" }] };
  }
  return { ok: true, value: { ...unit, stage: to } };
}

/** Builds a proposed candidate reference from a real Candidate + MaterialityInput. */
export function createProposedCandidateRef(
  candidate: Candidate,
  materialityBasis: MaterialityInput,
): ValidationResult<ProposedCandidateRef> {
  const issues: ValidationIssue[] = [];
  checkHash(candidate.subjectHash, "subjectHash", issues);
  if (typeof materialityBasis.value !== "bigint" || materialityBasis.value < 0n) {
    fail(issues, "INVALID_BUDGET", "materialityBasis.value");
  }
  if (typeof materialityBasis.reversibility !== "string" || !REVERSIBILITY.includes(materialityBasis.reversibility)) {
    fail(issues, "INVALID_SCOPE", "materialityBasis.reversibility");
  }
  if (isEmpty(materialityBasis.jurisdiction)) fail(issues, "INVALID_SCOPE", "materialityBasis.jurisdiction");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      id: candidate.id,
      subjectHash: candidate.subjectHash,
      scope: candidate.scope,
      materiality: candidate.materiality,
      materialityBasis,
    },
  };
}

function checkProposedCandidateRef(
  candidate: ProposedCandidateRef,
  scope: WorkScope,
  path: string,
  issues: ValidationIssue[],
): void {
  if (isEmpty(candidate.id)) fail(issues, "INVALID_ID", `${path}.id`);
  checkHash(candidate.subjectHash, `${path}.subjectHash`, issues);
  if (candidate.scope.ruc !== scope.ruc || candidate.scope.period !== scope.period) {
    fail(issues, "INVALID_SCOPE", `${path}.scope`);
  }
  const basis = candidate.materialityBasis;
  if (typeof basis.value !== "bigint" || basis.value < 0n) {
    fail(issues, "INVALID_BUDGET", `${path}.materialityBasis.value`);
  }
  if (typeof basis.reversibility !== "string" || !REVERSIBILITY.includes(basis.reversibility)) {
    fail(issues, "INVALID_SCOPE", `${path}.materialityBasis.reversibility`);
  }
  if (isEmpty(basis.jurisdiction)) fail(issues, "INVALID_SCOPE", `${path}.materialityBasis.jurisdiction`);
}

function checkResultFields(
  result: WorkResult,
  unit: WorkUnit,
  validateTransition: CanonicalTransitionValidator,
  issues: ValidationIssue[],
): void {
  if (isEmpty(result.workUnitId) || result.workUnitId !== unit.id) {
    fail(issues, "MISSION_MISMATCH", "workUnitId");
  }
  if (isEmpty(result.missionId) || result.missionId !== unit.missionId) {
    fail(issues, "MISSION_MISMATCH", "missionId");
  }
  const next = result.nextTransition;
  if (next.from !== unit.stage) fail(issues, "INVALID_TRANSITION", "nextTransition.from");
  try {
    validateTransition(next.from, next.to);
  } catch {
    fail(issues, "INVALID_TRANSITION", "nextTransition.to");
  }
  checkOutcome(result.outcome, "outcome", issues);
  if (!Array.isArray(result.evidenceRefs)) fail(issues, "INVALID_HASH", "evidenceRefs");
  else result.evidenceRefs.forEach((ref, i) => checkEvidenceRef(ref, `evidenceRefs[${i}]`, issues));
  if (!Array.isArray(result.proposedCandidates)) fail(issues, "INVALID_SCOPE", "proposedCandidates");
  else
    result.proposedCandidates.forEach((candidate, i) =>
      checkProposedCandidateRef(candidate, unit.scope, `proposedCandidates[${i}]`, issues),
    );
  if (!Array.isArray(result.unresolvedExceptions)) fail(issues, "INVALID_ID", "unresolvedExceptions");
  else result.unresolvedExceptions.forEach((exception, i) => checkException(exception, `unresolvedExceptions[${i}]`, issues));
  if (!Array.isArray(result.policyVersions)) fail(issues, "INVALID_ID", "policyVersions");
  else result.policyVersions.forEach((pin, i) => checkVersionPin(pin, `policyVersions[${i}]`, issues));
  if (!Array.isArray(result.toolProvenance)) fail(issues, "INVALID_ID", "toolProvenance");
  else result.toolProvenance.forEach((tool, i) => checkToolProvenance(tool, `toolProvenance[${i}]`, issues));
  const costs = result.costAndAttempts;
  if (typeof costs.costIncurredCents !== "bigint" || costs.costIncurredCents < 0n) {
    fail(issues, "INVALID_BUDGET", "costAndAttempts.costIncurredCents");
  }
  if (!isValidJsonInteger(costs.researchAttempts)) fail(issues, "INVALID_INTEGER", "costAndAttempts.researchAttempts");
  if (!isValidJsonInteger(costs.correctionAttempts)) fail(issues, "INVALID_INTEGER", "costAndAttempts.correctionAttempts");
}

/** Constructs a WorkResult from a WorkUnit and structured result input. */
export function createWorkResult(
  unit: WorkUnit,
  input: WorkResultInput,
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkResult> {
  const value: WorkResult = { ...input, workUnitId: unit.id, missionId: unit.missionId };
  const issues: ValidationIssue[] = [];
  checkResultFields(value, unit, validateTransition, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value };
}

/**
 * Re-validates a WorkResult. Never infers authority from explanation: changing
 * or removing explanation cannot change validation.
 */
export function validateWorkResult(
  result: WorkResult,
  unit: WorkUnit,
  validateTransition: CanonicalTransitionValidator,
): ValidationResult<WorkResult> {
  const issues: ValidationIssue[] = [];
  checkResultFields(result, unit, validateTransition, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: result };
}
