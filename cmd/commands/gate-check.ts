/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai gate check <gate-input.json>`
 *
 * Runs the standard gate set [mission, receipt, approval] over a gate-input
 * file: { mission?, targetStatus?, receipt?, trustedKeys?, materiality?,
 * approval? }. Outputs { verdict, results } to stdout. Exit 0 when every gate
 * allowed, 1 when the pipeline failed closed (blocked or needs_input — the
 * blocking result carries the reason and, for needs_input, the full envelope),
 * 2 for usage/IO/parse errors.
 *
 * This is a THIN adapter: it wires the standard gates together and serializes
 * the verdicts. All policy logic lives in gates/ (ApprovalGate, ReceiptGate,
 * MissionStateGate, GateRunner).
 */

import { ApprovalGate, GateRunner, MissionStateGate, ReceiptGate } from "../../gates/index.js";
import type { GateContext } from "../../gates/index.js";
import type { Materiality } from "../../candidates/index.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

const MATERIALITY_TIERS = new Set(["R0", "R1", "R2", "R3"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Light shape validation: each optional field must be present with the shape
 * the gates expect. Semantic evaluation is delegated to the gates; a field with
 * the wrong shape is a parse error (exit 2), never a guessed verdict.
 */
function parseGateInput(raw: unknown): GateContext {
  if (!isRecord(raw)) {
    throw new Error("gate-input must be a JSON object");
  }
  const ctx: GateContext = {};

  if (raw.mission !== undefined) {
    if (!isRecord(raw.mission) || typeof raw.mission.id !== "string" || typeof raw.mission.status !== "string") {
      throw new Error("mission must be a MissionSnapshot object (id, status, ...)");
    }
    ctx.mission = raw.mission as unknown as GateContext["mission"];
  }
  if (raw.targetStatus !== undefined) {
    if (typeof raw.targetStatus !== "string") {
      throw new Error("targetStatus must be a string");
    }
    ctx.targetStatus = raw.targetStatus as GateContext["targetStatus"];
  }
  if (raw.receipt !== undefined) {
    if (!isRecord(raw.receipt) || typeof raw.receipt.signerKeyId !== "string") {
      throw new Error("receipt must be a SignedReceipt object (signerKeyId, ...)");
    }
    ctx.receipt = raw.receipt as unknown as GateContext["receipt"];
  }
  if (raw.trustedKeys !== undefined) {
    if (!Array.isArray(raw.trustedKeys) || !raw.trustedKeys.every(isRecord)) {
      throw new Error("trustedKeys must be an array of SigningKeyInfo objects");
    }
    ctx.trustedKeys = raw.trustedKeys as unknown as GateContext["trustedKeys"];
  }
  if (raw.materiality !== undefined) {
    if (typeof raw.materiality !== "string" || !MATERIALITY_TIERS.has(raw.materiality)) {
      throw new Error("materiality must be one of R0 | R1 | R2 | R3");
    }
    ctx.materiality = raw.materiality as Materiality;
  }
  if (raw.approval !== undefined) {
    if (!Array.isArray(raw.approval) || !raw.approval.every(isRecord)) {
      throw new Error("approval must be an array of ApprovalRecord objects");
    }
    ctx.approval = raw.approval as unknown as GateContext["approval"];
  }
  return ctx;
}

/** The standard gate set, in deterministic order. */
const STANDARD_GATES = [
  new MissionStateGate(),
  new ReceiptGate(),
  new ApprovalGate(),
];

export async function gateCheckCommand(args: string[]): Promise<number> {
  const inputPath = args[0];
  if (inputPath === undefined || args.length > 1) {
    return usageError("usage: drenyra-ai gate check <gate-input.json>");
  }
  let ctx: GateContext;
  try {
    ctx = parseGateInput(readJsonFile(inputPath));
  } catch (error) {
    return usageError(`gate check: ${errorMessage(error)}`);
  }

  try {
    const results = await new GateRunner().run(STANDARD_GATES, ctx);
    const verdict: "allowed" | "blocked" =
      results.every((result) => result.verdict === "allowed")
        ? "allowed"
        : "blocked";
    emitJson({ verdict, results });
    const blocking = results[results.length - 1];
    emitSummary(
      "gate check",
      `verdict=${verdict} gates=${results.map((r) => `${r.gate}:${r.verdict}`).join(",")}${blocking === undefined ? "" : ` (${blocking.reason})`}`,
    );
    return verdict === "allowed" ? 0 : 1;
  } catch (error) {
    console.error(`gate check: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
