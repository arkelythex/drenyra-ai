/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Public API of the gates subsystem — lifecycle checkpoints (contract:
 * contracts/gate.md, v0.1-draft).
 *
 * ZERO runtime dependencies (node:crypto built-in only, via receipts/missions).
 * Gates validate authority, scope, and receipts before an action is allowed;
 * failures are structured verdicts, never silent rejects.
 */

export * from "./types.js";
export { ApprovalGate, distinctApprovers } from "./approval.js";
export { ReceiptGate } from "./receipt.js";
export { MissionStateGate } from "./mission.js";
export { GateRunner } from "./runner.js";
