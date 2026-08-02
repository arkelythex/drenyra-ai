/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Event-log replay — rebuilds a mission's state from its persisted event log.
 *
 * Contract: contracts/recovery.md (v0.1-draft). The event log is the source of
 * truth: every event carries the canonical MissionSnapshot that existed AFTER
 * that event, so replaying applies snapshots in sequence order and the LAST
 * PERSISTED EVENT wins. This is exactly the "resume from last persisted event"
 * property: a crash never rolls a mission back to a stale snapshot.
 */

import type { MissionEvent, MissionSnapshot } from "../missions/index.js";
import { isValidSnapshot } from "./policy.js";

/**
 * Rebuilds the authoritative mission snapshot from its event log.
 *
 * The log must be non-empty and well-formed:
 *   - at least one event, in strictly increasing `sequence` order,
 *   - every event belongs to the same `missionId`,
 *   - every event carries a structurally valid snapshot.
 *
 * The returned snapshot is the last event's embedded snapshot (the state that
 * existed after the last persisted event). Throws a clear Error on an empty or
 * malformed log — a log that cannot be replayed must never silently produce a
 * partial state.
 */
export function replayMission(events: MissionEvent[]): MissionSnapshot {
  if (events.length === 0) {
    throw new Error("replayMission: cannot replay an empty event log");
  }
  const missionId = events[0].missionId;
  let previousSequence = -1;
  for (const event of events) {
    if (event.missionId !== missionId) {
      throw new Error(
        `replayMission: malformed log — event ${event.id} targets mission ${event.missionId}, expected ${missionId}`,
      );
    }
    if (typeof event.sequence !== "number" || !Number.isInteger(event.sequence)) {
      throw new Error(
        `replayMission: malformed log — event ${event.id} has a non-integer sequence`,
      );
    }
    if (event.sequence <= previousSequence) {
      throw new Error(
        `replayMission: malformed log — sequences are not strictly increasing at sequence ${event.sequence}`,
      );
    }
    if (!isValidSnapshot(event.snapshot)) {
      throw new Error(
        `replayMission: malformed log — event ${event.id} carries no valid MissionSnapshot`,
      );
    }
    previousSequence = event.sequence;
  }
  // Last persisted event wins: its snapshot is the authoritative state.
  const last = events[events.length - 1];
  return last.snapshot;
}
