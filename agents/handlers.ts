/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Deterministic IntentHandler implementations for every frozen MissionIntent.
 *
 * A handler is a pure, stateless function of the mission snapshot: it stages
 * the intent plan, advances one staged step per execute, and pauses at the
 * evidence gate (WAITING_FOR_EVIDENCE) between steps and at the approval gate
 * (AWAITING_APPROVAL) once the plan is fully staged. It never claims SUNAT,
 * bank, or ERP side effects and never performs fiscal approval: the Core
 * lifecycle, gates, receipts, and human approval stay authoritative.
 */

import { canonicalHash } from "../missions/index.js";
import { AccountingMissionStatus } from "../missions/index.js";
import type {
  ExecuteMissionCommand,
  IntentHandler,
  MissionIntent,
  MissionSnapshot,
  MissionStep,
} from "../missions/index.js";
import { INTENT_PLANS } from "./plans.js";
import type { IntentPlan } from "./plans.js";

const S = AccountingMissionStatus;

/** SHA-256 of the empty evidence list: staged proposals bind zero claimed evidence. */
const EMPTY_EVIDENCE_HASH = canonicalHash([]);

/** Number of COMPLETED steps in a snapshot's step list. */
function completedSteps(steps: readonly MissionStep[]): number {
  return steps.reduce(
    (count, step) => (step.status === "COMPLETED" ? count + 1 : count),
    0,
  );
}

/** First IN_PROGRESS (else first PENDING) step index, or -1 when none exists. */
function firstActiveIndex(steps: readonly MissionStep[]): number {
  return steps.findIndex(
    (step) => step.status === "IN_PROGRESS" || step.status === "PENDING",
  );
}

/** Stages the plan: every step PENDING, nothing claimed. */
function stagedSteps(plan: IntentPlan): MissionStep[] {
  return plan.steps.map((step, index) => ({
    id: `step_${index + 1}`,
    name: step.name,
    status: "PENDING" as const,
  }));
}

/** Marks the first active step IN_PROGRESS (deterministic activation). */
function activateSteps(
  steps: readonly MissionStep[],
  at: string,
): MissionStep[] {
  const index = firstActiveIndex(steps);
  if (index === -1) {
    return [...steps];
  }
  return steps.map((step, i) =>
    i === index
      ? { ...step, status: "IN_PROGRESS" as const, startedAt: at }
      : step,
  );
}

/**
 * Completes the first active step and starts the next PENDING one.
 * `at` is the snapshot's updatedAt, keeping results deterministic.
 */
function advanceSteps(
  steps: readonly MissionStep[],
  at: string,
): { steps: MissionStep[]; currentStep: string } {
  const index = firstActiveIndex(steps);
  if (index === -1) {
    return { steps: [...steps], currentStep: "" };
  }
  const completed = steps.map((step, i) =>
    i === index
      ? { ...step, status: "COMPLETED" as const, completedAt: at }
      : step,
  );
  const nextIndex = completed.findIndex((step) => step.status === "PENDING");
  if (nextIndex === -1) {
    return { steps: completed, currentStep: "" };
  }
  const next = completed.map((step, i) =>
    i === nextIndex
      ? { ...step, status: "IN_PROGRESS" as const, startedAt: at }
      : step,
  );
  return { steps: next, currentStep: next[nextIndex].id };
}

/**
 * Stages the intent proposal (zero evidence, deterministic hash) and pauses at
 * the approval gate. The proposal is staged work for human review — nothing is
 * executed and nothing is approved by the agent.
 */
function stageProposal(
  mission: MissionSnapshot,
  plan: IntentPlan,
): MissionSnapshot {
  return {
    ...mission,
    status: S.AWAITING_APPROVAL,
    progress: plan.steps.length,
    currentStep: "",
    proposal: {
      id: `proposal_${mission.id}`,
      missionId: mission.id,
      version: mission.version,
      evidence: [],
      evidenceHash: EMPTY_EVIDENCE_HASH,
      summary: plan.proposalSummary,
      riskLevel: plan.riskLevel,
      generatedAt: mission.updatedAt,
    },
  };
}

/**
 * One deterministic intent handler bound to a single intent plan.
 * Stateless: safe to share across invocations.
 */
export class PlanIntentHandler implements IntentHandler {
  public readonly intent: MissionIntent;
  private readonly plan: IntentPlan;

  constructor(plan: IntentPlan) {
    this.intent = plan.intent;
    this.plan = plan;
  }

  async execute(
    mission: MissionSnapshot,
    _command: ExecuteMissionCommand,
  ): Promise<MissionSnapshot | null> {
    const plan = this.plan;
    switch (mission.status) {
      case S.DRAFT:
        // Stage the plan (all steps PENDING) and queue the work.
        return {
          ...mission,
          status: S.QUEUED,
          steps: stagedSteps(plan),
          currentStep: "step_1",
          progress: 0,
        };
      case S.QUEUED: {
        // Activate the plan: first step IN_PROGRESS.
        const steps = activateSteps(mission.steps, mission.updatedAt);
        return {
          ...mission,
          status: S.RUNNING,
          steps,
          currentStep: steps[firstActiveIndex(steps)]?.id ?? "",
          progress: completedSteps(steps),
        };
      }
      case S.RUNNING: {
        // Advance one staged step, then pause at a gate: evidence between
        // steps, approval once the plan is fully staged.
        if (completedSteps(mission.steps) >= plan.steps.length) {
          return stageProposal({ ...mission, status: S.RUNNING }, plan);
        }
        const advanced = advanceSteps(mission.steps, mission.updatedAt);
        if (completedSteps(advanced.steps) >= plan.steps.length) {
          return stageProposal(
            { ...mission, ...advanced, progress: plan.steps.length },
            plan,
          );
        }
        return {
          ...mission,
          status: S.WAITING_FOR_EVIDENCE,
          ...advanced,
          progress: completedSteps(advanced.steps),
        };
      }
      case S.WAITING_FOR_EVIDENCE:
      case S.BLOCKED:
      case S.BLOCKED_BY_GATE:
      case S.RETRYING:
      case S.RECOVERING:
      case S.UNKNOWN:
        // Resume execution; staged steps and evidence requests stay intact.
        return { ...mission, status: S.RUNNING };
      case S.REVISION_REQUESTED:
        // Reopen the staged plan after a human rejection.
        return { ...mission, status: S.QUEUED };
      case S.APPROVED:
        // Finalize the human-approved plan: every staged step completed.
        return {
          ...mission,
          status: S.COMPLETED,
          steps: mission.steps.map((step) =>
            step.status === "COMPLETED"
              ? step
              : { ...step, status: "COMPLETED" as const, completedAt: mission.updatedAt },
          ),
          currentStep: "",
          progress: plan.steps.length,
        };
      case S.AWAITING_APPROVAL:
      case S.COMPLETED:
      case S.FAILED:
        // Human approval gate and terminal states: no state change proposed;
        // the runtime keeps its default target (legal from AWAITING_APPROVAL).
        return null;
    }
    // Defensive: unreachable for the 14 canonical states; stays legal for any
    // future status added to the Core enum.
    return null;
  }
}

/** Deterministic handler instances, one per frozen mission intent. */
export const monthlyCloseHandler = new PlanIntentHandler(
  INTENT_PLANS["monthly-close"],
);
export const correctionHandler = new PlanIntentHandler(
  INTENT_PLANS["correction"],
);
export const reconciliationHandler = new PlanIntentHandler(
  INTENT_PLANS["reconciliation"],
);
export const invoiceReviewHandler = new PlanIntentHandler(
  INTENT_PLANS["invoice-review"],
);
export const complianceCheckHandler = new PlanIntentHandler(
  INTENT_PLANS["compliance-check"],
);
