/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Gate domain types — the lifecycle-checkpoint vocabulary (contract:
 * contracts/gate.md, v0.1-draft).
 *
 * A gate validates authority, scope, and receipts before an action is allowed.
 * Verdicts are `allowed | blocked | needs_input`; `blocked` carries the reason,
 * `needs_input` returns the complete decision envelope so the caller/human can
 * answer — a gate never guesses.
 */

import type { Materiality } from "../candidates/index.js";
import type { SignedReceipt, SigningKeyInfo } from "../receipts/index.js";
import type { AccountingMissionStatus } from "../missions/index.js";
import type { MissionSnapshot } from "../missions/index.js";

/** The lifecycle gates defined by the contract. */
export type GateName =
  | "mission"
  | "receipt"
  | "approval"
  | "pre-commit"
  | "release";

/** A gate verdict: allowed, fail-closed blocked, or needs human input. */
export type GateVerdict = "allowed" | "blocked" | "needs_input";

/** Structured verdict of one gate evaluation. */
export interface GateResult {
  gate: GateName;
  verdict: GateVerdict;
  reason: string;
  envelope?: unknown;
}

/** One explicit human approval record. */
export interface ApprovalRecord {
  approverId: string;
  at: string;
  reason?: string;
}

/** Everything a gate may need to evaluate one checkpoint. */
export interface GateContext {
  mission?: MissionSnapshot;
  targetStatus?: AccountingMissionStatus;
  receipt?: SignedReceipt;
  trustedKeys?: SigningKeyInfo[];
  materiality?: Materiality;
  approval?: ApprovalRecord[];
}

/** A lifecycle gate: evaluates a context to a structured verdict. */
export interface Gate {
  name: GateName;
  evaluate(ctx: GateContext): Promise<GateResult> | GateResult;
}
