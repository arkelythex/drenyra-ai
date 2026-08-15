/**
 * Deterministic preflight router (SDD-030, slice C).
 *
 * Given a closed, transport-agnostic RouteRequest carrying fiscal scope and the
 * eight §5 decision axes, `route()` selects the smallest route that preserves
 * evidence, authority, and recovery: direct-analysis, specialized-agent, or
 * durable-mission.
 *
 * Propose-only invariant: this module NEVER executes work, authorizes a tool or
 * destination, selects or applies a Core transition, creates or advances a
 * mission or WorkUnit, or writes a ledger, receipt, journal, evidence, store,
 * or network state. The decision is deterministic and offline: no clock,
 * randomness, environment, transport, or mutable process state influences it,
 * and ambiguous input fails closed with typed AMBIGUOUS_INPUT issues and no
 * guessed route.
 *
 * Boundary: type-only imports from the routing-local surface only (./types.js,
 * ./helpers.js). No agents/, commands, adapters, stores, ledgers, receipts,
 * journals, transports, or network clients. No local transition table and no
 * transition validator is injected or called: the router is not
 * transition-aware and the Core-owned 15-state machine remains frozen.
 */
import type {
  ApprovalRequirement,
  DurationAndInterruptibility,
  ExternalEvidence,
  RegulatoryObligations,
  RequestedEffect,
  Route,
  RouteRequest,
  SegregationOfDuties,
} from "./types.js";
import type { ValidationIssue, ValidationResult } from "./helpers.js";

/** Closed literal sets validated against the routing-local unions. */
const REQUESTED_EFFECTS: readonly RequestedEffect[] = [
  "read-only",
  "proposes-change",
  "core-governed-change",
];
const EXTERNAL_EVIDENCE: readonly ExternalEvidence[] = ["none", "bounded", "material"];
const DURATIONS: readonly DurationAndInterruptibility[] = [
  "immediate",
  "bounded-interruptible",
  "recoverable",
];
const SEGREGATION: readonly SegregationOfDuties[] = ["not-required", "required"];
const REGULATORY: readonly RegulatoryObligations[] = ["none", "applicable"];
const APPROVALS: readonly ApprovalRequirement[] = ["not-required", "required"];

/**
 * Materiality and reversibility values are owned by candidates/. The router may
 * not import them at runtime, so it carries the same closed values locally and
 * never derives or recalibrates materiality (no monetary threshold exists here).
 */
const MATERIALITY_TIERS: readonly string[] = ["R0", "R1", "R2", "R3"];
const REVERSIBILITIES: readonly string[] = [
  "reversible",
  "partially-reversible",
  "irreversible",
];

const REQUIRED_KEYS: readonly string[] = [
  "scope",
  "requestedEffect",
  "materiality",
  "reversibility",
  "externalEvidence",
  "durationAndInterruptibility",
  "systemsInvolved",
  "segregationOfDuties",
  "regulatoryObligations",
  "approval",
];

const SCOPE_KEYS: readonly string[] = [
  "tenantId",
  "ruc",
  "companyId",
  "companyName",
  "period",
  "intent",
];

const RUC_RE = /^\d{11}$/;
const PERIOD_RE = /^\d{6}$/;

function ambiguous(issues: ValidationIssue[], path: string): void {
  issues.push({ code: "AMBIGUOUS_INPUT", path });
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function hasUnknownKeys(
  keys: readonly string[],
  allowed: readonly string[],
  prefix: string,
  issues: ValidationIssue[],
): void {
  const unknown = keys.filter((key) => !allowed.includes(key)).sort();
  for (const key of unknown) ambiguous(issues, `${prefix}${key}`);
}

/** Validates the WorkScope fields; returns false when the scope is unusable. */
function checkScope(value: unknown, issues: ValidationIssue[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    ambiguous(issues, "scope");
    return false;
  }
  const record = value as Record<string, unknown>;
  hasUnknownKeys(Object.keys(record), SCOPE_KEYS, "scope.", issues);
  if (!isNonEmptyString(record.tenantId)) ambiguous(issues, "scope.tenantId");
  if (typeof record.ruc !== "string" || !RUC_RE.test(record.ruc)) ambiguous(issues, "scope.ruc");
  if (!isNonEmptyString(record.companyId)) ambiguous(issues, "scope.companyId");
  if (
    record.companyName !== undefined &&
    (typeof record.companyName !== "string" || record.companyName.length === 0)
  ) {
    ambiguous(issues, "scope.companyName");
  }
  if (typeof record.period !== "string" || !PERIOD_RE.test(record.period)) {
    ambiguous(issues, "scope.period");
  }
  if (!isNonEmptyString(record.intent)) ambiguous(issues, "scope.intent");
  return true;
}

/** Validates a closed literal; returns true when it is a supported member. */
function checkLiteral(
  value: unknown,
  allowed: readonly string[],
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (typeof value !== "string" || !allowed.includes(value)) {
    ambiguous(issues, path);
    return false;
  }
  return true;
}

/** Validates systemsInvolved; returns the validated non-empty id list or null. */
function checkSystems(value: unknown, issues: ValidationIssue[]): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    ambiguous(issues, "systemsInvolved");
    return null;
  }
  if (!value.every((id) => typeof id === "string" && id.length > 0)) {
    ambiguous(issues, "systemsInvolved");
    return null;
  }
  const systems = value as readonly string[];
  const seen = new Set<string>();
  for (const id of systems) {
    if (seen.has(id)) {
      ambiguous(issues, "systemsInvolved");
      return null;
    }
    seen.add(id);
  }
  return systems;
}

/** Builds a fresh validated request snapshot; caller objects are never mutated. */
function snapshot(request: RouteRequest): RouteRequest {
  const scope = request.scope;
  return {
    scope: {
      tenantId: scope.tenantId,
      ruc: scope.ruc,
      companyId: scope.companyId,
      ...(scope.companyName !== undefined ? { companyName: scope.companyName } : {}),
      period: scope.period,
      intent: scope.intent,
    },
    requestedEffect: request.requestedEffect,
    materiality: request.materiality,
    reversibility: request.reversibility,
    externalEvidence: request.externalEvidence,
    durationAndInterruptibility: request.durationAndInterruptibility,
    systemsInvolved: [...request.systemsInvolved],
    segregationOfDuties: request.segregationOfDuties,
    regulatoryObligations: request.regulatoryObligations,
    approval: request.approval,
  };
}

/**
 * Classifies a valid request into exactly one of the three charter routes.
 *
 * Precedence (first matching row wins): ambiguous rejection, durable-mission,
 * specialized-agent, direct-analysis. Validation always precedes decision
 * logic; on any issue the router fails closed with no route value.
 */
export function route(request: RouteRequest): ValidationResult<Route> {
  const issues: ValidationIssue[] = [];
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return { ok: false, issues: [{ code: "AMBIGUOUS_INPUT", path: "request" }] };
  }
  const record = request as unknown as Record<string, unknown>;

  // 1. Closed top-level shape: every required field present, no unknown keys.
  const keys = Object.keys(record);
  for (const key of REQUIRED_KEYS) {
    if (!keys.includes(key)) ambiguous(issues, key);
  }
  hasUnknownKeys(keys, REQUIRED_KEYS, "", issues);

  // 2. Fiscal scope (WorkScope fields), guarded against a missing scope.
  if (keys.includes("scope")) {
    checkScope(record.scope, issues);
  }

  // 3. Closed literals for every decision axis, guarded against missing fields.
  if (keys.includes("requestedEffect")) {
    checkLiteral(record.requestedEffect, REQUESTED_EFFECTS, "requestedEffect", issues);
  }
  if (keys.includes("materiality")) {
    checkLiteral(record.materiality, MATERIALITY_TIERS, "materiality", issues);
  }
  if (keys.includes("reversibility")) {
    checkLiteral(record.reversibility, REVERSIBILITIES, "reversibility", issues);
  }
  if (keys.includes("externalEvidence")) {
    checkLiteral(record.externalEvidence, EXTERNAL_EVIDENCE, "externalEvidence", issues);
  }
  if (keys.includes("durationAndInterruptibility")) {
    checkLiteral(
      record.durationAndInterruptibility,
      DURATIONS,
      "durationAndInterruptibility",
      issues,
    );
  }
  if (keys.includes("segregationOfDuties")) {
    checkLiteral(record.segregationOfDuties, SEGREGATION, "segregationOfDuties", issues);
  }
  if (keys.includes("regulatoryObligations")) {
    checkLiteral(record.regulatoryObligations, REGULATORY, "regulatoryObligations", issues);
  }
  if (keys.includes("approval")) {
    checkLiteral(record.approval, APPROVALS, "approval", issues);
  }

  // 4. Non-empty, duplicate-free systems collection (no normalization, D11).
  const systems = keys.includes("systemsInvolved")
    ? checkSystems(record.systemsInvolved, issues)
    : null;

  // 5. Contradictions between requestedEffect and authority-sensitive axes.
  if (
    keys.includes("requestedEffect") &&
    record.requestedEffect === "read-only" &&
    keys.includes("approval") &&
    record.approval === "required"
  ) {
    ambiguous(issues, "requestedEffect");
    ambiguous(issues, "approval");
  }
  if (
    keys.includes("requestedEffect") &&
    record.requestedEffect === "read-only" &&
    keys.includes("reversibility") &&
    record.reversibility === "irreversible"
  ) {
    ambiguous(issues, "requestedEffect");
    ambiguous(issues, "reversibility");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // Validated request; the request snapshot is built fresh below.
  const materiality = record.materiality;
  const reversibility = record.reversibility;
  const requestedEffect = record.requestedEffect;
  const externalEvidence = record.externalEvidence;
  const duration = record.durationAndInterruptibility;

  // Row 2 — durable-mission / through-core: any durable signal wins.
  const durable =
    requestedEffect === "core-governed-change" ||
    materiality === "R2" ||
    materiality === "R3" ||
    reversibility === "irreversible" ||
    externalEvidence === "material" ||
    duration === "recoverable" ||
    (systems !== null && systems.length > 1) ||
    record.segregationOfDuties === "required" ||
    record.regulatoryObligations === "applicable" ||
    record.approval === "required";

  // Row 3 — specialized-agent / proposes-only: no durable signal present.
  const specialized =
    requestedEffect === "proposes-change" ||
    reversibility === "partially-reversible" ||
    externalEvidence === "bounded" ||
    duration === "bounded-interruptible";

  const requestSnapshot = snapshot(request);
  if (durable) {
    return {
      ok: true,
      value: { kind: "durable-mission", authorityCeiling: "through-core", request: requestSnapshot },
    };
  }
  if (specialized) {
    return {
      ok: true,
      value: { kind: "specialized-agent", authorityCeiling: "proposes-only", request: requestSnapshot },
    };
  }
  // Row 4 — direct-analysis / no-mutation: with every durable and specialized
  // signal absent the closed unions leave exactly the read-only, R0/R1,
  // reversible, immediate, single-system, no-duty/regulation/approval case.
  return {
    ok: true,
    value: { kind: "direct-analysis", authorityCeiling: "no-mutation", request: requestSnapshot },
  };
}
