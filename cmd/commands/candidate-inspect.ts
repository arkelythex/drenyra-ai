/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai candidate inspect <candidate.json>`
 *
 * Candidate identity + proportional review (contracts/candidate.md).
 * valueCents is parsed as BigInt from a decimal string — floats and negatives
 * are rejected. Input file: { subjectB64, scope: { ruc, period }, valueCents,
 * reversibility, jurisdiction }.
 */

import { CandidateLifecycle } from "../../candidates/lifecycle.js";
import { isCandidateError } from "../../candidates/errors.js";
import type { Reversibility } from "../../candidates/types.js";
import { selectReviewLenses } from "../../review/lenses.js";
import { forecastReviewWorkload } from "../../review/workload.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const DECIMAL_CENTS_RE = /^\d+$/;
const REVERSIBILITY_VALUES = new Set<Reversibility>([
  "reversible",
  "partially-reversible",
  "irreversible",
]);

interface CandidateInspectFile {
  subjectB64: string;
  scope: { ruc: string; period: string };
  valueCents: string;
  reversibility: Reversibility;
  jurisdiction: string;
}

function isCandidateInspectFile(input: unknown): input is CandidateInspectFile {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  const scope = record.scope as Record<string, unknown> | undefined;
  return (
    typeof record.subjectB64 === "string" &&
    BASE64_RE.test(record.subjectB64) &&
    record.subjectB64.length % 4 === 0 &&
    scope !== undefined &&
    typeof scope.ruc === "string" &&
    typeof scope.period === "string" &&
    typeof record.valueCents === "string" &&
    DECIMAL_CENTS_RE.test(record.valueCents) &&
    typeof record.reversibility === "string" &&
    REVERSIBILITY_VALUES.has(record.reversibility as Reversibility) &&
    typeof record.jurisdiction === "string" &&
    record.jurisdiction.length > 0
  );
}

export function candidateInspectCommand(args: string[]): number {
  const candidatePath = args[0];
  if (candidatePath === undefined) {
    return usageError("usage: drenyra-ai candidate inspect <candidate.json>");
  }
  if (args.length > 1) {
    return usageError(`unknown option "${args[1]}"`);
  }
  try {
    const raw = readJsonFile(candidatePath);
    if (!isCandidateInspectFile(raw)) {
      return usageError(
        `${candidatePath} must be { subjectB64, scope: { ruc, period }, valueCents, reversibility, jurisdiction }`,
      );
    }
    const subject = Buffer.from(raw.subjectB64, "base64");
    const valueCents = BigInt(raw.valueCents);
    const lifecycle = new CandidateLifecycle();
    const candidate = lifecycle.propose({
      subject,
      scope: raw.scope,
      materialityInput: {
        value: valueCents,
        reversibility: raw.reversibility,
        jurisdiction: raw.jurisdiction,
      },
    });
    const recommendedLenses = selectReviewLenses({
      filePaths: [],
      changedLines: 1,
      isPreCommit: false,
      isPrePR: true,
      isPostSDDPhase: false,
    });
    const workload = forecastReviewWorkload({
      estimatedLines: 1,
      estimatedFiles: 1,
      affectedSubsystems: ["candidates"],
      isMechanicalRefactor: false,
      isFiscalChange: false,
      reviewerContext: "fresh",
    });
    const output = {
      id: candidate.id,
      subjectHash: candidate.subjectHash,
      scope: candidate.scope,
      materiality: candidate.materiality,
      status: candidate.status,
      recommendedLenses,
      workload,
    };
    emitJson(output);
    emitSummary(
      "candidate inspect",
      `id=${candidate.id} materiality=${candidate.materiality} status=${candidate.status}`,
    );
    return 0;
  } catch (error) {
    if (isCandidateError(error)) {
      console.error(`candidate inspect: ${error.code}: ${error.message}`);
    } else {
      console.error(`candidate inspect: IO/parse error: ${errorMessage(error)}`);
    }
    return 2;
  }
}
