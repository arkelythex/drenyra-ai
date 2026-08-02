/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * GateRunner — deterministic, fail-closed pipeline execution (contract:
 * contracts/gate.md, "## Behavior").
 *
 * Evaluates gates strictly in the order given. The FIRST non-allowed result
 * fails closed and stops the pipeline: the returned array contains every result
 * up to and including the blocking one. A `needs_input` result carries the
 * complete decision envelope in the result — the caller/human answers, the gate
 * never guesses. When every gate is `allowed`, the pipeline is allowed.
 */

import type { Gate, GateContext, GateResult } from "./types.js";

/** Runs a gate list in order; the first non-allowed result stops the pipeline. */
export class GateRunner {
  async run(gates: Gate[], ctx: GateContext): Promise<GateResult[]> {
    const results: GateResult[] = [];
    for (const gate of gates) {
      const result = await gate.evaluate(ctx);
      results.push(result);
      if (result.verdict !== "allowed") {
        // Fail closed: the first blocked/needs_input result ends the run.
        break;
      }
    }
    return results;
  }
}
