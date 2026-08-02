/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 *
 * recovery contract conformance (v0.1 FROZEN).
 *
 * Pins the normative surface of contracts/recovery.md against the public library
 * API (recovery/index.js — policy.js + replay.js only, no internals; the public
 * missions/runtime.js `recoverIncomplete` for the idempotency pass). Every
 * assertion here is a contract statement: the per-state recovery-action table
 * (in-flight → recover-to-unknown, UNKNOWN → decide-by-evidence, human-wait →
 * leave, terminal → terminal), decide-by-evidence on the last UNKNOWN marker,
 * event-log replay where the LAST PERSISTED EVENT wins (with empty, malformed,
 * and cross-mission logs rejected), and idempotent recovery (re-running on
 * already-handled missions yields no new events). If the implementation drifts,
 * this suite fails in CI and the change requires a major version bump (see the
 * contract's "Freeze record").
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
  type MissionSnapshot,
} from "../../missions/index.js";
import {
  decideUnknownRecovery,
  recoveryAction,
  replayMission,
  type RecoveryAction,
  type UnknownRecoveryOutcome,
} from "../../recovery/index.js";

const S = AccountingMissionStatus;

function makeSnapshot(
  overrides: Partial<MissionSnapshot> &
    Pick<MissionSnapshot, "id" | "status" | "version">,
): MissionSnapshot {
  return {
    companyId: "20123456789",
    fiscalPeriod: "202507",
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
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
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
    id: `evt_${missionId}_${sequence}`,
    missionId,
    sequence,
    eventType,
    snapshot,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("recovery §Action vocabulary (frozen 0.1)", () => {
  it("pins the four recovery actions exactly as the doc's table", () => {
    const actions: readonly RecoveryAction[] = [
      "recover-to-unknown",
      "decide-by-evidence",
      "leave",
      "terminal",
    ];
    expect(actions).toEqual([
      "recover-to-unknown",
      "decide-by-evidence",
      "leave",
      "terminal",
    ]);
  });

  it("pins the decide-by-evidence outcome vocabulary", () => {
    const outcomes: readonly UnknownRecoveryOutcome[] = [
      "completed",
      "failed",
      "running",
    ];
    expect(outcomes).toEqual(["completed", "failed", "running"]);
  });
});

describe("recovery §recoveryAction — per-state table (frozen 0.1)", () => {
  it("maps every canonical state to the action the doc's table defines", () => {
    const pinned: Readonly<Record<AccountingMissionStatus, RecoveryAction>> = {
      [S.DRAFT]: "leave",
      [S.QUEUED]: "leave",
      [S.RUNNING]: "recover-to-unknown",
      [S.BLOCKED]: "leave",
      [S.AWAITING_APPROVAL]: "leave",
      [S.APPROVED]: "leave",
      [S.REJECTED]: "leave",
      [S.REVISION_REQUESTED]: "leave",
      [S.COMPLETED]: "terminal",
      [S.FAILED]: "terminal",
      [S.UNKNOWN]: "decide-by-evidence",
      [S.RECOVERING]: "leave", // legacy member: "any other state → leave"
      [S.WAITING_FOR_EVIDENCE]: "leave",
      [S.BLOCKED_BY_GATE]: "leave",
      [S.RETRYING]: "recover-to-unknown",
    };
    for (const status of Object.values(AccountingMissionStatus)) {
      expect(
        recoveryAction(status, []),
        `action for ${status}`,
      ).toBe(pinned[status]);
    }
  });

  it("marks RUNNING as recover-to-unknown (in-flight when the crash hit)", () => {
    const events = [
      makeEvent(
        "mission_policy_running",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_policy_running", status: S.RUNNING, version: 3 }),
      ),
    ];
    expect(recoveryAction(S.RUNNING, events)).toBe("recover-to-unknown");
  });

  it("marks RETRYING as recover-to-unknown (in-flight automatic retry)", () => {
    const events = [
      makeEvent(
        "mission_policy_retrying",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_policy_retrying", status: S.RETRYING, version: 4 }),
      ),
    ];
    expect(recoveryAction(S.RETRYING, events)).toBe("recover-to-unknown");
  });

  it("marks UNKNOWN as decide-by-evidence", () => {
    const events = [
      makeEvent(
        "mission_policy_unknown",
        1,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_policy_unknown", status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(recoveryAction(S.UNKNOWN, events)).toBe("decide-by-evidence");
  });

  it("leaves WAITING_FOR_EVIDENCE and BLOCKED_BY_GATE alone (human-wait, never auto-recovered)", () => {
    const waiting = [
      makeEvent(
        "mission_policy_waiting",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_policy_waiting", status: S.WAITING_FOR_EVIDENCE, version: 2 }),
      ),
    ];
    const gated = [
      makeEvent(
        "mission_policy_gated",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_policy_gated", status: S.BLOCKED_BY_GATE, version: 2 }),
      ),
    ];
    expect(recoveryAction(S.WAITING_FOR_EVIDENCE, waiting)).toBe("leave");
    expect(recoveryAction(S.BLOCKED_BY_GATE, gated)).toBe("leave");
  });

  it("never touches terminal states (COMPLETED/FAILED → terminal)", () => {
    const completed = [
      makeEvent(
        "mission_policy_completed",
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_policy_completed", status: S.COMPLETED, version: 5 }),
      ),
    ];
    const failed = [
      makeEvent(
        "mission_policy_failed",
        1,
        MissionEventType.FAILED,
        makeSnapshot({ id: "mission_policy_failed", status: S.FAILED, version: 5 }),
      ),
    ];
    expect(recoveryAction(S.COMPLETED, completed)).toBe("terminal");
    expect(recoveryAction(S.FAILED, failed)).toBe("terminal");
  });

  it("treats the last persisted event as the source of truth (event log beats the passed status)", () => {
    // The passed status says RUNNING, but the last persisted event proves COMPLETED.
    const events = [
      makeEvent(
        "mission_policy_sot",
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_policy_sot", status: S.COMPLETED, version: 5 }),
      ),
    ];
    expect(recoveryAction(S.RUNNING, events)).toBe("terminal");
  });

  it("falls back to the passed status when the log is empty", () => {
    expect(recoveryAction(S.RUNNING, [])).toBe("recover-to-unknown");
    expect(recoveryAction(S.UNKNOWN, [])).toBe("decide-by-evidence");
  });
});

describe("recovery §decide-by-evidence (frozen 0.1)", () => {
  it("resolves to completed when a COMPLETED event follows the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        "mission_unknown_1",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_unknown_1", status: S.RUNNING, version: 1 }),
      ),
      makeEvent(
        "mission_unknown_1",
        2,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_1", status: S.UNKNOWN, version: 2 }),
      ),
      makeEvent(
        "mission_unknown_1",
        3,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_unknown_1", status: S.COMPLETED, version: 3 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "completed" });
  });

  it("resolves to failed when a FAILED event follows the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        "mission_unknown_2",
        1,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_2", status: S.UNKNOWN, version: 2 }),
      ),
      makeEvent(
        "mission_unknown_2",
        2,
        MissionEventType.FAILED,
        makeSnapshot({ id: "mission_unknown_2", status: S.FAILED, version: 3 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "failed" });
  });

  it("reconciles to running when no terminal event follows the last UNKNOWN marker", () => {
    const events = [
      makeEvent(
        "mission_unknown_3",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_unknown_3", status: S.RUNNING, version: 1 }),
      ),
      makeEvent(
        "mission_unknown_3",
        2,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_3", status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("ignores terminal events BEFORE the last UNKNOWN marker (old evidence)", () => {
    const events = [
      makeEvent(
        "mission_unknown_4",
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_unknown_4", status: S.COMPLETED, version: 1 }),
      ),
      makeEvent(
        "mission_unknown_4",
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_unknown_4", status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("considers only the LAST UNKNOWN marker (evidence after an earlier resume is stale)", () => {
    // UNKNOWN, then resumed RUNNING, then UNKNOWN again, then COMPLETED: the
    // COMPLETED after the final marker decides.
    const decided = [
      makeEvent(
        "mission_unknown_5",
        1,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_5", status: S.UNKNOWN, version: 2 }),
      ),
      makeEvent(
        "mission_unknown_5",
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_unknown_5", status: S.RUNNING, version: 3 }),
      ),
      makeEvent(
        "mission_unknown_5",
        3,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_5", status: S.UNKNOWN, version: 4 }),
      ),
      makeEvent(
        "mission_unknown_5",
        4,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_unknown_5", status: S.COMPLETED, version: 5 }),
      ),
    ];
    expect(decideUnknownRecovery(decided)).toEqual({ outcome: "completed" });
    // Terminal evidence that predates the FINAL marker is stale again.
    const stale = [
      makeEvent(
        "mission_unknown_5",
        1,
        MissionEventType.COMPLETED,
        makeSnapshot({ id: "mission_unknown_5", status: S.COMPLETED, version: 1 }),
      ),
      makeEvent(
        "mission_unknown_5",
        2,
        MissionEventType.UNKNOWN,
        makeSnapshot({ id: "mission_unknown_5", status: S.UNKNOWN, version: 2 }),
      ),
    ];
    expect(decideUnknownRecovery(stale)).toEqual({ outcome: "running" });
  });

  it("reconciles to running with no UNKNOWN marker at all", () => {
    const events = [
      makeEvent(
        "mission_unknown_6",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_unknown_6", status: S.RUNNING, version: 1 }),
      ),
    ];
    expect(decideUnknownRecovery(events)).toEqual({ outcome: "running" });
  });

  it("reconciles to running on an empty log (missing terminal event is no evidence, never assumed completed)", () => {
    expect(decideUnknownRecovery([])).toEqual({ outcome: "running" });
  });
});

describe("recovery §replayMission — last persisted event wins (frozen 0.1)", () => {
  it("rebuilds the exact final snapshot of a full lifecycle (start + execute x3 + approve → APPROVED v5)", () => {
    const missionId = "mission_replay_full";
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

  it("returns the LAST persisted event's snapshot verbatim (resume from last persisted event)", () => {
    const missionId = "mission_replay_last";
    const last = makeEvent(
      missionId,
      3,
      MissionEventType.FAILED,
      makeSnapshot({ id: missionId, status: S.FAILED, version: 3 }),
    );
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
        MissionEventType.COMPLETED,
        makeSnapshot({ id: missionId, status: S.COMPLETED, version: 2 }),
      ),
      last,
    ];
    const replayed = replayMission(events);
    // The crash never rolls the mission back to a stale snapshot.
    expect(replayed).toEqual(last.snapshot);
    expect(replayed).toBe(last.snapshot);
  });

  it("throws a clear error on an empty log", () => {
    expect(() => replayMission([])).toThrow(/empty event log/);
  });

  it("throws a clear error on a malformed log (non-increasing sequences)", () => {
    const missionId = "mission_replay_order";
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

  it("throws a clear error on a malformed log (non-integer sequence)", () => {
    const missionId = "mission_replay_float";
    const events = [
      makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 1 }),
      ),
      {
        ...makeEvent(
          missionId,
          2.5,
          MissionEventType.STATE_TRANSITION,
          makeSnapshot({ id: missionId, status: S.QUEUED, version: 2 }),
        ),
      },
    ];
    expect(() => replayMission(events)).toThrow(/non-integer sequence/);
  });

  it("throws a clear error on a cross-mission log", () => {
    const events = [
      makeEvent(
        "mission_replay_a",
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_replay_a", status: S.DRAFT, version: 1 }),
      ),
      makeEvent(
        "mission_replay_b",
        2,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: "mission_replay_b", status: S.RUNNING, version: 2 }),
      ),
    ];
    expect(() => replayMission(events)).toThrow(/malformed log/);
  });

  it("throws a clear error when an event carries no valid MissionSnapshot", () => {
    const missionId = "mission_replay_bad";
    const bad = {
      ...makeEvent(
        missionId,
        1,
        MissionEventType.STATE_TRANSITION,
        makeSnapshot({ id: missionId, status: S.RUNNING, version: 1 }),
      ),
      snapshot: { id: missionId } as unknown as MissionSnapshot, // missing status/version: structurally invalid
    };
    expect(() => replayMission([bad])).toThrow(/no valid MissionSnapshot/);
  });
});

describe("recovery §idempotent recovery (frozen 0.1)", () => {
  async function setupRunningMissions(count: number): Promise<{
    runtime: MissionRuntime;
    events: InMemoryMissionEventStore;
    missionIds: string[];
  }> {
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
      intent: "monthly-close",
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
    const missionIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const started = await runtime.start({
        companyId: "20123456789",
        fiscalPeriod: "202507",
        intent: "monthly-close",
        input: { instruction: `close july books ${i}` },
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
      missionIds.push(started.id);
    }
    return { runtime, events: stores.events, missionIds };
  }

  it("marks an in-flight RUNNING mission UNKNOWN exactly once; a second pass yields no new events", async () => {
    const { runtime, events, missionIds } = await setupRunningMissions(1);
    const missionId = missionIds[0];

    const before = await events.list(missionId);
    expect(before).toHaveLength(3); // start + 2 executes

    // First pass: RUNNING -> UNKNOWN, one new STATE_TRANSITION event.
    const firstPass = await runtime.recoverIncomplete([S.RUNNING, S.UNKNOWN]);
    expect(firstPass).toHaveLength(1);
    expect(firstPass[0].status).toBe(S.UNKNOWN);
    expect(firstPass[0].version).toBe(4);
    const afterFirst = await events.list(missionId);
    expect(afterFirst).toHaveLength(4);
    expect(afterFirst[3].eventType).toBe(MissionEventType.STATE_TRANSITION);
    expect(afterFirst[3].snapshot.status).toBe(S.UNKNOWN);

    // Second pass: already UNKNOWN — returned unchanged, no new event, same version.
    const secondPass = await runtime.recoverIncomplete([S.RUNNING, S.UNKNOWN]);
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0].status).toBe(S.UNKNOWN);
    expect(secondPass[0].version).toBe(4);
    expect(secondPass[0].updatedAt).toBe(firstPass[0].updatedAt);
    expect(await events.list(missionId)).toHaveLength(4);
  });

  it("appends at most one STATE_TRANSITION event per in-flight mission across a pass", async () => {
    const { runtime, events, missionIds } = await setupRunningMissions(2);
    const [first, second] = missionIds;
    const recovered = await runtime.recoverIncomplete([S.RUNNING, S.UNKNOWN]);
    expect(recovered).toHaveLength(2);
    for (const mission of recovered) {
      expect(mission.status).toBe(S.UNKNOWN);
    }
    // Each in-flight mission gained exactly one recovery event.
    expect(await events.list(first)).toHaveLength(4);
    expect(await events.list(second)).toHaveLength(4);
  });
});
