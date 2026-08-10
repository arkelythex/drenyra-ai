/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * Agent orchestration tests.
 *
 * Covers: registry composition (one distinct deterministic handler per frozen
 * MissionIntent), the full staged lifecycle for every intent (stage -> activate
 * -> evidence gate -> approval gate -> human approve -> finalize), determinism
 * of handler results, and the "no claimed side effects" invariant (zero
 * evidence bound, no receipt, approval only via a human approve command).
 */

import { describe, expect, it } from "vitest";
import { canonicalHash } from "../../missions/index.js";
import { AccountingMissionStatus } from "../../missions/index.js";
import { MissionRuntime } from "../../missions/index.js";
import {
  InMemoryIdempotencyStore,
  InMemoryMissionEventStore,
  InMemoryMissionStore,
} from "../../missions/store.js";
import type {
  BoundMissionCommand,
  CreateMissionCommand,
  MissionIntent,
  MissionSnapshot,
} from "../../missions/index.js";
import {
  AGENT_HANDLERS,
  AGENT_INTENTS,
  INTENT_PLANS,
  createAgentRegistry,
  monthlyCloseHandler,
} from "../index.js";

const S = AccountingMissionStatus;

function setup() {
  const registry = createAgentRegistry();
  const runtime = new MissionRuntime({
    store: new InMemoryMissionStore(),
    events: new InMemoryMissionEventStore(),
    idempotency: new InMemoryIdempotencyStore(),
    registry,
  });
  return { registry, runtime };
}

function createCommand(
  intent: MissionIntent,
  companyId = "20123456789",
): CreateMissionCommand {
  return {
    companyId,
    fiscalPeriod: "202501",
    intent,
    input: { instruction: `run ${intent}` },
  };
}

function executeCommand(
  missionId: string,
  expectedMissionVersion: number,
): BoundMissionCommand {
  return {
    type: "execute",
    missionId,
    payload: { expectedMissionVersion },
  };
}

async function applyExecute(
  runtime: MissionRuntime,
  missionId: string,
  expectedMissionVersion: number,
): Promise<MissionSnapshot> {
  const result = await runtime.apply(executeCommand(missionId, expectedMissionVersion), {
    expectedMissionVersion,
  });
  return result.snapshot;
}

function approveCommand(
  mission: MissionSnapshot,
  expectedMissionVersion: number,
): BoundMissionCommand {
  return {
    type: "approve",
    missionId: mission.id,
    payload: {
      proposalId: mission.proposal?.id ?? "proposal_missing",
      proposalVersion: mission.proposal?.version ?? 1,
      evidenceHash: mission.proposal?.evidenceHash ?? "",
      expectedMissionVersion,
    },
  };
}

function makeSnapshot(
  id: string,
  status: AccountingMissionStatus,
  version: number,
): MissionSnapshot {
  const at = "2026-07-30T12:00:00Z";
  return {
    id,
    companyId: "20123456789",
    fiscalPeriod: "202501",
    intent: "monthly-close",
    status,
    version,
    progress: 3,
    steps: [
      { id: "step_1", name: "stage period-cutoff checklist", status: "COMPLETED", completedAt: at },
      { id: "step_2", name: "queue posting-review worklist", status: "COMPLETED", completedAt: at },
      { id: "step_3", name: "prepare close proposal", status: "COMPLETED", completedAt: at },
    ],
    currentStep: "",
    blockers: [],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence: version,
    createdAt: at,
    updatedAt: at,
  };
}

describe("agent registry composition", () => {
  it("registers a distinct deterministic handler for every frozen mission intent", () => {
    const registry = createAgentRegistry();
    expect(AGENT_HANDLERS).toHaveLength(AGENT_INTENTS.length);
    for (const intent of AGENT_INTENTS) {
      expect(registry.resolve(intent)?.intent).toBe(intent);
    }
    const resolved = AGENT_INTENTS.map((intent) => registry.resolve(intent)?.intent);
    expect(resolved.every((intent) => intent !== undefined)).toBe(true);
    expect(new Set(resolved).size).toBe(AGENT_INTENTS.length);
  });

  it("returns a fresh, isolated registry per call", () => {
    const registry = createAgentRegistry();
    const other = createAgentRegistry();
    other.register({ intent: "monthly-close", execute: async () => null });
    expect(registry.resolve("monthly-close")?.intent).toBe("monthly-close");
    expect(other.resolve("monthly-close")?.intent).toBe("monthly-close");
  });
});

describe("deterministic staged lifecycle", () => {
  for (const intent of AGENT_INTENTS) {
    it(`drives ${intent} through the staged lifecycle to gated completion`, async () => {
      const plan = INTENT_PLANS[intent];
      const { runtime } = setup();
      const started = await runtime.start(createCommand(intent));
      expect(started.status).toBe(S.DRAFT);

      // Stage + activate: the plan is staged (PENDING), then activated.
      const queued = await applyExecute(runtime, started.id, 1);
      expect(queued.status).toBe(S.QUEUED);
      expect(queued.steps.map((step) => step.name)).toEqual(
        plan.steps.map((step) => step.name),
      );
      expect(queued.steps.every((step) => step.status === "PENDING")).toBe(true);
      expect(queued.progress).toBe(0);

      const running = await applyExecute(runtime, started.id, 2);
      expect(running.status).toBe(S.RUNNING);
      expect(running.steps[0].status).toBe("IN_PROGRESS");

      // Evidence gate: one staged step completed per run cycle.
      const gated1 = await applyExecute(runtime, started.id, 3);
      expect(gated1.status).toBe(S.WAITING_FOR_EVIDENCE);
      expect(gated1.progress).toBe(1);
      expect(gated1.steps[0].status).toBe("COMPLETED");
      expect(gated1.steps[1].status).toBe("IN_PROGRESS");

      await applyExecute(runtime, started.id, 4);
      const gated2 = await applyExecute(runtime, started.id, 5);
      expect(gated2.status).toBe(S.WAITING_FOR_EVIDENCE);
      expect(gated2.progress).toBe(2);
      expect(gated2.steps[1].status).toBe("COMPLETED");
      expect(gated2.steps[2].status).toBe("IN_PROGRESS");

      // Approval gate: plan fully staged as a proposal with zero claimed evidence.
      await applyExecute(runtime, started.id, 6);
      const awaiting = await applyExecute(runtime, started.id, 7);
      expect(awaiting.status).toBe(S.AWAITING_APPROVAL);
      expect(awaiting.progress).toBe(plan.steps.length);
      expect(awaiting.steps.every((step) => step.status === "COMPLETED")).toBe(true);
      expect(awaiting.currentStep).toBe("");
      expect(awaiting.receiptId).toBeNull();
      expect(awaiting.receiptHash).toBeNull();
      expect(awaiting.proposal).not.toBeNull();
      expect(awaiting.proposal?.missionId).toBe(awaiting.id);
      expect(awaiting.proposal?.evidence).toEqual([]);
      expect(awaiting.proposal?.evidenceHash).toBe(canonicalHash([]));
      expect(awaiting.proposal?.summary).toBe(plan.proposalSummary);
      expect(awaiting.proposal?.riskLevel).toBe(plan.riskLevel);

      // Human approval (Core gate), then finalize on the next execute.
      const approved = await runtime.apply(approveCommand(awaiting, 8), {
        expectedMissionVersion: 8,
      });
      expect(approved.snapshot.status).toBe(S.APPROVED);

      const completed = await applyExecute(runtime, started.id, 9);
      expect(completed.status).toBe(S.COMPLETED);
      expect(completed.progress).toBe(plan.steps.length);
      expect(completed.steps.every((step) => step.status === "COMPLETED")).toBe(true);
    });
  }
});

describe("handler determinism and staging-only invariant", () => {
  it("returns identical results for identical snapshots", async () => {
    const base = makeSnapshot("mission_det", S.RUNNING, 4);
    const command = { expectedMissionVersion: 4 };
    const first = await monthlyCloseHandler.execute(base, command);
    const second = await monthlyCloseHandler.execute(base, command);
    expect(first).toEqual(second);
    // Fully staged plan: the next execute stages the proposal, nothing more.
    const staged = first as MissionSnapshot;
    expect(staged.status).toBe(S.AWAITING_APPROVAL);
    expect(staged.proposal?.id).toBe("proposal_mission_det");
    expect(staged.proposal?.version).toBe(4);
    expect(staged.proposal?.evidence).toEqual([]);
  });

  it("never proposes approval by itself: approval requires a human command", async () => {
    const base = makeSnapshot("mission_det_2", S.AWAITING_APPROVAL, 8);
    const result = await monthlyCloseHandler.execute(base, { expectedMissionVersion: 8 });
    expect(result).toBeNull();
  });
});
