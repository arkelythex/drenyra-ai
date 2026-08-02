/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Mission events - canonical event types and SSE wire format.
 *
 * Defines the SSE event protocol used by both API and CLI:
 * - Event types
 * - Wire format (single-line JSON over SSE)
 * - Keepalive
 * - Sequence-based resume
 */

import type { MissionSnapshot } from "./types.js";

/**
 * All mission event types used in SSE streaming.
 */
export enum MissionEventType {
  STATE_TRANSITION = "STATE_TRANSITION",
  PROGRESS_UPDATE = "PROGRESS_UPDATE",
  BLOCKER_ADDED = "BLOCKER_ADDED",
  BLOCKER_RESOLVED = "BLOCKER_RESOLVED",
  PROPOSAL_CREATED = "PROPOSAL_CREATED",
  APPROVAL_DECIDED = "APPROVAL_DECIDED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
  RECONCILED = "RECONCILED",
  KEEPALIVE = "KEEPALIVE",
}

/**
 * A mission event as transmitted over SSE.
 */
export interface MissionEvent {
  id: string;
  missionId: string;
  sequence: number;
  eventType: MissionEventType;
  snapshot: MissionSnapshot;
  createdAt: string;
}

/**
 * Parses a single SSE line into a MissionEvent.
 */
export function parseSSEEvent(line: string): MissionEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  let jsonStr = trimmed;
  if (jsonStr.startsWith("data:")) jsonStr = jsonStr.slice(5).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as MissionEvent;
  } catch {
    return null;
  }
}

/**
 * Returns true if the line is an SSE keepalive comment.
 */
export function isKeepalive(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === ":keepalive" || trimmed === ":keepalive\n";
}

/**
 * Formats a MissionEvent as a complete SSE message.
 */
export function formatSSEEvent(event: MissionEvent): string {
  const idLine = "id: " + event.id;
  const dataLine = "data: " + JSON.stringify(event);
  return idLine + "\n" + dataLine + "\n\n";
}
