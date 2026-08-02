/**
 * mission-protocol contract conformance (v0.1 FROZEN).
 *
 * Pins the normative surface of contracts/mission-protocol.md against the public
 * library API (missions/index.js only — no internals). Every assertion here is a
 * contract statement: if the implementation drifts, this suite fails in CI and
 * the change requires a major version bump (see the contract's "Freeze record").
 *
 * The contract doc's "Reference implementation" section delegates the normative
 * state machine to missions/status.ts (`14-state AccountingMissionStatus`,
 * `VALID_TRANSITIONS`, terminal sets, predicates). This suite therefore pins the
 * implemented table exhaustively: every listed from→to edge is legal, every
 * non-listed edge is rejected with INVALID_TRANSITION, and the pinned table must
 * equal the exported table exactly (byte-for-byte in value space).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */

import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  MissionError,
  MissionErrorCode,
  MissionEventType,
  MINIMUM_CLIENT_VERSION,
  PROTOCOL_VERSION,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  STATUS_LABELS,
  defaultIdempotencyKey,
  getCapabilities,
  guardTerminal,
  isClientCompatible,
  isMissionError,
  isValidIdempotencyKey,
  transition,
  validateTransition,
  MissionRuntime,
  InMemoryMissionStore,
  InMemoryMissionEventStore,
  InMemoryIdempotencyStore,
  IntentRegistryImpl,
  type BoundMissionCommand,
  type CreateMissionCommand,
  type IntentHandler,
  type MissionIntent,
  type MissionSnapshot,
} from "../../missions/index.js";

const S = AccountingMissionStatus;

// ─── §States: the 14 canonical states (11 original + 3 M4) ────────────────────
// The contract doc names status.ts a "14-state" machine; the enum also carries
// RECOVERING (an earlier milestone state), so the implemented member set is 15.
// Both facts are pinned below so any drift is caught either way.

const CANONICAL_STATES: readonly AccountingMissionStatus[] = [
  S.DRAFT,
  S.QUEUED,
  S.RUNNING,
  S.BLOCKED,
  S.AWAITING_APPROVAL,
  S.APPROVED,
  S.REJECTED,
  S.REVISION_REQUESTED,
  S.COMPLETED,
  S.FAILED,
  S.UNKNOWN,
  // M4 extended states
  S.WAITING_FOR_EVIDENCE,
  S.BLOCKED_BY_GATE,
  S.RETRYING,
];

// ─── §Transitions: pinned normative table (mirrors the doc's reference table) ──

const PINNED_TRANSITIONS: Readonly<
  Record<AccountingMissionStatus, readonly AccountingMissionStatus[]>
> = {
  [S.DRAFT]: [S.QUEUED],
  [S.QUEUED]: [S.RUNNING, S.FAILED],
  [S.RUNNING]: [
    S.BLOCKED,
    S.AWAITING_APPROVAL,
    S.COMPLETED,
    S.FAILED,
    S.UNKNOWN,
    S.WAITING_FOR_EVIDENCE,
    S.BLOCKED_BY_GATE,
    S.RETRYING,
  ],
  [S.BLOCKED]: [S.RUNNING, S.FAILED],
  [S.WAITING_FOR_EVIDENCE]: [S.RUNNING, S.FAILED],
  [S.BLOCKED_BY_GATE]: [S.RUNNING, S.AWAITING_APPROVAL, S.FAILED],
  [S.RECOVERING]: [S.RUNNING, S.FAILED],
  [S.RETRYING]: [S.RUNNING, S.FAILED],
  [S.AWAITING_APPROVAL]: [S.APPROVED, S.REJECTED, S.RUNNING],
  [S.APPROVED]: [S.COMPLETED, S.FAILED],
  [S.REJECTED]: [S.REVISION_REQUESTED],
  [S.REVISION_REQUESTED]: [S.QUEUED],
  [S.COMPLETED]: [],
  [S.FAILED]: [],
  [S.UNKNOWN]: [S.RUNNING, S.FAILED, S.COMPLETED],
};

// ─── §Errors: the 9 canonical families named by the contract doc ──────────────

const DOCUMENTED_FAMILIES: readonly string[] = [
  "AUTH",
  "TENANT",
  "VALIDATION",
  "CONCURRENCY",
  "IDEMPOTENCY",
  "MISSION_STATE",
  "EVIDENCE",
  "APPROVAL",
  "EXTERNAL_SYSTEM",
];

// ─── §Intents / commands: runtime helpers ─────────────────────────────────────

/** Next single legal step for the scripted auto-advance intent handler. */
function advanceStatus(status: AccountingMissionStatus): AccountingMissionStatus | null {
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
    case S.REJECTED:
      return S.REVISION_REQUESTED;
    case S.BLOCKED:
    case S.WAITING_FOR_EVIDENCE:
    case S.BLOCKED_BY_GATE:
    case S.RETRYING:
    case S.RECOVERING:
    case S.UNKNOWN:
      return S.RUNNING;
    case S.AWAITING_APPROVAL:
    case S.COMPLETED:
    case S.FAILED:
      return null;
  }
}

function makeHandler(intent: MissionIntent): IntentHandler {
  return {
    intent,
    async execute(mission: MissionSnapshot) {
      const next = advanceStatus(mission.status);
      if (next === null) {
        return null;
      }
      return { ...mission, status: next };
    },
  };
}

function setup() {
  const store = new InMemoryMissionStore();
  const events = new InMemoryMissionEventStore();
  const idempotency = new InMemoryIdempotencyStore();
  const registry = new IntentRegistryImpl();
  const runtime = new MissionRuntime({ store, events, idempotency, registry });
  return { store, events, idempotency, registry, runtime };
}

function createCommand(intent: MissionIntent = "monthly-close"): CreateMissionCommand {
  return {
    companyId: "20123456789",
    fiscalPeriod: "202607",
    intent,
    input: { instruction: "Close books for 2026-07" },
  };
}

function executeCommand(missionId: string, version: number): BoundMissionCommand {
  return { type: "execute", missionId, payload: { expectedMissionVersion: version } };
}

function approveCommand(missionId: string, version: number): BoundMissionCommand {
  return {
    type: "approve",
    missionId,
    payload: {
      proposalId: "prop-1",
      proposalVersion: 1,
      evidenceHash: "abc",
      expectedMissionVersion: version,
    },
  };
}

function rejectCommand(missionId: string, version: number): BoundMissionCommand {
  return {
    type: "reject",
    missionId,
    payload: {
      proposalId: "prop-1",
      proposalVersion: 1,
      reason: "outside scope",
      expectedMissionVersion: version,
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
    companyId: "20123456789",
    fiscalPeriod: "202607",
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

/** Drives a fresh mission to AWAITING_APPROVAL via the scripted handler. */
async function driveToAwaitingApproval(): Promise<{
  runtime: MissionRuntime;
  events: InMemoryMissionEventStore;
  missionId: string;
  version: number;
}> {
  const { runtime, events, registry } = setup();
  registry.register(makeHandler("monthly-close"));
  const started = await runtime.start(createCommand());
  await runtime.apply(executeCommand(started.id, 1), { expectedMissionVersion: 1 });
  await runtime.apply(executeCommand(started.id, 2), { expectedMissionVersion: 2 });
  await runtime.apply(executeCommand(started.id, 3), { expectedMissionVersion: 3 });
  return { runtime, events, missionId: started.id, version: 4 };
}

describe("mission-protocol §States (frozen 0.1)", () => {
  it("has the 14 canonical states (11 original + 3 M4) as enum members", () => {
    const members = new Set(Object.values(AccountingMissionStatus));
    expect(CANONICAL_STATES).toHaveLength(14);
    for (const state of CANONICAL_STATES) {
      expect(members.has(state), `missing canonical state ${state}`).toBe(true);
    }
  });

  it("pins the implemented member set exactly (15 members including RECOVERING)", () => {
    expect(Object.values(AccountingMissionStatus)).toEqual([
      S.DRAFT,
      S.QUEUED,
      S.RUNNING,
      S.BLOCKED,
      S.AWAITING_APPROVAL,
      S.APPROVED,
      S.REJECTED,
      S.REVISION_REQUESTED,
      S.COMPLETED,
      S.FAILED,
      S.UNKNOWN,
      S.RECOVERING,
      S.WAITING_FOR_EVIDENCE,
      S.BLOCKED_BY_GATE,
      S.RETRYING,
    ]);
  });

  it("labels every canonical state (STATUS_LABELS complete)", () => {
    for (const state of CANONICAL_STATES) {
      expect(STATUS_LABELS[state], `label for ${state}`).toBeDefined();
      expect(STATUS_LABELS[state].length).toBeGreaterThan(0);
    }
  });

  it("classifies exactly COMPLETED and FAILED as terminal", () => {
    expect([...TERMINAL_STATES].sort()).toEqual([S.COMPLETED, S.FAILED].sort());
    for (const state of CANONICAL_STATES) {
      const isTerminalState =
        state === S.COMPLETED || state === S.FAILED;
      expect(TERMINAL_STATES.has(state)).toBe(isTerminalState);
    }
  });
});

describe("mission-protocol §Transitions (frozen 0.1)", () => {
  it("matches the pinned normative table exactly", () => {
    const statuses = Object.values(AccountingMissionStatus);
    expect(VALID_TRANSITIONS.size).toBe(statuses.length);
    for (const from of statuses) {
      const pinned = PINNED_TRANSITIONS[from];
      const actual = VALID_TRANSITIONS.get(from);
      expect(actual, `missing table entry for ${from}`).toBeDefined();
      expect(
        [...(actual as Set<AccountingMissionStatus>)].sort(),
        `targets of ${from}`,
      ).toEqual([...pinned].sort());
    }
  });

  it("accepts every listed from→to edge", () => {
    const statuses = Object.values(AccountingMissionStatus);
    for (const from of statuses) {
      for (const to of PINNED_TRANSITIONS[from]) {
        expect(() => validateTransition(from, to), `${from} -> ${to}`).not.toThrow();
        expect(transition(from, to)).toBe(to);
      }
    }
  });

  it("rejects every non-listed edge with INVALID_TRANSITION (fail closed)", () => {
    const statuses = Object.values(AccountingMissionStatus);
    const listed = new Set(
      Object.entries(PINNED_TRANSITIONS).flatMap(([from, targets]) =>
        targets.map((to) => `${from}->${to}`),
      ),
    );
    let checked = 0;
    for (const from of statuses) {
      for (const to of statuses) {
        if (listed.has(`${from}->${to}`)) {
          continue;
        }
        checked += 1;
        let thrown: unknown;
        try {
          validateTransition(from, to);
        } catch (error) {
          thrown = error;
        }
        expect(thrown, `${from} -> ${to} must be rejected`).toBeInstanceOf(
          MissionError,
        );
        expect((thrown as MissionError).code).toBe(
          MissionErrorCode.INVALID_TRANSITION,
        );
      }
    }
    // 15 states × 15 targets = 225 pairs; 32 edges are listed; 193 are illegal.
    expect(checked).toBe(193);
  });

  it("guards terminal states: no mutation out of COMPLETED or FAILED", () => {
    for (const terminal of [S.COMPLETED, S.FAILED]) {
      let thrown: unknown;
      try {
        guardTerminal(terminal);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(MissionError);
      expect((thrown as MissionError).code).toBe(
        MissionErrorCode.TERMINAL_STATE_GUARD,
      );
      expect((thrown as MissionError).statusCode).toBe(409);
    }
  });
});

describe("mission-protocol §Commands (frozen 0.1)", () => {
  it("create: MissionRuntime.start() creates a DRAFT mission at version 1", async () => {
    const { runtime, events } = setup();
    const started = await runtime.start(createCommand());
    expect(started.status).toBe(S.DRAFT);
    expect(started.version).toBe(1);
    const log = await events.list(started.id);
    expect(log).toHaveLength(1);
    expect(log[0].eventType).toBe(MissionEventType.STATE_TRANSITION);
    expect(log[0].sequence).toBe(1);
  });

  it("create is not routed through apply() (INVALID_INPUT)", async () => {
    const { runtime } = setup();
    let thrown: unknown;
    try {
      await runtime.apply({
        type: "create",
        missionId: "mission-create",
        payload: createCommand(),
      } as BoundMissionCommand);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MissionError);
    expect((thrown as MissionError).code).toBe(MissionErrorCode.INVALID_INPUT);
  });

  it("execute: advances the mission and emits STATE_TRANSITION", async () => {
    const { runtime, registry } = setup();
    registry.register(makeHandler("monthly-close"));
    const started = await runtime.start(createCommand());
    const result = await runtime.apply(executeCommand(started.id, 1), {
      expectedMissionVersion: 1,
    });
    expect(result.snapshot.status).toBe(S.QUEUED);
    expect(result.event.eventType).toBe(MissionEventType.STATE_TRANSITION);
  });

  it("approve: AWAITING_APPROVAL -> APPROVED emits APPROVAL_DECIDED", async () => {
    const { runtime, missionId, version } = await driveToAwaitingApproval();
    const result = await runtime.apply(approveCommand(missionId, version), {
      expectedMissionVersion: version,
    });
    expect(result.snapshot.status).toBe(S.APPROVED);
    expect(result.event.eventType).toBe(MissionEventType.APPROVAL_DECIDED);
  });

  it("reject: AWAITING_APPROVAL -> REJECTED emits APPROVAL_DECIDED", async () => {
    const { runtime, missionId, version } = await driveToAwaitingApproval();
    const result = await runtime.apply(rejectCommand(missionId, version), {
      expectedMissionVersion: version,
    });
    expect(result.snapshot.status).toBe(S.REJECTED);
    expect(result.event.eventType).toBe(MissionEventType.APPROVAL_DECIDED);
  });

  it("reconcile: UNKNOWN -> recovery target emits RECONCILED", async () => {
    const { runtime, store } = setup();
    await store.save(makeSnapshot("mission-reconcile", S.UNKNOWN, 2, 2));
    const result = await runtime.apply(
      {
        type: "reconcile",
        missionId: "mission-reconcile",
        payload: {
          resolution: "COMPLETED",
          reason: "evidence found during recovery",
          expectedMissionVersion: 2,
        },
      },
      { expectedMissionVersion: 2 },
    );
    expect(result.snapshot.status).toBe(S.COMPLETED);
    expect(result.event.eventType).toBe(MissionEventType.RECONCILED);
  });
});

describe("mission-protocol §Intents (frozen 0.1)", () => {
  it("pins the mission intent vocabulary at the runtime surface", async () => {
    const intents: readonly MissionIntent[] = [
      "monthly-close",
      "correction",
      "reconciliation",
      "invoice-review",
      "compliance-check",
    ];
    expect(intents).toHaveLength(5);
    for (const intent of intents) {
      const { runtime, registry } = setup();
      registry.register(makeHandler(intent));
      const started = await runtime.start(createCommand(intent));
      expect(started.intent).toBe(intent);
      expect(registry.resolve(intent)).toBeDefined();
    }
  });
});

describe("mission-protocol §Events (frozen 0.1)", () => {
  it("pins the 12 MissionEventType values", () => {
    expect(Object.values(MissionEventType)).toEqual([
      "STATE_TRANSITION",
      "PROGRESS_UPDATE",
      "BLOCKER_ADDED",
      "BLOCKER_RESOLVED",
      "PROPOSAL_CREATED",
      "APPROVAL_DECIDED",
      "COMPLETED",
      "FAILED",
      "TIMEOUT",
      "UNKNOWN",
      "RECONCILED",
      "KEEPALIVE",
    ]);
  });
});

describe("mission-protocol §Versioning (frozen 0.1)", () => {
  it("declares PROTOCOL_VERSION 1.0 and MINIMUM_CLIENT_VERSION 1.0", () => {
    expect(PROTOCOL_VERSION).toBe("1.0");
    expect(MINIMUM_CLIENT_VERSION).toBe("1.0");
  });

  it("rejects unknown majors (consumers reject unknown majors)", () => {
    expect(isClientCompatible("1.0", "1.0")).toBe(true);
    expect(isClientCompatible("1.5", "1.0")).toBe(true);
    expect(isClientCompatible("0.9", "1.0")).toBe(false);
    expect(isClientCompatible("2.0", "1.0")).toBe(true);
  });

  it("exposes the capabilities envelope with protocol version + features", () => {
    const caps = getCapabilities();
    expect(caps.protocolVersion).toBe("1.0");
    expect(caps.minimumClientVersion).toBe("1.0");
    expect(caps.features.length).toBeGreaterThan(0);
    expect(caps.features).toContain("protocol.capabilities.v1");
  });
});

describe("mission-protocol §Idempotency (frozen 0.1)", () => {
  it("generates keys of shape <action>-<scope>-<timestamp>-<random>", () => {
    const key = defaultIdempotencyKey({ action: "create", scope: "mission-1" });
    expect(key.startsWith("create-mission-1-")).toBe(true);
    // The trailing segment is 8 hex chars from a UUID slice.
    const segments = key.split("-");
    expect(segments[segments.length - 1]).toMatch(/^[0-9a-f]{8}$/);
    expect(isValidIdempotencyKey(key)).toBe(true);
  });

  it("validates idempotency key shape (8..256 chars, [a-zA-Z0-9_-])", () => {
    expect(isValidIdempotencyKey("create-mission-1-12345678-abc")).toBe(true);
    expect(isValidIdempotencyKey("")).toBe(false);
    expect(isValidIdempotencyKey("a")).toBe(false);
    expect(isValidIdempotencyKey("a".repeat(257))).toBe(false);
    expect(isValidIdempotencyKey("key with spaces")).toBe(false);
    expect(isValidIdempotencyKey("key@special")).toBe(false);
    expect(isValidIdempotencyKey("key.with.dot")).toBe(false);
  });
});

describe("mission-protocol §Errors (frozen 0.1)", () => {
  it("pins the 30 canonical MissionErrorCode members", () => {
    expect(Object.values(MissionErrorCode)).toEqual([
      // AUTH
      "UNAUTHORIZED",
      "TOKEN_EXPIRED",
      "TOKEN_REVOKED",
      "INSUFFICIENT_SCOPE",
      // TENANT
      "TENANT_MISMATCH",
      "ORGANIZATION_NOT_FOUND",
      "COMPANY_NOT_FOUND",
      // VALIDATION
      "INVALID_INPUT",
      "MISSION_NOT_FOUND",
      "INVALID_PERIOD",
      "INVALID_INTENT",
      // CONCURRENCY
      "VERSION_CONFLICT",
      "ALREADY_EXECUTING",
      "TERMINAL_STATE_GUARD",
      // IDEMPOTENCY
      "IDEMPOTENCY_CONFLICT",
      // MISSION_STATE
      "INVALID_TRANSITION",
      "MISSION_STATE_CONFLICT",
      "UNKNOWN_STATE",
      "RECONCILIATION_FAILED",
      // EVIDENCE
      "EVIDENCE_MISMATCH",
      "EVIDENCE_NOT_FOUND",
      "EVIDENCE_EXPIRED",
      // APPROVAL
      "APPROVAL_ALREADY_DECIDED",
      "APPROVAL_INVALID_SIGNER",
      "PROPOSAL_VERSION_CONFLICT",
      "PROPOSAL_EXPIRED",
      // EXTERNAL_SYSTEM
      "HARNESS_TIMEOUT",
      "EXTERNAL_SERVICE_UNAVAILABLE",
      "SSE_CONNECTION_LOST",
      "RECEIPT_VERIFICATION",
    ]);
  });

  it("maps every canonical code to one of the 9 documented families", () => {
    const families = new Set<string>();
    for (const code of Object.values(MissionErrorCode)) {
      const error = new MissionError(code);
      expect(DOCUMENTED_FAMILIES, `family of ${code}`).toContain(error.family);
      families.add(error.family);
    }
    // Every documented family is reachable by at least one canonical code.
    for (const family of DOCUMENTED_FAMILIES) {
      expect(families.has(family), `family ${family} unreachable`).toBe(true);
    }
  });

  it("structures errors as code + message + retryable (unknown codes fail closed)", () => {
    const error = new MissionError(MissionErrorCode.INVALID_TRANSITION, 409, "no");
    expect(error.code).toBe("INVALID_TRANSITION");
    expect(error.message).toBe("no");
    expect(typeof error.isRetryable).toBe("boolean");

    // Unknown codes are not MissionErrors: the contract fails closed.
    expect(isMissionError(new Error("plain"))).toBe(false);
    expect(
      isMissionError({ name: "MissionError", code: "NOT_A_REAL_CODE" }),
    ).toBe(false);
    expect(isMissionError(null)).toBe(false);
  });

  it("marks exactly the transient-transport codes as retryable", () => {
    const retryable: MissionErrorCode[] = [
      MissionErrorCode.HARNESS_TIMEOUT,
      MissionErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      MissionErrorCode.SSE_CONNECTION_LOST,
      MissionErrorCode.VERSION_CONFLICT,
    ];
    const nonRetryable: MissionErrorCode[] = [
      MissionErrorCode.INVALID_INPUT,
      MissionErrorCode.INVALID_TRANSITION,
      MissionErrorCode.TERMINAL_STATE_GUARD,
      MissionErrorCode.IDEMPOTENCY_CONFLICT,
    ];
    for (const code of retryable) {
      expect(new MissionError(code).isRetryable, code).toBe(true);
    }
    for (const code of nonRetryable) {
      expect(new MissionError(code).isRetryable, code).toBe(false);
    }
  });
});
