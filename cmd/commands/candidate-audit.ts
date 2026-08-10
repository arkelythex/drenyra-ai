/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai candidate audit <candidate.json>`
 *
 * Guardian Angel over a frozen candidate (Design 03 agent table): read-only
 * adversarial review. Produces findings only — the Guardian NEVER approves or
 * rejects; the professional and gates decide. Input: a candidate snapshot.
 */

import {
	runGuardianReview,
	type GuardianReport,
} from "../../guardian/index.js";
import type { Candidate } from "../../candidates/types.js";
import { readJsonFile, emitJson } from "../output/json.js";
import { usageError } from "../output/errors.js";

function isCandidate(input: unknown): input is Candidate {
	if (typeof input !== "object" || input === null) return false;
	const record = input as Record<string, unknown>;
	const scope = record.scope as Record<string, unknown> | undefined;
	return (
		typeof record.id === "string" &&
		typeof record.subjectHash === "string" &&
		typeof scope === "object" &&
		scope !== null &&
		typeof scope.ruc === "string" &&
		typeof scope.period === "string" &&
		typeof record.materiality === "string"
	);
}

export function candidateAuditCommand(args: string[]): number {
	const file = args[0];
	if (file === undefined) {
		return usageError(
			"missing candidate file: drenyra-ai candidate audit <candidate.json>",
		);
	}
	let candidate: unknown;
	try {
		candidate = readJsonFile(file);
	} catch {
		return usageError(`cannot read candidate file "${file}"`);
	}
	if (!isCandidate(candidate)) {
		return usageError(`"${file}" is not a candidate snapshot`);
	}
	const report: GuardianReport = runGuardianReview(candidate);
	emitJson({
		candidateId: candidate.id,
		materiality: candidate.materiality,
		verdict: report.verdict,
		findings: report.findings,
		reviewedAt: report.reviewedAt,
		note: "the Guardian surfaces findings only; approval is decided by the professional and gates",
	});
	return report.findings.some((f) => f.severity === "blocker") ? 1 : 0;
}
