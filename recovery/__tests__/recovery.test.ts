/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Recovery tests — per-state policy actions, decision-by-evidence, event-log
 * replay, and idempotent recovery (contract: contracts/recovery.md).
 *
 * Uses Arrange-Act-Assert per the Drenyra testing skill: behavior-named tests
 * co-located in __tests__/, no mocks needed (in-memory stores + node:crypto).
 */

import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  IntentRegistryImpl,
  InMemoryIdempotencyStore,
  InMemoryMissionEventStore,
  InMemoryMissionStore,
  MissionEventType,
  MissionRuntime,
  type MissionEvent,
  type MissionIntent,
  type MissionSnapshot,
} from "../../missions/index.js";
import {
  decideUnknownRecovery,
  recoveryAction,
} from "../policy.js";
import { replayMission } from "../replay.js";

const S = AccountingMissionStatus;

function makeSnapshot(
  overrides: Partial<MissionSnapshot> &
    Pick<MissionSnapshot, "id" | "status" | "version">,
): MissionSnapshot {
  return {
    companyId: "20123456789",
    fiscalPeriod: "202501",
    intent: "monthly-close",
    progress: 0,
    steps: [],
    currentStep: "",
    blockers: [],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence: overrides.version,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(
  missionId: string,
  sequence: number,
  eventType: MissionEventType,
  snapshot: MissionSnapshot,
): MissionEvent {
  return {
    id: `evt_${sequence}`,
    missionId,
    sequence,
    eventType,
    snapshot,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("recoveryAction: per-state policy", () => {
  const missionId = "mission_policy_1";

  it("maps RUNNING to recover-to-unknown (in-flight)", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 3 }),
      ),
    ];
    expect(recoveryAction(S.RUNNING, events)).toBe("recover-to-unknown");
  });

  it("maps RETRYING to recover-to-unknown (in-flight retry)", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RETRYING, version: 4 }),
      ),
    ];
    expect(recoveryAction(S.RETRYING, events)).toBe("recover-to-unknown");
  });

  it("maps UNKNOWN to decide-by-evidence", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: missionId, status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(recoveryAction(S.UNKNOWN, events)).toBe("decide-by-evidence");
  });

  it("leaves WAITING_FOR_EVIDENCE and BLOCKED_BY_GATE alone (human-wait)", () => {
    const waiting = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.WAITING_FOR_EVIDENCE, version: 2 }),
      ),
    ];
    const gated = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.BLOCKED_BY_GATE, version: 2 }),
      ),
    ];
    expect(recoveryAction(S.WAITING_FOR_EVIDENCE, waiting)).toBe("leave");
    expect(recoveryAction(S.BLOCKED_BY_GATE, gated)).toBe("leave");
  });

  it("never touches terminal states", () => {
    const completed = [
      makeEvent(
        missionId,
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: missionId, status: S.COMPLETED, version: 5 }),
      ),
    ];
    const failed = [
      makeEvent(
        missionId,
        1,
        MissionEventType.FAILED,
        makeSnapshot({ id: missionId, status: S.FAILED, version: 5 }),
      ),
    ];
    expect(recoveryAction(S.COMPLETED, completed)).toBe("terminal");
    expect(recoveryAction(S.FAILED, failed)).toBe("terminal");
  });

  it("leaves non-in-flight states (DRAFT, AWAITING_APPROVAL) alone", () => {
    const draft = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.DRAFT, version: 1 }),
      ),
    ];
    const awaiting = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.AWAITING_APPROVAL, version: 4 }),
      ),
    ];
    expect(recoveryAction(S.DRAFT, draft)).toBe("leave");
    expect(recoveryAction(S.AWAITING_APPROVAL, awaiting)).toBe("leave");
  });

  it("trusts the event log over the passed status (source of truth)", () => {
    // Persisted status says RUNNING, but the last persisted event proves COMPLETED.
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: missionId, status: S.COMPLETED, version: 5 }),
      ),
    ];
    expect(recoveryAction(S.RUNNING, events)).toBe("terminal");
  });

  it("falls back to the passed status when the log is empty", () => {
    expect(recoveryAction(S.RUNNING, [])).toBe("recover-to-unknown");
  });
});

describe("decideUnknownRecovery: decide by evidence", () => {
  const missionId = "mission_unknown_1";

  it("resolves to completed when a COMPLETED event exists after the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 1 }),
      ),
      makeEvent(
        missionId,
        2,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: missionId, status: S.UNKNOWN, version: 2 }),
      ),
      makeEvent(
        missionId,
        3,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: missionId, status: S.COMPLETED, version: 3 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "completed" });
  });

  it("resolves to failed when a FAILED event exists after the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.UNKNOWN, version: 2 }),
      ),
      makeEvent(
        missionId,
        2,
        MissionEventType.FAILED,
        makeSnapshot({ id: missionId, status: S.FAILED, version: 3 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "failed" });
  });

  it("reconciles to running when no terminal event follows the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 1 }),
      ),
      makeEvent(
        missionId,
        2,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: missionId, status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("ignores terminal events BEFORE the last UNKNOWN marker", () => {
    // A terminal event that precedes the UNKNOWN marker is old evidence, not
    // evidence of what happened after the mission went unknown.
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: missionId, status: S.COMPLETED, version: 1 }),
      ),
      makeEvent(
        missionId,
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("reconciles to running with no UNKNOWN marker at all", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 1 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("reconciles to running on an empty log (no evidence)", () => {
    expect(decideUnknownRecovery([])).toEqual({ outcome: "running" });
  });
});

describe("replayMission: resume from the last persisted event", () => {
  const missionId = "mission_replay_1";

  it("reconstructs the exact final snapshot of a full lifecycle (start + execute x3 + approve -> APPROVED v5)", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.DRAFT, version: 1 }),
      ),
      makeEvent(
        missionId,
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.QUEUED, version: 2 }),
      ),
      makeEvent(
        missionId,
        3,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 3 }),
      ),
      makeEvent(
        missionId,
        4,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.AWAITING_APPROVAL, version: 4 }),
      ),
      makeEvent(
        missionId,
        5,
        MissionEventType.APPROVAL_DECIDED,
        makeSnapshot({ id: missionId, status: S.APPROVED, version: 5 }),
      ),
    ];
    const replayed = replayMission(events);
    expect(replayed.status).toBe(S.APPROVED);
    expect(replayed.version).toBe(5);
    expect(replayed.lastEventSequence).toBe(5);
    expect(replayed.id).toBe(missionId);
  });

  it("throws a clear error on an empty log", () => {
    expect(() => replayMission([])).toThrow(/empty event log/);
  });

  it("throws a clear error on a malformed log (out-of-order sequences)", () => {
    const events = [
      makeEvent(
        missionId,
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 2 }),
      ),
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.DRAFT, version: 1 }),
      ),
    ];
    expect(() => replayMission(events)).toThrow(/strictly increasing/);
  });

  it("throws a clear error when events span different missions", () => {
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.DRAFT, version: 1 }),
      ),
      makeEvent(
        "mission_replay_other",
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_replay_other", status: S.RUNNING, version: 2 }),
      ),
    ];
    expect(() => replayMission(events)).toThrow(/malformed log/);
  });
});

describe("idempotent recovery: re-running is a no-op for handled missions", () => {
  it("marks a RUNNING mission UNKNOWN once; a second pass changes nothing", async () => {
    const stores = {
      missions: new InMemoryMissionStore(),
      events: new InMemoryMissionEventStore(),
      idempotency: new InMemoryIdempotencyStore(),
    };
    const registry = new IntentRegistryImpl();
    const advance: Record<string, AccountingMissionStatus> = {
      DRAFT: S.QUEUED,
      QUEUED: S.RUNNING,
    };
    registry.register({
      intent: "monthly-close" as MissionIntent,
      execute: async (mission) =>
        advance[mission.status] === undefined
          ? null
          : { ...mission, status: advance[mission.status] },
    });
    const runtime = new MissionRuntime({
      store: stores.missions,
      events: stores.events,
      idempotency: stores.idempotency,
      registry,
    });

    const started = await runtime.start({
      companyId: "20123456789",
      fiscalPeriod: "202501",
      intent: "monthly-close",
      input: { instruction: "close january books" },
    });
    await runtime.apply({
      type: "execute",
      missionId: started.id,
      payload: { expectedMissionVersion: 1 },
    });
    await runtime.apply({
      type: "execute",
      missionId: started.id,
      payload: { expectedMissionVersion: 2 },
    });

    const before = await stores.missions.findById(started.id);
    expect(before?.status).toBe(S.RUNNING);
    expect(before?.version).toBe(3);
    const eventsBefore = await stores.events.list(started.id);
    expect(eventsBefore).toHaveLength(3);

    // First pass: RUNNING -> UNKNOWN (one new STATE_TRANSITION event).
    const firstPass = await runtime.recoverIncomplete([S.RUNNING, S.UNKNOWN]);
    expect(firstPass).toHaveLength(1);
    expect(firstPass[0].status).toBe(S.UNKNOWN);
    expect(firstPass[0].version).toBe(4);
    expect(await stores.events.list(started.id)).toHaveLength(4);

    // Second pass: the mission is already UNKNOWN — returned unchanged, no new
    // event, same version. Recovery is idempotent: re-running is a no-op for
    // handled missions.
    const secondPass = await runtime.recoverIncomplete([S.RUNNING, S.UNKNOWN]);
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0].status).toBe(S.UNKNOWN);
    expect(secondPass[0].version).toBe(4);
    expect(secondPass[0].updatedAt).toBe(firstPass[0].updatedAt);
    expect(await stores.events.list(started.id)).toHaveLength(4);

    const after = await stores.missions.findById(started.id);
    expect(after?.status).toBe(S.UNKNOWN);
    expect(after?.version).toBe(4);
  });
});
