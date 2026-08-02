/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * ApprovalGate — materiality-proportional human approval (contract:
 * contracts/gate.md, "## Human approval").
 *
 *   R0/R1 (or materiality unset) → allowed, no approval required
 *   R2                            → at least one ApprovalRecord, else needs_input
 *   R3                            → at least TWO DISTINCT approverIds (dual
 *                                    approval); a single approver — or the same
 *                                    approver twice — is INSUFFICIENT and blocked
 *
 * Uses candidates/materiality orderOf so tiers stay ordinal and comparable.
 * Memory (Drenyra Engram) never authorizes — only a professional records an
 * ApprovalRecord.
 */

import { orderOf, type Materiality } from "../candidates/index.js";
import type {
  ApprovalRecord,
  Gate,
  GateContext,
  GateResult,
} from "./types.js";

/** The dual-approval threshold tier. */
export const DUAL_APPROVAL_TIER: Materiality = "R3";
/** Approval records required at the dual-approval tier. */
export const DUAL_APPROVAL_COUNT = 2;

/** Number of distinct approverIds in the approval records. */
export function distinctApprovers(approval: ApprovalRecord[]): number {
  return new Set(approval.map((record) => record.approverId)).size;
}

/**
 * Materiality-proportional approval gate.
 *
 * Fail-closed: unset materiality is treated as R0 (no approval required, which
 * is the permissive side of the contract), R2 without an approval record is
 * `needs_input` with the decision envelope, and R3 without two distinct
 * approvers is `blocked`.
 */
export class ApprovalGate implements Gate {
  public readonly name = "approval" as const;

  evaluate(ctx: GateContext): GateResult {
    const tier = ctx.materiality ?? "R0";
    const approvals = ctx.approval ?? [];

    if (orderOf(tier) <= orderOf("R1")) {
      return {
        gate: this.name,
        verdict: "allowed",
        reason: `no approval required at ${tier}`,
      };
    }

    if (tier === "R2") {
      if (approvals.length === 0) {
        return {
          gate: this.name,
          verdict: "needs_input",
          reason: "approval required: materiality R2 needs at least one ApprovalRecord",
          envelope: {
            materiality: tier,
            requiredApprovers: 1,
            approval: approvals,
          },
        };
      }
      return {
        gate: this.name,
        verdict: "allowed",
        reason: `approval recorded (${approvals.length} record(s))`,
      };
    }

    // R3: dual approval — two DISTINCT approverIds. A single approver (even
    // recorded twice) is insufficient.
    const distinct = distinctApprovers(approvals);
    if (distinct < DUAL_APPROVAL_COUNT) {
      return {
        gate: this.name,
        verdict: "blocked",
        reason: `dual approval required at R3: ${distinct} distinct approver(s), need ${DUAL_APPROVAL_COUNT}`,
        envelope: {
          materiality: tier,
          requiredApprovers: DUAL_APPROVAL_COUNT,
          distinctApprovers: [...new Set(approvals.map((a) => a.approverId))],
          approval: approvals,
        },
      };
    }
    return {
      gate: this.name,
      verdict: "allowed",
      reason: `dual approval recorded (${distinct} distinct approver(s))`,
    };
  }
}
