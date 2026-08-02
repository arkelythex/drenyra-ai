/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission commands - canonical command types for the mission protocol.
 *
 * Every command defines the complete input contract for a mission operation.
 * Transport-agnostic: used by both HTTP and non-HTTP clients.
 */

import type { AccountingMissionStatus } from "./status.js";

/**
 * Mission intent - the type of accounting work the mission performs.
 */
export type MissionIntent =
  | "monthly-close"
  | "correction"
  | "reconciliation"
  | "invoice-review"
  | "compliance-check";

/**
 * Create a new mission.
 */
export interface CreateMissionCommand {
  companyId: string;
  fiscalPeriod: string;
  intent: MissionIntent;
  input: { instruction: string };
}

/**
 * Execute (start or resume) a mission with optimistic concurrency control.
 */
export interface ExecuteMissionCommand {
  expectedMissionVersion: number;
}

/**
 * Approve a mission proposal with evidence binding.
 */
export interface ApproveMissionCommand {
  proposalId: string;
  proposalVersion: number;
  evidenceHash: string;
  expectedMissionVersion: number;
}

/**
 * Reject a mission proposal with required reason.
 */
export interface RejectMissionCommand {
  proposalId: string;
  proposalVersion: number;
  reason: string;
  expectedMissionVersion: number;
}

/**
 * Reconcile a mission from UNKNOWN to a known state.
 */
export interface ReconcileMissionCommand {
  resolution: "RUNNING" | "FAILED" | "COMPLETED";
  reason: string;
  expectedMissionVersion: number;
}

/**
 * Aggregate type for all mission commands.
 */
export type MissionCommand =
  | { type: "create"; payload: CreateMissionCommand }
  | { type: "execute"; payload: ExecuteMissionCommand }
  | { type: "approve"; payload: ApproveMissionCommand }
  | { type: "reject"; payload: RejectMissionCommand }
  | { type: "reconcile"; payload: ReconcileMissionCommand };

/**
 * Result of an approval action.
 */
export interface ApprovalResult {
  receiptId: string;
  receiptHash: string;
  version: number;
}

/**
 * Result of a receipt verification.
 */
export interface ReceiptVerification {
  valid: boolean;
  receiptHash: string;
  computedHash: string;
  missionId: string;
}

/**
 * List/summary view of a mission.
 */
export interface MissionSummary {
  id: string;
  status: AccountingMissionStatus;
  intent: MissionIntent;
  fiscalPeriod: string;
  companyId: string;
  version: number;
  createdAt: string;
}

/**
 * Filter for listing missions.
 */
export interface MissionFilter {
  companyId?: string;
  status?: string;
  intent?: string;
}
