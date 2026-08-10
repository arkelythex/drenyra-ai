/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Agent intent plans — deterministic, staged work definitions for every frozen
 * MissionIntent.
 *
 * Hybrid model: Drenyra-AI (this agents/ layer) orchestrates specialized
 * accounting/fiscal work; the deterministic Core (missions runtime,
 * transitions, gates, receipts, explicit human approval) remains the authority.
 * Plans describe staged actions only — no SUNAT/bank/ERP execution and no
 * fiscal approval is ever claimed here.
 */

import type { MissionIntent } from "../missions/index.js";

const RISK_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

/** One staged step in an intent plan (a work item, not a claimed side effect). */
export interface AgentPlanStep {
  name: string;
}

/** Deterministic staged work plan for one mission intent. */
export interface IntentPlan {
  intent: MissionIntent;
  title: string;
  steps: readonly AgentPlanStep[];
  proposalSummary: string;
  riskLevel: RiskLevel;
}

const PLANS = {
  "monthly-close": {
    intent: "monthly-close",
    title: "Monthly close",
    steps: [
      { name: "stage period-cutoff checklist" },
      { name: "queue posting-review worklist" },
      { name: "prepare close proposal" },
    ],
    proposalSummary:
      "Monthly-close work staged for review: cutoff checklist, posting-review worklist, and close proposal.",
    riskLevel: RISK_LEVELS.MEDIUM,
  },
  correction: {
    intent: "correction",
    title: "Accounting correction",
    steps: [
      { name: "stage correction scope" },
      { name: "queue reclassification draft" },
      { name: "prepare correction proposal" },
    ],
    proposalSummary:
      "Correction work staged for review: scope, reclassification draft, and correction proposal.",
    riskLevel: RISK_LEVELS.HIGH,
  },
  reconciliation: {
    intent: "reconciliation",
    title: "Reconciliation",
    steps: [
      { name: "stage reconciliation worklist" },
      { name: "queue variance review" },
      { name: "prepare reconciliation proposal" },
    ],
    proposalSummary:
      "Reconciliation work staged for review: worklist, variance review, and reconciliation proposal.",
    riskLevel: RISK_LEVELS.MEDIUM,
  },
  "invoice-review": {
    intent: "invoice-review",
    title: "Invoice review",
    steps: [
      { name: "stage invoice-review worklist" },
      { name: "queue line-item checks" },
      { name: "prepare invoice review proposal" },
    ],
    proposalSummary:
      "Invoice-review work staged for review: worklist, line-item checks, and review proposal.",
    riskLevel: RISK_LEVELS.LOW,
  },
  "compliance-check": {
    intent: "compliance-check",
    title: "Compliance check",
    steps: [
      { name: "stage compliance checklist" },
      { name: "queue policy-gap review" },
      { name: "prepare compliance proposal" },
    ],
    proposalSummary:
      "Compliance work staged for review: checklist, policy-gap review, and compliance proposal.",
    riskLevel: RISK_LEVELS.HIGH,
  },
} as const satisfies Readonly<Record<MissionIntent, IntentPlan>>;

/** Deterministic plan for every frozen mission intent. */
export const INTENT_PLANS: Readonly<Record<MissionIntent, IntentPlan>> = PLANS;

/** The frozen mission intents the agents layer orchestrates. */
export const AGENT_INTENTS: readonly MissionIntent[] = [
  "monthly-close",
  "correction",
  "reconciliation",
  "invoice-review",
  "compliance-check",
];
