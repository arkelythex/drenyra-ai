/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Same-close-step segregation of duties (D9): one identity may never be both
 * proposer and approver of the same step. Pure overlap decision on plain string
 * IDs; independent of R3's separate two-distinct-approvers invariant (D10).
 */
import type {
  Denial,
  SegregationDecision,
  SegregationDenialCode,
  SegregationInput,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Frozen segregation denial details (D8); causes are safe and English. */
const SEGREGATION_DENIALS = Object.freeze({
  "sod-violation": Object.freeze({
    cause: "proposer appears among the approvers of the same close step",
    continuation: "choose an approver who did not propose the step",
  }),
  "sod-invalid-input": Object.freeze({
    cause: "segregation input is malformed",
    continuation: "provide non-empty string IDs and a well-formed approver list",
  }),
} as const satisfies Record<
  SegregationDenialCode,
  { readonly cause: string; readonly continuation: string }
>);

const deny = (code: SegregationDenialCode): SegregationDecision => {
  const details = SEGREGATION_DENIALS[code];
  return Object.freeze({
    allowed: false as const,
    denial: Object.freeze({
      code,
      cause: details.cause,
      continuation: details.continuation,
    } satisfies Denial<SegregationDenialCode>),
  });
};

/**
 * Segregation decision for one close step: allow unless the proposer is among the
 * approvers (exact string equality via a local Set). Empty approver lists allow
 * vacuously; malformed input denies `sod-invalid-input`. Pure and deterministic:
 * never mutates the caller's array, never touches I/O, clock, or network.
 */
export function assertSegregation(input: SegregationInput): SegregationDecision {
  if (!isRecord(input)) return deny("sod-invalid-input");
  if (!isNonEmptyString(input.closeStepId)) return deny("sod-invalid-input");
  if (!isNonEmptyString(input.proposerId)) return deny("sod-invalid-input");
  if (!Array.isArray(input.approverIds)) return deny("sod-invalid-input");
  for (const approverId of input.approverIds) {
    if (!isNonEmptyString(approverId)) return deny("sod-invalid-input");
  }

  // Local Set: duplicates collapse; empty list allows vacuously (D9).
  const approverSet = new Set<string>(input.approverIds);
  if (approverSet.has(input.proposerId)) return deny("sod-violation");

  return Object.freeze({ allowed: true as const });
}
