/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * External reconciliation — Design 04 "Unknown states".
 *
 * When an external call is interrupted after being sent, the result is NOT
 * automatically marked as an error. Reconciliation queries the external system
 * with a stable identifier and decides:
 *
 *   executed      -> record the result (requires verifiable evidence)
 *   not-executed  -> permit an idempotent retry
 *   indeterminate -> require human intervention
 *
 * Recovery consults persisted state, idempotency keys, and evidence. It never
 * re-executes an operation because the agent transcript says an earlier
 * attempt failed — and it never records external execution without evidence.
 */

/** Verifiable evidence of an external execution (Design 02 §6). */
export interface ExternalEvidence {
	/** Identifier returned by the external system. */
	identifier: string;
	/** State reported by the external system. */
	state: string;
	/** System that provided the evidence (provenance). */
	provenance: string;
	/** Moment the external system reported it. */
	moment: string;
	/** Hash of the external response. */
	responseHash: string;
}

/** A call that may have reached an external system. */
export interface ExternalCall {
	/** Stable identifier the external system can be queried by. */
	stableIdentifier: string;
	/** The external system (SUNAT, bank, ERP, ...). */
	system: string;
	/** Mission this call belongs to (scope). */
	missionId: string;
}

/** Outcome of querying the external system. */
export type ExternalOutcome = "executed" | "not-executed" | "indeterminate";

/** Resolver contract: queries the external system and reports its outcome. */
export interface ExternalSystemResolver {
	resolve(call: ExternalCall): Promise<{
		outcome: ExternalOutcome;
		evidence?: ExternalEvidence;
	}>;
}

/** Decision produced by reconciliation. */
export type ReconciliationDecision = "record" | "retry" | "human-intervention";

/** Result of reconciling an interrupted external call. */
export interface ReconciliationResult {
	decision: ReconciliationDecision;
	reason: string;
	evidence?: ExternalEvidence;
}

/** Raised when reconciliation cannot safely proceed. */
export class ReconciliationError extends Error {
	constructor(
		message: string,
		readonly code: "NO_RESOLVER" | "EXECUTED_WITHOUT_EVIDENCE" | "RESOLVER_FAILED",
	) {
		super(message);
		this.name = "ReconciliationError";
	}
}

/**
 * Reconcile an interrupted external call against the external system.
 *
 * Fail-closed rules:
 * - A missing resolver is an error (never guess the outcome).
 * - `executed` without verifiable evidence is rejected — no external-execution
 *   claim is accepted without evidence (Design 02 §6, Design 05 invariant).
 * - `not-executed` permits an idempotent retry (never a blind one).
 * - `indeterminate` requires human intervention.
 */
export async function reconcileExternalCall(
	resolver: ExternalSystemResolver | undefined,
	call: ExternalCall,
): Promise<ReconciliationResult> {
	if (resolver === undefined) {
		throw new ReconciliationError(
			`no external resolver configured for ${call.system}; cannot reconcile ${call.stableIdentifier}`,
			"NO_RESOLVER",
		);
	}
	let outcome: ExternalOutcome;
	let evidence: ExternalEvidence | undefined;
	try {
		const result = await resolver.resolve(call);
		outcome = result.outcome;
		evidence = result.evidence;
	} catch (error) {
		throw new ReconciliationError(
			`resolver failed for ${call.system}/${call.stableIdentifier}: ${
				error instanceof Error ? error.message : String(error)
			}`,
			"RESOLVER_FAILED",
		);
	}

	switch (outcome) {
		case "executed": {
			if (evidence === undefined || !isVerifiableEvidence(evidence)) {
				throw new ReconciliationError(
					`external system reports executed for ${call.stableIdentifier} but no verifiable evidence was provided`,
					"EXECUTED_WITHOUT_EVIDENCE",
				);
			}
			return {
				decision: "record",
				reason: "external system confirms execution with verifiable evidence",
				evidence,
			};
		}
		case "not-executed":
			return {
				decision: "retry",
				reason: "external system confirms the action did not execute; idempotent retry is safe",
			};
		case "indeterminate":
			return {
				decision: "human-intervention",
				reason: "external system cannot determine the outcome; a professional must decide",
			};
	}
}

/** Evidence is verifiable when every field is present and the hash looks real. */
export function isVerifiableEvidence(evidence: ExternalEvidence): boolean {
	return (
		evidence.identifier.length > 0 &&
		evidence.state.length > 0 &&
		evidence.provenance.length > 0 &&
		evidence.moment.length > 0 &&
		/^[0-9a-f]{64}$/.test(evidence.responseHash)
	);
}
