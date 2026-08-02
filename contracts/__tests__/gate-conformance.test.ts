/**
 * gate contract conformance (v0.1 FROZEN).
 *
 * Pins the normative surface of contracts/gate.md against the public library API
 * (gates/index.js only; supporting types come from the public missions/receipts
 * indexes). Covers the doc statements: ApprovalGate tiers (R0/R1 no approval,
 * R2 single, R3 dual DISTINCT approvers), ReceiptGate fail-closed authenticity
 * (only SIGNER_TRUSTED is allowed), MissionStateGate legal-vs-illegal transitions
 * with the terminal guard, and GateRunner fail-closed ordering with the
 * needs_input envelope.
 *
 * Receipts are built with the real Ed25519 signer (node:crypto); no mocks, no
 * runtime dependencies. Monetary values are BigInt cents in the Drenyra
 * ecosystem; the gate surface carries no float amounts.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */

import { describe, expect, it } from "vitest";
import {
  ApprovalGate,
  GateRunner,
  MissionStateGate,
  ReceiptGate,
  type ApprovalRecord,
  type Gate,
  type GateContext,
} from "../../gates/index.js";
import { AccountingMissionStatus, type MissionSnapshot } from "../../missions/index.js";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
  type ReceiptContent,
  type SigningKeyInfo,
} from "../../receipts/index.js";

const S = AccountingMissionStatus;

function makeMission(
  id: string,
  status: AccountingMissionStatus,
  version: number,
): MissionSnapshot {
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
    lastEventSequence: version,
    createdAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
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
    timestamp: "2026-07-30T12:00:00.000Z",
  };
}

function trustedKey(
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

function approval(approverId: string, at = "2026-07-30T12:00:00.000Z"): ApprovalRecord {
  return { approverId, at };
}

describe("gate §ApprovalGate tiers (frozen 0.1)", () => {
  const gate = new ApprovalGate();

  it("requires no approval at R0 and R1 (and when materiality is unset)", () => {
    expect(gate.evaluate({ materiality: "R0" }).verdict).toBe("allowed");
    expect(gate.evaluate({ materiality: "R1" }).verdict).toBe("allowed");
    expect(gate.evaluate({}).verdict).toBe("allowed");
    expect(gate.evaluate({ materiality: "R1", approval: [] }).verdict).toBe(
      "allowed",
    );
  });

  it("R2 allows with one explicit approval record", () => {
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_a")],
    });
    expect(result.verdict).toBe("allowed");
    expect(result.reason).toMatch(/approval recorded/);
  });

  it("R2 without approval asks for input with the decision envelope", () => {
    const result = gate.evaluate({ materiality: "R2", approval: [] });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/approval required/);
    expect(result.envelope).toEqual({
      materiality: "R2",
      requiredApprovers: 1,
      approval: [],
    });
  });

  it("R3 allows only dual approval from two DISTINCT approvers", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a"), approval("prof_b")],
    });
    expect(result.verdict).toBe("allowed");
    expect(result.reason).toMatch(/dual approval/);
  });

  it("R3 blocks a single approver (insufficient)", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a")],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/dual approval required/);
  });

  it("R3 blocks the same approver recorded twice (not distinct)", () => {
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a"), approval("prof_a", "2026-07-30T12:00:01.000Z")],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/1 distinct approver/);
  });
});

describe("gate §ReceiptGate fail-closed (frozen 0.1)", () => {
  const gate = new ReceiptGate();

  it("allows only a receipt signed by a trusted key (SIGNER_TRUSTED)", async () => {
    const key = generateReceiptKeyPair("key_gate_trusted");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_1"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKey(key)],
    });
    expect(result.verdict).toBe("allowed");
  });

  it("blocks a missing receipt (fail-closed)", async () => {
    const result = await gate.evaluate({});
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/receipt required/);
  });

  it("blocks a tampered receipt (PAYLOAD_TAMPERED)", async () => {
    const key = generateReceiptKeyPair("key_gate_tampered");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_2"), key);
    const tampered = {
      ...receipt,
      content: { ...receipt.content, actorId: "attacker" },
    };
    const result = await gate.evaluate({ receipt: tampered });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/PAYLOAD_TAMPERED/);
    expect(result.envelope).toBeDefined();
  });

  it("blocks a receipt from a revoked signer key (KEY_REVOKED)", async () => {
    const key = generateReceiptKeyPair("key_gate_revoked");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_3"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKey(key, { revokedAt: "2025-06-01T00:00:00.000Z" })],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/KEY_REVOKED/);
  });

  it("blocks a receipt from an expired signer key (KEY_EXPIRED)", async () => {
    const key = generateReceiptKeyPair("key_gate_expired");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_4"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKey(key, { expiresAt: "2025-01-01T00:00:00.000Z" })],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/KEY_EXPIRED/);
  });

  it("blocks an unknown signer when an explicit allow-list is given (UNKNOWN_SIGNER)", async () => {
    const key = generateReceiptKeyPair("key_gate_unknown");
    const other = generateReceiptKeyPair("key_gate_other");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_gate_5"), key);
    const result = await gate.evaluate({
      receipt,
      trustedKeys: [trustedKey(other)],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/UNKNOWN_SIGNER/);
  });
});

describe("gate §MissionStateGate transitions (frozen 0.1)", () => {
  const gate = new MissionStateGate();

  it("allows a legal transition (RUNNING -> AWAITING_APPROVAL)", () => {
    const result = gate.evaluate({
      mission: makeMission("mission_gate_s1", S.RUNNING, 3),
      targetStatus: S.AWAITING_APPROVAL,
    });
    expect(result.verdict).toBe("allowed");
  });

  it("blocks an illegal transition (DRAFT -> APPROVED)", () => {
    const result = gate.evaluate({
      mission: makeMission("mission_gate_s2", S.DRAFT, 1),
      targetStatus: S.APPROVED,
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/rejected/);
    expect(result.envelope).toMatchObject({
      from: S.DRAFT,
      to: S.APPROVED,
      code: "INVALID_TRANSITION",
    });
  });

  it("blocks any transition out of a terminal state (COMPLETED / FAILED)", () => {
    const completed = gate.evaluate({
      mission: makeMission("mission_gate_s3", S.COMPLETED, 5),
      targetStatus: S.APPROVED,
    });
    expect(completed.verdict).toBe("blocked");
    const failed = gate.evaluate({
      mission: makeMission("mission_gate_s4", S.FAILED, 5),
      targetStatus: S.RUNNING,
    });
    expect(failed.verdict).toBe("blocked");
  });

  it("fails closed when the mission or the target status is missing", () => {
    expect(gate.evaluate({ targetStatus: S.RUNNING }).verdict).toBe("blocked");
    expect(
      gate.evaluate({
        mission: makeMission("mission_gate_s5", S.RUNNING, 2),
      }).verdict,
    ).toBe("blocked");
  });
});

describe("gate §GateRunner fail-closed ordering (frozen 0.1)", () => {
  const runner = new GateRunner();

  function allowGate(name: "mission" | "receipt" | "approval"): Gate {
    return { name, evaluate: () => ({ gate: name, verdict: "allowed", reason: "ok" }) };
  }

  it("runs every gate and allows when all are allowed", async () => {
    const gates = [allowGate("mission"), allowGate("receipt"), allowGate("approval")];
    const results = await runner.run(gates, {});
    expect(results.map((r) => r.gate)).toEqual(["mission", "receipt", "approval"]);
    expect(results.every((r) => r.verdict === "allowed")).toBe(true);
  });

  it("stops at the first non-allowed verdict and never evaluates later gates", async () => {
    const blocking: Gate = {
      name: "receipt",
      evaluate: () => ({ gate: "receipt", verdict: "blocked", reason: "no receipt" }),
    };
    const mustNotRun: Gate = {
      name: "approval",
      evaluate: () => {
        throw new Error("approval gate must not run after a blocked gate");
      },
    };
    const results = await runner.run([allowGate("mission"), blocking, mustNotRun], {});
    expect(results).toHaveLength(2);
    expect(results[1].verdict).toBe("blocked");
  });

  it("returns the complete decision envelope for needs_input and stops", async () => {
    const needsInput: Gate = {
      name: "approval",
      evaluate: () => ({
        gate: "approval",
        verdict: "needs_input",
        reason: "approval required",
        envelope: { materiality: "R2", requiredApprovers: 1 },
      }),
    };
    const mustNotRun: Gate = {
      name: "pre-commit",
      evaluate: () => {
        throw new Error("pre-commit must not run after needs_input");
      },
    };
    const results = await runner.run([allowGate("mission"), needsInput, mustNotRun], {});
    expect(results).toHaveLength(2);
    expect(results[1].verdict).toBe("needs_input");
    expect(results[1].envelope).toEqual({ materiality: "R2", requiredApprovers: 1 });
  });

  it("produces a structured verdict envelope for every gate name", async () => {
    const ctx: GateContext = {
      mission: makeMission("mission_gate_r1", S.RUNNING, 1),
      targetStatus: S.AWAITING_APPROVAL,
    };
    const results = await runner.run([new MissionStateGate()], ctx);
    expect(results).toHaveLength(1);
    expect(results[0].gate).toBe("mission");
    expect(results[0].verdict).toBe("allowed");
  });
});
