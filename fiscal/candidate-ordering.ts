/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * FiscalCandidateOrderingAdapter (1D-1..1D-3) — application ordering only:
 * validate scope → core validate → reconcile (≥1 artifact, same scope) → build
 * exact subject bytes → CandidateLifecycle.propose (frozen { ruc, period }
 * projection + materiality) → CandidateLifecycle.inspect with the same byte
 * reference; any failing step closes the flow. 1D-3 wires the concrete
 * CandidateLifecycle by default; no public method exposes construction,
 * propose, or inspect independently. */
import {
	sameTenantScope,
	validateTenantScope,
	type ValidatedTenantScope,
} from "../tenant-core/index.js";
import type { AcceptedEvidence } from "../evidence/index.js";
import { CandidateLifecycle } from "../candidates/index.js";
import {
	CandidateLifecyclePort,
	FISCAL_ERROR,
	FiscalError,
	type CoreValidator,
	type FiscalCandidatePort,
	type FiscalFlowInput,
	type FiscalFlowResult,
	type FiscalSubjectBuilder,
	type Reconciler,
} from "./types.js";

export class FiscalCandidateOrderingAdapter<TInput, TValidated> {
constructor(
private readonly coreValidator: CoreValidator<TInput, TValidated>,
private readonly reconciler: Reconciler<TValidated>,
private readonly subjectBuilder: FiscalSubjectBuilder<TValidated>,
private readonly candidatePort: FiscalCandidatePort = new CandidateLifecyclePort(
new CandidateLifecycle(),
),
) {}

	run(input: FiscalFlowInput<TInput>): FiscalFlowResult<TValidated> {
		const scope = validateTenantScope(input.scope);
		const validated = this.coreValidator.validate(scope, input.payload);
		const evidence = this.reconciler.reconcile(scope, validated);
		this.requireBoundReconciliation(scope, evidence);
		const subject = this.subjectBuilder.build(scope, validated, evidence);
		const proposed = this.candidatePort.propose({
			subject,
			scope: { ruc: scope.ruc, period: scope.period },
			materialityInput: input.materialityInput,
		});
		const candidate = this.candidatePort.inspect(proposed, subject);
		return { scope, validated, evidence, subject, candidate };
	}

	/** Fail-closed reconciliation gate: ≥1 accepted artifact, every artifact on the same scope. */
	private requireBoundReconciliation(
		scope: ValidatedTenantScope,
		evidence: readonly AcceptedEvidence[],
	): void {
		if (evidence.length === 0) {
			throw new FiscalError(
				FISCAL_ERROR.MISSING_RECONCILIATION_EVIDENCE,
				"at least one accepted reconciliation artifact bound to the same scope is required",
			);
		}
		if (evidence.some((artifact) => !sameTenantScope(artifact.scope, scope))) {
			throw new FiscalError(
				FISCAL_ERROR.RECONCILIATION_SCOPE_MISMATCH,
				"every reconciliation artifact must be bound to the validated scope",
			);
		}
	}
}
