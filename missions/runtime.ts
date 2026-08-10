/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * MissionRuntime — durable mission state machine over the protocol types.
 *
 * Mirrors the API's MissionsService semantics (validateTransition,
 * guardTerminal, reconcileTransition, optimistic version checks, idempotency
 * replay) as a runtime that depends only on the store/event/idempotency ports.
 *
 * Idempotency: a command's canonical payload hash (SHA-256 over key-sorted
 * JSON, matching the API middleware's canonicalization concept) is bound to
 * the idempotency key. Reusing a key with a different payload throws
 * IdempotencyConflict; reusing it with the same payload replays the cached
 * result without re-executing. Event types map per command: STATE_TRANSITION
 * for execute, APPROVAL_DECIDED for approve/reject, RECONCILED for reconcile.
 */

import { createHash, randomUUID } from "node:crypto";
import type {
  CreateMissionCommand,
  MissionCommand,
} from "./commands.js";
import {
  AccountingMissionStatus,
  VALID_TRANSITIONS,
} from "./status.js";
import { MissionError, MissionErrorCode, isMissionError } from "./errors.js";
import { MissionEventType, type MissionEvent } from "./events.js";
import type { MissionSnapshot } from "./types.js";
import { guardTerminal, reconcileTransition, transition } from "./transitions.js";
import type { IdempotencyConflict as IdempotencyConflictDetail } from "./idempotency.js";
import type {
  IdempotencyRecord,
  IdempotencyStore,
  MissionEventStore,
  MissionStore,
} from "./store.js";
import type { IntentRegistry } from "./intents.js";
import { assertFence, type FenceStore } from "./fencing.js";
import {
    reconcileExternalCall,
    type ExternalCall,
    type ExternalSystemResolver,
    type ReconciliationResult,
} from "./reconciliation.js";

/** Idempotency records are retained for 24 hours. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Canonical key-sorted JSON serialization. Mirrors the API middleware's
 * canonicalization concept (sorted keys, no whitespace) so identical commands
 * always produce identical hashes regardless of property insertion order.
 */
function sortedStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => sortedStringify(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${sortedStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Canonical payload hash of a mission command: SHA-256 hex over the
 * key-sorted JSON of the command.
 */
export function canonicalHash(command: unknown): string {
  return createHash("sha256")
    .update(sortedStringify(command), "utf-8")
    .digest("hex");
}

/**
 * Concrete idempotency conflict error implementing the protocol's
 * IdempotencyConflict shape. `originalPayload`/`newPayload` carry the
 * canonical payload hashes (the fingerprint drenyra-ai retains; full original
 * payloads are never persisted).
 */
export class IdempotencyConflict extends Error implements IdempotencyConflictDetail {
  public readonly key: string;
  public readonly originalPayload: unknown;
  public readonly newPayload: unknown;
  public readonly originalTimestamp: string;

  constructor(detail: IdempotencyConflictDetail) {
    super(
      `IDEMPOTENCY_CONFLICT: idempotency key "${detail.key}" was reused with a different command payload`,
    );
    this.name = "IdempotencyConflict";
    this.key = detail.key;
    this.originalPayload = detail.originalPayload;
    this.newPayload = detail.newPayload;
    this.originalTimestamp = detail.originalTimestamp;
  }
}

/** Result of a non-replayed apply: the new snapshot plus its event. */
export interface MissionApplyResult {
  snapshot: MissionSnapshot;
  event: MissionEvent;
  replayed?: boolean;
}

/**
 * A mission command bound to its mission id.
 *
 * The protocol's MissionCommand union carries type + payload only; the API
 * routes missionId as a path parameter. The runtime's apply() therefore takes
 * the command plus the mission id it targets. Fiscal convention: monetary
 * values in the Drenyra ecosystem are BigInt cents; no float is ever used for
 * money; sequence/index/version fields are JSON integers, never floats.
 */
export type BoundMissionCommand = MissionCommand & { missionId: string };

/** Cached successful apply outcome stored in the idempotency record. */
interface CachedApplyResult {
  snapshot: MissionSnapshot;
  event: MissionEvent;
}

/** Cached failure outcome stored in the idempotency record. */
interface CachedErrorResult {
  error: {
    code: string;
    message: string;
    statusCode?: number;
    details?: Record<string, unknown>;
  };
}

function isCachedApplyResult(result: unknown): result is CachedApplyResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }
  const record = result as Record<string, unknown>;
  const snapshot = record.snapshot as Record<string, unknown> | undefined;
  const event = record.event as Record<string, unknown> | undefined;
  return (
    typeof snapshot === "object" &&
    snapshot !== null &&
    typeof snapshot.id === "string" &&
    typeof event === "object" &&
    event !== null &&
    typeof event.id === "string"
  );
}

function isCachedErrorResult(result: unknown): result is CachedErrorResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }
  const record = result as Record<string, unknown>;
  const error = record.error as Record<string, unknown> | undefined;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

function toErrorRecord(error: unknown): CachedErrorResult["error"] {
  if (isMissionError(error)) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }
  return { code: "INTERNAL_ERROR", message: String(error) };
}

    /**
     * Default states considered in-flight after a restart, derived from the
     * protocol's legal transition table: only states whose VALID_TRANSITIONS
     * include UNKNOWN as a target are auto-recovered. Per the canonical table
     * that is RUNNING alone. Human-pause states (WAITING_FOR_EVIDENCE,
     * BLOCKED_BY_GATE) and auto-retry (RETRYING) are deliberately NOT
     * auto-recovered — a restart must not silently lose a human-wait state.
     * Callers with a different recovery policy (e.g. Drenyra's API recovery
     * hook) may pass an explicit status list to recoverIncomplete().
     */
    const DEFAULT_RECOVERABLE: readonly AccountingMissionStatus[] = [
      ...[...VALID_TRANSITIONS.entries()]
        .filter(([, targets]) =>
          targets.has(AccountingMissionStatus.UNKNOWN),
        )
        .map(([from]) => from),
    ];

    /**
     * Durable mission lifecycle runtime.
     */
export class MissionRuntime {
  private readonly store: MissionStore;
  private readonly events: MissionEventStore;
  private readonly idempotency: IdempotencyStore;
  private readonly registry: IntentRegistry | undefined;
  private readonly fenceStore: FenceStore | undefined;

  constructor(options: {
    store: MissionStore;
    events: MissionEventStore;
    idempotency: IdempotencyStore;
    registry?: IntentRegistry;
    fenceStore?: FenceStore;
  }) {
    this.store = options.store;
    this.events = options.events;
    this.idempotency = options.idempotency;
    this.registry = options.registry;
    this.fenceStore = options.fenceStore;
  }

  /**
   * Creates a new DRAFT mission (version 1) and appends its first
   * STATE_TRANSITION event (sequence 1).
   */
  async start(command: CreateMissionCommand): Promise<MissionSnapshot> {
    const missionId = `mission_${randomUUID()}`;
    const now = new Date().toISOString();
    const started: MissionSnapshot = {
      id: missionId,
      companyId: command.companyId,
      fiscalPeriod: command.fiscalPeriod,
      intent: command.intent,
      status: AccountingMissionStatus.DRAFT,
      version: 1,
      progress: 0,
      steps: [],
      currentStep: "",
      blockers: [],
      proposal: null,
      rejection: null,
      receiptId: null,
      receiptHash: null,
      lastEventSequence: 1,
      createdAt: now,
      updatedAt: now,
    };
    const event: MissionEvent = {
      id: `evt_${randomUUID()}`,
      missionId,
      sequence: 1,
      eventType: MissionEventType.STATE_TRANSITION,
      snapshot: started,
      createdAt: now,
    };
    await this.store.save(started);
    await this.events.append(event);
    return started;
  }

  /**
   * Applies one mission command with idempotency replay and optimistic
   * concurrency control.
   *
   * Pipeline (mirrors the API's MissionsService semantics):
   *   1. Idempotency: EXECUTING/COMPLETED records replay the cached result;
   *      a reused key with a different canonical payload hash throws
   *      IdempotencyConflict.
   *   2. Load mission; MISSION_NOT_FOUND if absent. Record EXECUTING.
   *   3. Optimistic concurrency: stale expectedMissionVersion throws
   *      VERSION_CONFLICT.
   *   4. guardTerminal rejects mutations on COMPLETED/FAILED missions.
   *   5. Resolve the target status per command type and validate the
   *      transition (execute may delegate to the intent handler).
   *   6. Bump version, append the event, save, complete idempotency.
   */
  async apply(
    command: BoundMissionCommand,
    ctx: {
    idempotencyKey?: string;
    expectedMissionVersion?: number;
    fenceToken?: number;
  } = {},
  ): Promise<MissionApplyResult> {
    if (command.type === "create") {
      throw new MissionError(
        MissionErrorCode.INVALID_INPUT,
        400,
        "create commands are handled by MissionRuntime.start()",
      );
    }

    const idempotencyKey = ctx.idempotencyKey;
    const payloadHash =
      idempotencyKey === undefined ? undefined : canonicalHash(command);

    // 1. Idempotency: replay or conflict when the key was already used.
    if (idempotencyKey !== undefined) {
      const record = await this.idempotency.get(idempotencyKey);
      if (record !== undefined) {
        if (record.payloadHash !== payloadHash) {
          throw new IdempotencyConflict({
            key: idempotencyKey,
            originalPayload: record.payloadHash,
            newPayload: payloadHash ?? "",
            originalTimestamp: this.createdAtOf(record),
          });
        }
        const replayed = this.replay(record);
        if (replayed !== null) {
          return replayed;
        }
        // EXECUTING with no cached outcome yet: reflect the current mission
        // state without re-executing the mutation.
        const current = await this.store.findById(command.missionId);
        if (current !== undefined) {
          const events = await this.events.list(current.id);
          const last = events[events.length - 1];
          if (last !== undefined) {
            return { snapshot: current, event: last, replayed: true };
          }
        }
        throw new MissionError(
          MissionErrorCode.ALREADY_EXECUTING,
          409,
          `ALREADY_EXECUTING: idempotency key "${idempotencyKey}" is executing with no visible outcome yet`,
          { idempotencyKey },
        );
      }
    }

    // 2. Load mission.
    const mission = await this.store.findById(command.missionId);
    if (mission === undefined) {
      throw new MissionError(
        MissionErrorCode.MISSION_NOT_FOUND,
        404,
        `MISSION_NOT_FOUND: Mission ${command.missionId} not found`,
        { missionId: command.missionId },
      );
    }

    // Record idempotency EXECUTING before any mutation.
    if (idempotencyKey !== undefined) {
      const now = Date.now();
      await this.idempotency.put({
        key: idempotencyKey,
        payloadHash: payloadHash as string,
        status: "EXECUTING",
        result: { createdAt: new Date(now).toISOString() },
        expiresAt: now + IDEMPOTENCY_TTL_MS,
      });
    }

    try {
      // 3. Optimistic concurrency.
      const expected =
        ctx.expectedMissionVersion ?? this.expectedVersionFrom(command);
      if (expected !== undefined && expected !== mission.version) {
        throw new MissionError(
          MissionErrorCode.VERSION_CONFLICT,
          409,
          `VERSION_CONFLICT: expected ${expected}, got ${mission.version}`,
          { expected, current: mission.version },
        );
      }

      // 3b. Fencing: a stale worker token is rejected before any mutation.
      if (this.fenceStore !== undefined && ctx.fenceToken !== undefined) {
        await assertFence(this.fenceStore, command.missionId, ctx.fenceToken);
      }

      // 4. Terminal guard.
      guardTerminal(mission.status);

      // 5. Resolve and validate the target status.
      const target = await this.resolveTarget(mission, command);

      // 6. Bump version, append event, save, complete idempotency.
      const next = this.nextSnapshot(mission, target.status, target.base);
      const event = this.buildEvent(next, target.eventType);
      await this.store.save(next);
      await this.events.append(event);

      if (idempotencyKey !== undefined) {
        await this.idempotency.put({
          key: idempotencyKey,
          payloadHash: payloadHash as string,
          status: "COMPLETED",
          result: {
            snapshot: next,
            event,
            createdAt: new Date().toISOString(),
          },
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      return { snapshot: next, event };
    } catch (error) {
      if (idempotencyKey !== undefined) {
        await this.idempotency.put({
          key: idempotencyKey,
          payloadHash: payloadHash as string,
          status: "FAILED",
          result: {
            error: toErrorRecord(error),
            createdAt: new Date().toISOString(),
          },
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      throw error;
    }
  }

  /**
   * Marks missions that may have been interrupted by a restart as UNKNOWN.
   *
   * The default status set is derived from the protocol's VALID_TRANSITIONS
   * map (only RUNNING can legally reach UNKNOWN), so a restart never silently
   * loses a human-wait state (WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE) or an
   * in-flight retry (RETRYING). Callers with an explicit recovery policy may
   * pass their own status list. Already-UNKNOWN missions are returned
   * unchanged. The MissionEvent type carries no actor field, so recovery
   * events are ordinary STATE_TRANSITION events; the "system" actor is
   * implied by the recovery semantics.
   */
  async recoverIncomplete(
    statuses: readonly AccountingMissionStatus[] = DEFAULT_RECOVERABLE,
  ): Promise<MissionSnapshot[]> {
    const missions = await this.store.findByStatus([...statuses]);
    const recovered: MissionSnapshot[] = [];
    for (const mission of missions) {
      if (mission.status === AccountingMissionStatus.UNKNOWN) {
        recovered.push(mission);
        continue;
      }
      const next = this.nextSnapshot(
        mission,
        AccountingMissionStatus.UNKNOWN,
        mission,
      );
      const event = this.buildEvent(next, MissionEventType.STATE_TRANSITION);
      await this.store.save(next);
      await this.events.append(event);
      recovered.push(next);
    }
    return recovered;
  }

    /**
     * Reconciles an interrupted external call (Design 04 "Unknown states").
     *
     * Requires the mission to be UNKNOWN; calls reconcileExternalCall and:
     *   record  -> UNKNOWN -> RUNNING, evidence recorded as a RECONCILED event
     *   retry   -> UNKNOWN -> RUNNING (idempotent retry is safe)
     *   human   -> stays UNKNOWN; the professional decides
     *
     * Never re-executes on its own and never records external execution
     * without verifiable evidence (reconcileExternalCall enforces this).
     */
    async reconcile(
        missionId: string,
        call: ExternalCall,
        resolver: ExternalSystemResolver | undefined,
    ): Promise<{ result: ReconciliationResult; snapshot: MissionSnapshot }> {
        const mission = await this.store.findById(missionId);
        if (mission === undefined) {
            throw new MissionError(
                MissionErrorCode.MISSION_NOT_FOUND,
                404,
                `MISSION_NOT_FOUND: Mission ${missionId} not found`,
                { missionId },
            );
        }
        if (mission.status !== AccountingMissionStatus.UNKNOWN) {
            throw new MissionError(
                MissionErrorCode.INVALID_INPUT,
                400,
                `reconcile requires UNKNOWN status, got ${mission.status}`,
                { missionId, status: mission.status },
            );
        }
        const result = await reconcileExternalCall(resolver, call);
        if (result.decision === "human-intervention") {
            // Stays UNKNOWN: the professional decides. No transition.
            return { result, snapshot: mission };
        }
        const next = this.nextSnapshot(mission, AccountingMissionStatus.RUNNING, mission);
        const event = this.buildEvent(next, MissionEventType.RECONCILED);
        await this.store.save(next);
        await this.events.append(event);
        return { result, snapshot: next };
    }

  private replay(record: IdempotencyRecord): MissionApplyResult | null {
    if (record.result === undefined) {
      return null;
    }
    if (isCachedApplyResult(record.result)) {
      return {
        snapshot: record.result.snapshot,
        event: record.result.event,
        replayed: true,
      };
    }
    if (record.status === "FAILED" && isCachedErrorResult(record.result)) {
      const error = record.result.error;
      throw new MissionError(
        error.code as MissionErrorCode,
        error.statusCode,
        error.message,
        error.details,
      );
    }
    return null;
  }

  private createdAtOf(record: IdempotencyRecord): string {
    const result = record.result;
    if (typeof result === "object" && result !== null) {
      const createdAt = (result as Record<string, unknown>).createdAt;
      if (typeof createdAt === "string") {
        return createdAt;
      }
    }
    return new Date(record.expiresAt).toISOString();
  }

  /**
   * Reads the optimistic concurrency expectation from a command payload.
   * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
   * cents; no float is ever used for money in drenyra-ai.
   */
  private expectedVersionFrom(command: BoundMissionCommand): number | undefined {
    const payload = command.payload as unknown as Record<string, unknown>;
    const expected = payload.expectedMissionVersion;
    return typeof expected === "number" ? expected : undefined;
  }

  private async resolveTarget(
    mission: MissionSnapshot,
    command: MissionCommand,
  ): Promise<{ status: AccountingMissionStatus; base: MissionSnapshot; eventType: MissionEventType }> {
    switch (command.type) {
      case "execute": {
        const handler = this.registry?.resolve(mission.intent);
        if (handler !== undefined) {
          const result = await handler.execute(mission, command.payload);
          if (result !== null) {
            transition(mission.status, result.status);
            return {
              status: result.status,
              base: result,
              eventType: MissionEventType.STATE_TRANSITION,
            };
          }
        }
        const status = AccountingMissionStatus.RUNNING;
        transition(mission.status, status);
        return {
          status,
          base: mission,
          eventType: MissionEventType.STATE_TRANSITION,
        };
      }
      case "approve": {
        const status = AccountingMissionStatus.APPROVED;
        transition(mission.status, status);
        return { status, base: mission, eventType: MissionEventType.APPROVAL_DECIDED };
      }
      case "reject": {
        const status = AccountingMissionStatus.REJECTED;
        transition(mission.status, status);
        return { status, base: mission, eventType: MissionEventType.APPROVAL_DECIDED };
      }
      case "reconcile": {
        const resolution = command.payload
          .resolution as AccountingMissionStatus;
        const status = reconcileTransition(mission.status, resolution);
        return { status, base: mission, eventType: MissionEventType.RECONCILED };
      }
      default:
        throw new MissionError(
          MissionErrorCode.INVALID_INPUT,
          400,
          `Unsupported mission command type`,
        );
    }
  }

  private nextSnapshot(
    mission: MissionSnapshot,
    status: AccountingMissionStatus,
    base: MissionSnapshot,
  ): MissionSnapshot {
    const now = new Date().toISOString();
    return {
      ...base,
      id: mission.id,
      companyId: mission.companyId,
      fiscalPeriod: mission.fiscalPeriod,
      intent: mission.intent,
      status,
      version: mission.version + 1,
      lastEventSequence: mission.lastEventSequence + 1,
      updatedAt: now,
    };
  }

  private buildEvent(
    snapshot: MissionSnapshot,
    eventType: MissionEventType,
  ): MissionEvent {
    return {
      id: `evt_${randomUUID()}`,
      missionId: snapshot.id,
      sequence: snapshot.lastEventSequence,
      eventType,
      snapshot,
      createdAt: snapshot.updatedAt,
    };
  }
}
