/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Gates tests — approval proportionality, receipt trust, mission transitions,
 * and the fail-closed runner (contract: contracts/gate.md).
 *
 * Uses Arrange-Act-Assert with behavior-named tests; receipts are built with
 * the real Ed25519 signer (node:crypto), no mocks.
 */

import { describe, expect, it } from "vitest";
import { AccountingMissionStatus, type MissionSnapshot } from "../../missions/index.js";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
  type ReceiptContent,
  type SigningKeyInfo,
} from "../../receipts/index.js";
import { ApprovalGate } from "../approval.js";
import { ReceiptGate } from "../receipt.js";
import { MissionStateGate } from "../mission.js";
import { GateRunner } from "../runner.js";
import type { Gate, GateResult } from "../types.js";

const S = AccountingMissionStatus;

function makeMission(
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

function makeReceiptContent(missionId: string): ReceiptContent {
  return {
    missionId,
    companyId: "20123456789",
    actorId: "actor_gate",
    decision: "APPROVE",
    proposalVersion: 1,
    evidenceHash: "abc123",
    previousStatus: "AWAITING_APPROVAL",
    newStatus: "APPROVED",
    payloadHash: "def456",
    timestamp: "2025-01-01T00:00:00.000Z",
  };
}

function trustedKeyOf(
  keyPair: { keyId: string; publicKey: string },
  overrides: Partial<SigningKeyInfo> = {},
): SigningKeyInfo {
  return {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ApprovalGate: materiality-proportional approval", () => {
  const gate = new ApprovalGate();

  it("allows without approval at R0/R1", () => {
    expect(gate.evaluate({ materiality: "R0" }).verdict).toBe("allowed");
    expect(gate.evaluate({ materiality: "R1" }).verdict).toBe("allowed");
    expect(gate.evaluate({}).verdict).toBe("allowed");
  });

  it("allows R2 with a single approver", () => {
    const result = gate.evaluate({
      materiality: "R2",
      approval: [{ approverId: "prof_a", at: "2025-01-01T00:00:00.000Z" }],
    });
    expect(result.verdict).toBe("allowed");
  });

  it("asks for input at R2 with no approval record", () => {
    const result = gate.evaluate({ materiality: "R2", approval: [] });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/approval required/);
    expect(result.envelope).toBeDefined();
  });

  it("allows R3 with two distinct approvers (dual approval)", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [
        { approverId: "prof_a", at: "2025-01-01T00:00:00.000Z" },
        { approverId: "prof_b", at: "2025-01-01T00:00:01.000Z" },
      ],
    });
    expect(result.verdict).toBe("allowed");
    expect(result.reason).toMatch(/dual approval/);
  });

  it("blocks R3 with a single approver (insufficient)", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [{ approverId: "prof_a", at: "2025-01-01T00:00:00.000Z" }],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/dual approval required/);
  });

  it("blocks R3 when the same approver records twice (not distinct)", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [
        { approverId: "prof_a", at: "2025-01-01T00:00:00.000Z" },
        { approverId: "prof_a", at: "2025-01-01T00:00:01.000Z" },
      ],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/1 distinct approver/);
  });
});

describe("ReceiptGate: receipt authenticity and trust", () => {
  const gate = new ReceiptGate();

  it("allows a receipt signed by a trusted key", async () => {
    const key = generateReceiptKeyPair("key_gate_trusted");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_1"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKeyOf(key)],
    });
    expect(result.verdict).toBe("allowed");
  });

  it("blocks a receipt whose signer key is revoked", async () => {
    const key = generateReceiptKeyPair("key_gate_revoked");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_2"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [
        trustedKeyOf(key, { revokedAt: "2024-06-01T00:00:00.000Z" }),
      ],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/KEY_REVOKED/);
    expect(result.envelope).toBeDefined();
  });

  it("blocks a missing receipt (fail-closed)", async () => {
    const result = await gate.evaluate({});
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/receipt required/);
  });

  it("blocks a receipt from an unknown signer when an explicit allow-list is given", async () => {
    const key = generateReceiptKeyPair("key_gate_unknown");
    const other = generateReceiptKeyPair("key_gate_other");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_3"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKeyOf(other)],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/UNKNOWN_SIGNER/);
  });
});

describe("MissionStateGate: legal transitions only", () => {
  const gate = new MissionStateGate();

  it("allows a legal transition", () => {
    const mission = makeMission({ id: "mission_gate_s1", status: S.RUNNING, version: 3 });
    const result = gate.evaluate({ mission, targetStatus: S.AWAITING_APPROVAL });
    expect(result.verdict).toBe("allowed");
  });

  it("blocks an illegal transition (DRAFT -> APPROVED)", () => {
    const mission = makeMission({ id: "mission_gate_s2", status: S.DRAFT, version: 1 });
    const result = gate.evaluate({ mission, targetStatus: S.APPROVED });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/rejected/);
  });

  it("blocks any transition of a terminal mission", () => {
    const completed = makeMission({ id: "mission_gate_s3", status: S.COMPLETED, version: 5 });
    expect(gate.evaluate({ mission: completed, targetStatus: S.APPROVED }).verdict).toBe("blocked");
    const failed = makeMission({ id: "mission_gate_s4", status: S.FAILED, version: 5 });
    expect(gate.evaluate({ mission: failed, targetStatus: S.RUNNING }).verdict).toBe("blocked");
  });

  it("blocks when the mission snapshot or target status is missing", () => {
    expect(gate.evaluate({ targetStatus: S.RUNNING }).verdict).toBe("blocked");
    const mission = makeMission({ id: "mission_gate_s5", status: S.RUNNING, version: 2 });
    expect(gate.evaluate({ mission }).verdict).toBe("blocked");
  });
});

describe("GateRunner: deterministic fail-closed pipeline", () => {
  const runner = new GateRunner();

  function allowGate(name: "mission" | "receipt" | "approval"): Gate {
    return {
      name,
      evaluate: () => ({ gate: name, verdict: "allowed", reason: "ok" }),
    };
  }

  it("returns all results when every gate is allowed", async () => {
    const gates = [allowGate("mission"), allowGate("receipt"), allowGate("approval")];
    const results = await runner.run(gates, {});
    expect(results.map((r) => r.gate)).toEqual(["mission", "receipt", "approval"]);
    expect(results.every((r) => r.verdict === "allowed")).toBe(true);
  });

  it("stops at the first blocked gate (fail closed)", async () => {
    const blocking: Gate = {
      name: "receipt",
      evaluate: () => ({ gate: "receipt", verdict: "blocked", reason: "receipt required" }),
    };
    const neverEvaluated: Gate = {
      name: "approval",
      evaluate: () => {
        throw new Error("approval gate must not run after a blocked gate");
      },
    };
    const results = await runner.run([allowGate("mission"), blocking, neverEvaluated], {});
    expect(results).toHaveLength(2);
    expect(results[1].verdict).toBe("blocked");
    expect(results[1].gate).toBe("receipt");
  });

  it("returns the complete envelope for needs_input and stops", async () => {
    const needsInput: Gate = {
      name: "approval",
      evaluate: () => ({
        gate: "approval",
        verdict: "needs_input",
        reason: "approval required",
        envelope: { materiality: "R2", requiredApprovers: 1 },
      }),
    };
    const after: Gate = {
      name: "pre-commit",
      evaluate: () => {
        throw new Error("pre-commit gate must not run after needs_input");
      },
    };
    const results = await runner.run([allowGate("mission"), needsInput, after], {});
    expect(results).toHaveLength(2);
    expect(results[1].verdict).toBe("needs_input");
    expect(results[1].envelope).toEqual({ materiality: "R2", requiredApprovers: 1 });
  });

  it("evaluates in deterministic order across runs", async () => {
    const order: string[] = [];
    const recording: Gate = {
      name: "receipt",
      evaluate: () => {
        order.push("receipt");
        return { gate: "receipt", verdict: "allowed", reason: "ok" };
      },
    };
    const missionGate: Gate = {
      name: "mission",
      evaluate: () => {
        order.push("mission");
        return { gate: "mission", verdict: "allowed", reason: "ok" };
      },
    };
    await runner.run([missionGate, recording], {});
    await runner.run([missionGate, recording], {});
    expect(order).toEqual(["mission", "receipt", "mission", "receipt"]);
  });

  it("keeps a needs_input result typed as GateResult with its verdict", async () => {
    const needsInput: Gate = {
      name: "approval",
      evaluate: () => ({ gate: "approval", verdict: "needs_input", reason: "ask" }),
    };
    const results = await runner.run([needsInput], {});
    const result: GateResult = results[0];
    expect(result.verdict).toBe("needs_input");
  });
});
