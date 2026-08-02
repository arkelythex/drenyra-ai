/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Recovery policy — per-state recovery actions and UNKNOWN decision-by-evidence.
 *
 * Contract: contracts/recovery.md (v0.1-draft). The event log is the source of
 * truth: when the persisted status argument disagrees with the LAST PERSISTED
 * EVENT's embedded snapshot, the event log wins. Human-wait states are NEVER
 * auto-recovered; terminal states are never touched.
 */

import {
  AccountingMissionStatus,
  MissionEventType,
  type MissionEvent,
} from "../missions/index.js";
import type { MissionSnapshot } from "../missions/index.js";

/** The recovery action a policy pass should take for a mission. */
export type RecoveryAction =
  | "recover-to-unknown"
  | "decide-by-evidence"
  | "leave"
  | "terminal";

/** Outcome of an evidence-based UNKNOWN decision. */
export type UnknownRecoveryOutcome = "completed" | "failed" | "running";

/**
 * The event log is the source of truth: derive the authoritative status from
 * the last persisted event's embedded snapshot, falling back to the passed
 * status when the log is empty (a log can be empty only when no event was ever
 * persisted — the caller's stored status is then the only record).
 */
function effectiveStatus(
  status: AccountingMissionStatus,
  events: MissionEvent[],
): AccountingMissionStatus {
  const last = events[events.length - 1];
  if (last === undefined) {
    return status;
  }
  return last.snapshot.status;
}

/**
 * Maps a mission's current status to the recovery action the contract defines.
 *
 *   RUNNING / RETRYING             → "recover-to-unknown" (in-flight)
 *   UNKNOWN                        → "decide-by-evidence"
 *   WAITING_FOR_EVIDENCE / BLOCKED_BY_GATE → "leave" (human-wait, never auto)
 *   FAILED / COMPLETED             → "terminal" (never touched)
 *   any other state                → "leave" (not in-flight)
 *
 * @param status The status recorded on the mission (see effectiveStatus: the
 *   last persisted event wins when it disagrees).
 * @param events The mission's event log, in sequence order.
 */
export function recoveryAction(
  status: AccountingMissionStatus,
  events: MissionEvent[],
): RecoveryAction {
  const current = effectiveStatus(status, events);
  switch (current) {
    case AccountingMissionStatus.RUNNING:
    case AccountingMissionStatus.RETRYING:
      return "recover-to-unknown";
    case AccountingMissionStatus.UNKNOWN:
      return "decide-by-evidence";
    case AccountingMissionStatus.WAITING_FOR_EVIDENCE:
    case AccountingMissionStatus.BLOCKED_BY_GATE:
      return "leave";
    case AccountingMissionStatus.COMPLETED:
    case AccountingMissionStatus.FAILED:
      return "terminal";
    default:
      return "leave";
  }
}

/** True when the event is an UNKNOWN marker (typed UNKNOWN or snapshot UNKNOWN). */
function isUnknownMarker(event: MissionEvent): boolean {
  return (
    event.eventType === MissionEventType.UNKNOWN ||
    event.snapshot.status === AccountingMissionStatus.UNKNOWN
  );
}

/** True when the event proves a terminal outcome. */
function isTerminalEvent(event: MissionEvent): boolean {
  return (
    event.eventType === MissionEventType.COMPLETED ||
    event.eventType === MissionEventType.FAILED ||
    event.snapshot.status === AccountingMissionStatus.COMPLETED ||
    event.snapshot.status === AccountingMissionStatus.FAILED
  );
}

/**
 * Decides an UNKNOWN mission by evidence, per contracts/recovery.md:
 *
 * If a COMPLETED or FAILED event exists AFTER the last UNKNOWN marker, the
 * external operation actually terminated and that terminal outcome is returned.
 * Otherwise there is no evidence of effects and the mission reconciles to
 * "running" for retry. With no UNKNOWN marker at all, nothing was decided yet
 * and the mission is treated as running (no evidence of termination).
 */
export function decideUnknownRecovery(
  events: MissionEvent[],
): { outcome: UnknownRecoveryOutcome } {
  let lastUnknownIdx = -1;
  for (let i = 0; i < events.length; i++) {
    if (isUnknownMarker(events[i])) {
      lastUnknownIdx = i;
    }
  }
  if (lastUnknownIdx >= 0) {
    for (let i = lastUnknownIdx + 1; i < events.length; i++) {
      const event = events[i];
      if (isTerminalEvent(event)) {
        const terminal = event.snapshot.status;
        return {
          outcome:
            terminal === AccountingMissionStatus.COMPLETED
              ? "completed"
              : "failed",
        };
      }
    }
  }
  return { outcome: "running" };
}

/** Shape guard: structural validity of a MissionSnapshot (id + status). */
export function isValidSnapshot(snapshot: unknown): snapshot is MissionSnapshot {
  if (typeof snapshot !== "object" || snapshot === null) {
    return false;
  }
  const record = snapshot as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.status === "string" &&
    typeof record.version === "number"
  );
}
