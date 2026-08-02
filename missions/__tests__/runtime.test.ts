/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MissionRuntime end-to-end tests.
 *
 * Covers the full lifecycle, illegal transitions, terminal guards, optimistic
 * concurrency, idempotency replay/conflict, event sequencing, and
 * recoverIncomplete. A scripted auto-advance intent handler drives the
 * DRAFT→QUEUED→RUNNING→AWAITING_APPROVAL steps that the runtime would
 * otherwise delegate to a real intent pipeline.
 */

import { describe, expect, it } from "vitest";
import {
  MissionRuntime,
  IdempotencyConflict,
  type BoundMissionCommand,
} from "../runtime.js";
import { MissionError, MissionErrorCode } from "../errors.js";
import { AccountingMissionStatus } from "../status.js";
import { MissionEventType } from "../events.js";
import {
  InMemoryMissionStore,
  InMemoryMissionEventStore,
  InMemoryIdempotencyStore,
  type MissionStore,
} from "../store.js";
import { IntentRegistryImpl, type IntentHandler } from "../intents.js";
import type {
  CreateMissionCommand,
  MissionIntent,
} from "../commands.js";
import type { MissionSnapshot } from "../types.js";

const S = AccountingMissionStatus;

/** Next single legal step for the scripted auto-advance handler. */
function advanceStatus(
  status: AccountingMissionStatus,
): AccountingMissionStatus | null {
  switch (status) {
    case S.DRAFT:
      return S.QUEUED;
    case S.QUEUED:
      return S.RUNNING;
    case S.RUNNING:
      return S.AWAITING_APPROVAL;
    case S.APPROVED:
      return S.COMPLETED;
    case S.REVISION_REQUESTED:
      return S.QUEUED;
    case S.BLOCKED:
    case S.WAITING_FOR_EVIDENCE:
    case S.BLOCKED_BY_GATE:
    case S.RETRYING:
    case S.RECOVERING:
    case S.UNKNOWN:
      return S.RUNNING;
    case S.REJECTED:
      return S.REVISION_REQUESTED;
    case S.AWAITING_APPROVAL:
    case S.COMPLETED:
    case S.FAILED:
      return null;
  }
}

/** Scripted intent handler that advances the mission one legal step. */
function makeHandler(): IntentHandler & { callCount: number } {
  const handler: IntentHandler & { callCount: number } = {
    intent: "monthly-close" as MissionIntent,
    callCount: 0,
    async execute(mission: MissionSnapshot) {
      handler.callCount += 1;
      const next = advanceStatus(mission.status);
      if (next === null) {
        return null;
      }
      return { ...mission, status: next };
    },
  };
  return handler;
}

function setup() {
  const store = new InMemoryMissionStore();
  const events = new InMemoryMissionEventStore();
  const idempotency = new InMemoryIdempotencyStore();
  const registry = new IntentRegistryImpl();
  const runtime = new MissionRuntime({ store, events, idempotency, registry });
  return { store, events, idempotency, registry, runtime };
}

function createCommand(
  overrides?: Partial<CreateMissionCommand>,
): CreateMissionCommand {
  return {
    companyId: "company-1",
    fiscalPeriod: "2026-07",
    intent: "monthly-close",
    input: { instruction: "Close books for 2026-07" },
    ...overrides,
  };
}

/**
 * Builds an execute command bound to a mission. Fiscal convention: monetary
 * values in the Drenyra ecosystem are BigInt cents; no float is ever used for
 * money; sequence/index/version fields are JSON integers, never floats.
 */
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

function approveCommand(
  missionId: string,
  expectedMissionVersion: number,
): BoundMissionCommand {
  return {
    type: "approve",
    missionId,
    payload: {
      proposalId: "prop-1",
      proposalVersion: 1,
      evidenceHash: "abc",
      expectedMissionVersion,
    },
  };
}

function makeSnapshot(
  id: string,
  status: AccountingMissionStatus,
  version: number,
  lastEventSequence: number,
): MissionSnapshot {
  const now = "2026-07-30T12:00:00.000Z";
  return {
    id,
    companyId: "company-1",
    fiscalPeriod: "2026-07",
    intent: "monthly-close",
    status,
    version,
    progress: 0,
    steps: [],
    currentStep: "",
    blockers: [],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence,
    createdAt: now,
    updatedAt: now,
  };
}

async function driveToRunning(
  runtime: MissionRuntime,
  store: MissionStore,
): Promise<MissionSnapshot> {
  const started = await runtime.start(createCommand());
  await runtime.apply(executeCommand(started.id, 1), {
    expectedMissionVersion: 1,
  });
  await runtime.apply(executeCommand(started.id, 2), {
    expectedMissionVersion: 2,
  });
  const mission = await store.findById(started.id);
  if (mission === undefined) {
    throw new Error("mission missing after drive");
  }
  return mission;
}

describe("MissionRuntime", () => {
  it("start creates a DRAFT mission at version 1 with its first event", async () => {
    const { runtime, events } = setup();
    const started = await runtime.start(createCommand());
    expect(started.status).toBe(S.DRAFT);
    expect(started.version).toBe(1);
    expect(started.lastEventSequence).toBe(1);
    expect(started.proposal).toBeNull();
    const log = await events.list(started.id);
    expect(log).toHaveLength(1);
    expect(log[0].sequence).toBe(1);
    expect(log[0].eventType).toBe(MissionEventType.STATE_TRANSITION);
    expect(log[0].snapshot.status).toBe(S.DRAFT);
  });

  it("drives the full lifecycle via apply()", async () => {
    const { runtime, events, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());

    const queued = await runtime.apply(executeCommand(started.id, 1), {
      expectedMissionVersion: 1,
    });
    expect(queued.snapshot.status).toBe(S.QUEUED);
    expect(queued.snapshot.version).toBe(2);

    const running = await runtime.apply(executeCommand(started.id, 2), {
      expectedMissionVersion: 2,
    });
    expect(running.snapshot.status).toBe(S.RUNNING);
    expect(running.snapshot.version).toBe(3);

    const awaiting = await runtime.apply(executeCommand(started.id, 3), {
      expectedMissionVersion: 3,
    });
    expect(awaiting.snapshot.status).toBe(S.AWAITING_APPROVAL);
    expect(awaiting.snapshot.version).toBe(4);

    const approved = await runtime.apply(approveCommand(started.id, 4), {
      expectedMissionVersion: 4,
    });
    expect(approved.snapshot.status).toBe(S.APPROVED);
    expect(approved.snapshot.version).toBe(5);

    const completed = await runtime.apply(executeCommand(started.id, 5), {
      expectedMissionVersion: 5,
    });
    expect(completed.snapshot.status).toBe(S.COMPLETED);
    expect(completed.snapshot.version).toBe(6);

    // Event sequence is monotonic 1..n and each event embeds its snapshot.
    const log = await events.list(started.id);
    expect(log.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(log.map((e) => e.eventType)).toEqual([
      MissionEventType.STATE_TRANSITION,
      MissionEventType.STATE_TRANSITION,
      MissionEventType.STATE_TRANSITION,
      MissionEventType.STATE_TRANSITION,
      MissionEventType.APPROVAL_DECIDED,
      MissionEventType.STATE_TRANSITION,
    ]);
    expect(log[5].snapshot.status).toBe(S.COMPLETED);
    for (let i = 1; i < log.length; i++) {
      expect(log[i].sequence).toBe(log[i - 1].sequence + 1);
    }
  });

  it("rejects an illegal transition (DRAFT->APPROVED) with INVALID_TRANSITION", async () => {
    const { runtime, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());
    try {
      await runtime.apply(approveCommand(started.id, 1), {
        expectedMissionVersion: 1,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(
        MissionErrorCode.INVALID_TRANSITION,
      );
      expect((error as MissionError).statusCode).toBe(409);
    }
  });

  it("rejects any command on a COMPLETED mission with TERMINAL_STATE_GUARD", async () => {
    const { runtime, store, registry } = setup();
    registry.register(makeHandler());
    await driveToRunning(runtime, store);
    const mission = await store.list();
    const completedMission = mission[0];
    await runtime.apply(executeCommand(completedMission.id, 3), {
      expectedMissionVersion: 3,
    });
    await runtime.apply(approveCommand(completedMission.id, 4), {
      expectedMissionVersion: 4,
    });
    await runtime.apply(executeCommand(completedMission.id, 5), {
      expectedMissionVersion: 5,
    });
    try {
      await runtime.apply(executeCommand(completedMission.id, 6), {
        expectedMissionVersion: 6,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(
        MissionErrorCode.TERMINAL_STATE_GUARD,
      );
      expect((error as MissionError).statusCode).toBe(409);
    }
  });

  it("rejects a stale expectedMissionVersion with VERSION_CONFLICT", async () => {
    const { runtime, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());
    await runtime.apply(executeCommand(started.id, 1), {
      expectedMissionVersion: 1,
    });

    // Stale ctx version.
    try {
      await runtime.apply(executeCommand(started.id, 1), {
        expectedMissionVersion: 1,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(MissionErrorCode.VERSION_CONFLICT);
    }

    // Stale payload version (no ctx override).
    try {
      await runtime.apply(executeCommand(started.id, 1));
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(MissionErrorCode.VERSION_CONFLICT);
    }
  });

  it("throws MISSION_NOT_FOUND for an unknown mission", async () => {
    const { runtime } = setup();
    try {
      await runtime.apply(executeCommand("mission-missing", 1), {
        expectedMissionVersion: 1,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(MissionErrorCode.MISSION_NOT_FOUND);
      expect((error as MissionError).statusCode).toBe(404);
    }
  });

  it("rejects create commands through apply() (use start instead)", async () => {
    const { runtime } = setup();
    try {
      await runtime.apply({
        type: "create",
        missionId: "mission-create",
        payload: createCommand(),
      } as BoundMissionCommand);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(MissionErrorCode.INVALID_INPUT);
    }
  });

  it("replays an identical result for the same idempotency key without re-executing", async () => {
    const { runtime, registry } = setup();
    const handler = makeHandler();
    registry.register(handler);
    const started = await runtime.start(createCommand());

    const command = executeCommand(started.id, 1);
    const first = await runtime.apply(command, {
      idempotencyKey: "k-replay-1",
      expectedMissionVersion: 1,
    });
    expect(first.replayed).toBeUndefined();

    const second = await runtime.apply(command, {
      idempotencyKey: "k-replay-1",
    });
    expect(second.replayed).toBe(true);
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.event).toEqual(first.event);
    expect(handler.callCount).toBe(1);
  });

  it("throws IdempotencyConflict when a key is reused with a different payload", async () => {
    const { runtime, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());
    await runtime.apply(executeCommand(started.id, 1), {
      idempotencyKey: "k-conflict-1",
      expectedMissionVersion: 1,
    });
    try {
      await runtime.apply(approveCommand(started.id, 1), {
        idempotencyKey: "k-conflict-1",
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IdempotencyConflict);
      expect((error as IdempotencyConflict).key).toBe("k-conflict-1");
      expect((error as IdempotencyConflict).originalPayload).not.toBe(
        (error as IdempotencyConflict).newPayload,
      );
    }
  });

  it("reconciles an UNKNOWN mission to a valid recovery target", async () => {
    const { runtime, store } = setup();
    await store.save(makeSnapshot("mission-unknown-r", S.UNKNOWN, 2, 2));
    const reconciled = await runtime.apply(
      {
        type: "reconcile",
        missionId: "mission-unknown-r",
        payload: {
          resolution: "COMPLETED",
          reason: "evidence found during recovery",
          expectedMissionVersion: 2,
        },
      },
      { expectedMissionVersion: 2 },
    );
    expect(reconciled.snapshot.status).toBe(S.COMPLETED);
    expect(reconciled.snapshot.version).toBe(3);
  });

  it("rejects reconcile on a non-UNKNOWN mission", async () => {
    const { runtime, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());
    try {
      await runtime.apply(
        {
          type: "reconcile",
          missionId: started.id,
          payload: {
            resolution: "RUNNING",
            reason: "nope",
            expectedMissionVersion: 1,
          },
        },
        { expectedMissionVersion: 1 },
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissionError);
      expect((error as MissionError).code).toBe(
        MissionErrorCode.INVALID_TRANSITION,
      );
    }
  });

  it("recoverIncomplete recovers RUNNING by default and skips human-pause states", async () => {
    const { runtime, events, store, registry } = setup();
    registry.register(makeHandler());
    const started = await runtime.start(createCommand());
    await runtime.apply(executeCommand(started.id, 1), {
      expectedMissionVersion: 1,
    });
    await runtime.apply(executeCommand(started.id, 2), {
      expectedMissionVersion: 2,
    });
    await store.save(makeSnapshot("mission-stale-unknown", S.UNKNOWN, 3, 3));
    await store.save(
      makeSnapshot("mission-waiting-evidence", S.WAITING_FOR_EVIDENCE, 2, 2),
    );
    await store.save(makeSnapshot("mission-blocked-gate", S.BLOCKED_BY_GATE, 2, 2));
    await store.save(makeSnapshot("mission-retrying", S.RETRYING, 2, 2));

    const recovered = await runtime.recoverIncomplete();
    const byId = new Map(recovered.map((s) => [s.id, s]));

    // RUNNING is in the protocol-legal recoverable set (RUNNING -> UNKNOWN).
    const runningMission = byId.get(started.id);
    expect(runningMission).toBeDefined();
    expect(runningMission!.status).toBe(S.UNKNOWN);
    expect(runningMission!.version).toBe(4);

    // Human-pause and retry states are NOT auto-recovered by default: a
    // restart must not silently lose a human-wait state.
    expect(byId.get("mission-stale-unknown")).toBeUndefined();
    expect(byId.get("mission-waiting-evidence")).toBeUndefined();
    expect(byId.get("mission-blocked-gate")).toBeUndefined();
    expect(byId.get("mission-retrying")).toBeUndefined();

    const log = await events.list(started.id);
    expect(log).toHaveLength(4);
    expect(log[3].eventType).toBe(MissionEventType.STATE_TRANSITION);
    expect(log[3].snapshot.status).toBe(S.UNKNOWN);
  });

  it("recoverIncomplete honors an explicit status policy", async () => {
    const { runtime, store } = setup();
    await store.save(
      makeSnapshot("mission-waiting-evidence", S.WAITING_FOR_EVIDENCE, 2, 2),
    );

    const recovered = await runtime.recoverIncomplete([
      S.WAITING_FOR_EVIDENCE,
    ]);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].status).toBe(S.UNKNOWN);
  });
});
