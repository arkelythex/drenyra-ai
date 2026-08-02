/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MissionStateGate — validates a proposed mission transition (contract:
 * contracts/gate.md, "## Lifecycle gates", `mission` row).
 *
 * Uses the canonical state machine (missions/transitions): validateTransition
 * rejects illegal transitions and guardTerminal rejects any mutation of a
 * terminal state. Illegal or terminal → blocked; legal → allowed. A missing
 * mission snapshot or target status is itself a blocked (fail-closed) verdict —
 * the gate never guesses a transition target.
 */

import {
  guardTerminal,
  isMissionError,
  validateTransition,
} from "../missions/index.js";
import type { Gate, GateContext, GateResult } from "./types.js";

/** Mission state-transition gate. */
export class MissionStateGate implements Gate {
  public readonly name = "mission" as const;

  evaluate(ctx: GateContext): GateResult {
    const mission = ctx.mission;
    const target = ctx.targetStatus;

    if (mission === undefined) {
      return {
        gate: this.name,
        verdict: "blocked",
        reason: "mission snapshot required: no mission in the gate context",
      };
    }
    if (target === undefined) {
      return {
        gate: this.name,
        verdict: "blocked",
        reason: "targetStatus required: the gate cannot guess a transition target",
      };
    }

    try {
      guardTerminal(mission.status);
      validateTransition(mission.status, target);
    } catch (error) {
      const code = isMissionError(error) ? error.code : "INVALID_TRANSITION";
      return {
        gate: this.name,
        verdict: "blocked",
        reason: `mission transition ${mission.status} -> ${target} rejected (${code})`,
        envelope: { from: mission.status, to: target, code },
      };
    }

    return {
      gate: this.name,
      verdict: "allowed",
      reason: `mission transition ${mission.status} -> ${target} is legal`,
    };
  }
}
