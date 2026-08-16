/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * AuthorizationGate — ApprovalGate quantity semantics PLUS per-approver RBAC via the
 * standalone authorize() engine (contract: contracts/gate.md, "## Human approval").
 *
 *   R0/R1 (or materiality unset)            → allowed, no approval required; the
 *                                            RBAC engine is NEVER consulted.
 *   R2                                     → at least one ApprovalRecord (else
 *                                            needs_input), then EVERY approver must
 *                                            hold `close:approve` at the tenant scope.
 *   R3                                     → at least TWO DISTINCT approverIds (else
 *                                            blocked), then EVERY approver must hold
 *                                            `close:approve` at the tenant scope.
 *
 * Fail-closed evidence: when approval is required and present but no role assignments
 * were supplied, or the tenant scope cannot be derived from the mission, the gate
 * returns needs_input (it cannot prove identity/permission — it requests the evidence,
 * it never guesses). A single authorize() denial blocks the checkpoint with the
 * engine's typed, frozen denial (code/cause/continuation), which never leaks another
 * organization's detail. Deterministic: identical inputs ⇒ identical verdicts; the
 * ApprovalRecord.at timestamp is inert; materiality tiers are compared ordinally on
 * the closed R0–R3 vocabulary; scope equality is exact (companyId, RUC, period).
 */

import { ApprovalGate } from "./approval.js";
import type { Gate, GateContext, GateResult } from "./types.js";
import { authorize, type RoleAssignment } from "../authorization/index.js";
import {
  validateTenantScope,
  type ValidatedTenantScope,
} from "../tenant-core/index.js";

/** Options for constructing an AuthorizationGate. */
export interface AuthorizationGateOptions {
  /** Role assignments resolvable for the tenant scope (from assignRoles). */
  assignments: readonly RoleAssignment[];
}

/** The closed permission every approver must hold at the tenant scope. */
const APPROVAL_PERMISSION = "close:approve" as const;

/**
 * Derives the tenant scope from the mission snapshot. The established convention is
 * that `companyId` IS the 11-digit RUC for real tenants, so `ruc` mirrors it; when
 * the mission is absent or the scope fails validation (e.g. a synthetic tenant id),
 * the scope is underivable and the gate fails closed.
 */
function deriveScope(ctx: GateContext): ValidatedTenantScope | null {
  const mission = ctx.mission;
  if (mission === undefined) return null;
  try {
    return validateTenantScope({
      companyId: mission.companyId,
      ruc: mission.companyId,
      period: mission.fiscalPeriod,
    });
  } catch {
    return null;
  }
}

/**
 * Approval gate composed with per-approver RBAC: the quantity tier is exactly
 * ApprovalGate's (unchanged), and — when an approval is required and present — every
 * ApprovalRecord.approverId must be authorized for `close:approve` at the candidate's
 * exact tenant scope. Never throws for caller-shaped input: every evaluation returns
 * a structured verdict (allowed | blocked | needs_input).
 */
export class AuthorizationGate implements Gate {
  public readonly name = "authorization" as const;
  readonly #assignments: readonly RoleAssignment[];
  readonly #approvalGate = new ApprovalGate();

  constructor(options: AuthorizationGateOptions) {
    this.#assignments = options.assignments;
  }

  evaluate(ctx: GateContext): GateResult {
    // 1. Quantity tier exactly as ApprovalGate (R0/R1 allowed, R2 one, R3 two distinct).
    const approvalResult = this.#approvalGate.evaluate(ctx);
    const tierResult: GateResult = { ...approvalResult, gate: this.name };

    // R0/R1 (or unset materiality): no approval required — allow exactly as
    // ApprovalGate does and NEVER consult authorize(), even when records exist.
    const tier = ctx.materiality ?? "R0";
    if (tier === "R0" || tier === "R1") return tierResult;

    // Approval required (R2/R3): any non-allowed quantity verdict passes through.
    if (approvalResult.verdict !== "allowed") return tierResult;

    // Approval required and present: derive the tenant scope, fail-closed.
    const approvals = ctx.approval ?? [];
    const scope = deriveScope(ctx);
    if (scope === null) {
      return {
        gate: this.name,
        verdict: "needs_input",
        reason:
          "approval authorization requires a derivable tenant scope (mission companyId/RUC/period)",
        envelope: {
          materiality: tier,
          approval: approvals,
          missing: "scope",
        },
      };
    }

    // Fail closed when no role assignments were supplied: the gate cannot prove
    // identity/permission, so it requests the evidence rather than guessing.
    if (this.#assignments.length === 0) {
      return {
        gate: this.name,
        verdict: "needs_input",
        reason: "no role assignments supplied for close:approve authorization",
        envelope: {
          materiality: tier,
          approval: approvals,
          missing: "assignments",
        },
      };
    }

    // Per-approver RBAC: EVERY approver MUST be authorized at the exact tenant scope.
    for (const record of approvals) {
      const decision = authorize({
        assignments: this.#assignments,
        identity: record.approverId,
        permission: APPROVAL_PERMISSION,
        scope,
        materiality: ctx.materiality,
      });
      if (!decision.allowed) {
        return {
          gate: this.name,
          verdict: "blocked",
          reason: `approver ${record.approverId} is not authorized to ${APPROVAL_PERMISSION}: ${decision.denial.code}`,
          envelope: {
            denial: decision.denial,
            approverId: record.approverId,
            approval: approvals,
          },
        };
      }
    }
    return {
      gate: this.name,
      verdict: "allowed",
      reason: "every approver holds close:approve at the tenant scope",
    };
  }
}
