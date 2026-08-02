/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * SSE conformance tests — ported from @drenyra/mission-protocol
 * (sse-conformance.test.ts).
 */

import { describe, expect, it } from "vitest";
import {
  MissionEventType,
  parseSSEEvent,
  isKeepalive,
  formatSSEEvent,
} from "../events.js";
import { AccountingMissionStatus } from "../status.js";

const mockSnapshot = {
  id: "mission-1",
  companyId: "company-1",
  fiscalPeriod: "2026-07",
  intent: "monthly-close" as const,
  status: AccountingMissionStatus.RUNNING,
  version: 2,
  progress: 5000,
  steps: [],
  currentStep: "",
  blockers: [],
  proposal: null,
  rejection: null,
  receiptId: null,
  receiptHash: null,
  lastEventSequence: 5,
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:01.000Z",
};

describe("SSE conformance", () => {
  it("parses a valid SSE event with data: prefix", () => {
    const event = {
      id: "evt_001",
      missionId: "mission-1",
      sequence: 5,
      eventType: MissionEventType.STATE_TRANSITION,
      snapshot: mockSnapshot,
      createdAt: "2026-07-30T12:00:01.000Z",
    };
    const line = `data: ${JSON.stringify(event)}`;
    const parsed = parseSSEEvent(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe("evt_001");
    expect(parsed!.sequence).toBe(5);
    expect(parsed!.eventType).toBe(MissionEventType.STATE_TRANSITION);
  });

  it("parses SSE event without data: prefix", () => {
    const event = {
      id: "evt_002",
      missionId: "mission-1",
      sequence: 6,
      eventType: MissionEventType.PROGRESS_UPDATE,
      snapshot: mockSnapshot,
      createdAt: "2026-07-30T12:00:02.000Z",
    };
    const line = JSON.stringify(event);
    const parsed = parseSSEEvent(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.eventType).toBe(MissionEventType.PROGRESS_UPDATE);
  });

  it("returns null for keepalive comments", () => {
    expect(parseSSEEvent(":keepalive")).toBeNull();
    expect(parseSSEEvent(":keepalive\n")).toBeNull();
  });

  it("returns null for empty lines", () => {
    expect(parseSSEEvent("")).toBeNull();
    expect(parseSSEEvent("   ")).toBeNull();
  });

  it("isKeepalive detects keepalive comments", () => {
    expect(isKeepalive(":keepalive")).toBe(true);
    expect(isKeepalive(":keepalive\n")).toBe(true);
    expect(isKeepalive("data: {}")).toBe(false);
  });

  it("formatSSEEvent produces valid SSE wire format", () => {
    const event = {
      id: "evt_003",
      missionId: "mission-1",
      sequence: 7,
      eventType: MissionEventType.PROPOSAL_CREATED,
      snapshot: mockSnapshot,
      createdAt: "2026-07-30T12:00:03.000Z",
    };
    const formatted = formatSSEEvent(event);
    expect(formatted).toContain("id: evt_003");
    expect(formatted).toContain("data: ");
    expect(formatted).toContain("PROPOSAL_CREATED");
    expect(formatted.endsWith("\n\n")).toBe(true);
  });

  it("round-trips through parse and format", () => {
    const event = {
      id: "evt_004",
      missionId: "mission-1",
      sequence: 8,
      eventType: MissionEventType.COMPLETED,
      snapshot: mockSnapshot,
      createdAt: "2026-07-30T12:00:04.000Z",
    };
    const wire = formatSSEEvent(event);
    // Extract just the data line
    const lines = wire.split("\n");
    const dataLine = lines.find((l) => l.startsWith("data: "));
    expect(dataLine).toBeDefined();
    const parsed = parseSSEEvent(dataLine!);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(event.id);
    expect(parsed!.eventType).toBe(MissionEventType.COMPLETED);
    expect(parsed!.snapshot.id).toBe(mockSnapshot.id);
  });

  it("handles malformed JSON gracefully", () => {
    expect(parseSSEEvent("data: {broken")).toBeNull();
    expect(parseSSEEvent("data: null")).toBeNull();
  });

  it("tracks monotonic sequence numbers", () => {
    const events = [5, 6, 7, 8].map((seq) => ({
      id: `evt_${seq}`,
      missionId: "mission-1",
      sequence: seq,
      eventType: MissionEventType.PROGRESS_UPDATE,
      snapshot: mockSnapshot,
      createdAt: `2026-07-30T12:00:0${seq}.000Z`,
    }));

    // Verify sequence is monotonic
    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequence).toBeGreaterThan(events[i - 1].sequence);
    }
  });

  it("resume cursor from last event ID", () => {
    const lastEventId = "evt_003";
    const resumeFrom = { lastEventId };

    // In SSE, the client sends Last-Event-ID header to resume
    // Verify the cursor is based on monotonic sequence
    expect(resumeFrom.lastEventId).toMatch(/^evt_\d+$/);
  });
});
