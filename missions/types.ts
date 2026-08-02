/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission snapshot and related types — canonical shared data structures.
 *
 * These interfaces define the shape of snapshots, proposals, evidence,
 * gates, exceptions, and other data structures consumed by all surfaces
 * (API, web, CLI, MCP, mobile).
 */

import type { AccountingMissionStatus } from "./status.js";
import type { MissionIntent } from "./commands.js";

// ─── Receipt ──────────────────────────────────────────────────────────────

/**
 * The business purpose of a signed mission receipt.
 * Receipt type is bundle metadata and is intentionally excluded from the
 * canonical ReceiptContent payload used for cross-language hashing.
 *
 * Ported from @drenyra/mission-protocol with ONE adaptation: drenyra-ai owns a
 * single ReceiptType definition in receipts/types.ts (const + union with the
 * exact same literal values), so this module re-exports it instead of defining
 * a duplicate enum. Protocol sources treat ReceiptType as a value and a type.
 */
import { ReceiptType } from "../receipts/types.js";
export { ReceiptType };

// ─── Mission Step ────────────────────────────────────────────────────

export interface MissionStep {
  id: string;
  name: string;
  description?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  evidenceIds?: string[];
}

// ─── Evidence Item ───────────────────────────────────────────────────

// Single definition: EvidenceItem lives in receipts/types.ts (ported from
// mission-contracts.ts); missions imports + re-exports it so the type is
// usable in this file and exported without a duplicate definition.
import type { EvidenceItem } from "../receipts/types.js";
export type { EvidenceItem };

// ─── Proposal ─────────────────────────────────────────────────────────

export interface MissionProposal {
  id: string;
  missionId: string;
  version: number;
  evidence: EvidenceItem[];
  evidenceHash: string;
  summary: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  generatedAt: string;
  expiresAt?: string;
}

// ─── Rejection ────────────────────────────────────────────────────────

export interface MissionRejection {
  reason: string;
  rejectedBy: string;
  rejectedAt: string;
  proposalVersion: number;
}

// ─── Blocker ──────────────────────────────────────────────────────────

export interface MissionBlocker {
  id: string;
  reason: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  occurredAt: string;
  resolvedAt?: string;
}

// ─── Snapshot ─────────────────────────────────────────────────────────

export interface MissionSnapshot {
  id: string;
  companyId: string;
  fiscalPeriod: string;
  intent: MissionIntent;
  status: AccountingMissionStatus;
  version: number;
  progress: number;
  steps: MissionStep[];
  currentStep: string;
  blockers: MissionBlocker[];
  proposal: MissionProposal | null;
  rejection: MissionRejection | null;
  receiptId: string | null;
  receiptHash: string | null;
  lastEventSequence: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Readiness Gates ─────────────────────────────────────────────────

export interface ReadinessGateResult {
  gateName: string;
  status: string;
  details?: string;
  evaluatedAt?: string;
}

// ─── Accounting Exceptions ───────────────────────────────────────────

export interface AccountingException {
  id: string;
  missionId: string;
  code: string;
  severity: string;
  subjectRef: string;
  evidenceRefs: string[];
  resolutionStatus: string;
}

// ─── Harness Error ──────────────────────────────────────────────────

export interface HarnessError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  isTimeout: boolean;
}
