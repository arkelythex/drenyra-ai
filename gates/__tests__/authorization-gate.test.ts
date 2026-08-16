/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * AuthorizationGate tests — quantity-tier passthrough from ApprovalGate, per-approver
 * RBAC enforcement via the standalone authorize() engine, scope isolation, fail-closed
 * evidence, and determinism (contract: contracts/gate.md; SDD-060 authorization slice).
 *
 * Strict TDD: the entire behavior suite is written RED against the not-yet-existing
 * gate module, then GREEN implements gates/authorization.ts, then TRIANGULATE pins the
 * boundary cases, then REFACTOR cleans up with tests still green.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AccountingMissionStatus, type MissionSnapshot } from "../../missions/index.js";
import {
  assignRoles,
  type AuthorizationDenialCode,
  type RoleAssignment,
} from "../../authorization/index.js";
import { validateTenantScope } from "../../tenant-core/index.js";
import { ApprovalGate } from "../approval.js";
import { AuthorizationGate } from "../authorization.js";
import { ApprovalGate as BarrelApprovalGate, AuthorizationGate as BarrelAuthorizationGate } from "../index.js";
import { GateRunner } from "../runner.js";
import type { Gate, GateContext, GateResult } from "../types.js";

/** Fixture convention: companyId IS the 11-digit RUC for real tenants. */
const COMPANY_RUC = "20123456789";
const PERIOD = "202501";
const FOREIGN_RUC = "10987654321";

const S = AccountingMissionStatus;

function makeMission(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    id: "mission_authz_1",
    companyId: COMPANY_RUC,
    fiscalPeriod: PERIOD,
    intent: "monthly-close",
    status: S.RUNNING,
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
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function approval(approverId: string, at = "2025-01-02T00:00:00.000Z") {
  return { approverId, at };
}

function scopeOf(
  companyId = COMPANY_RUC,
  ruc = COMPANY_RUC,
  period = PERIOD,
) {
  return validateTenantScope({ companyId, ruc, period });
}

function assignment(
  identity: string,
  roles: RoleAssignment["roles"],
  scope: ReturnType<typeof scopeOf> = scopeOf(),
): RoleAssignment {
  return assignRoles({ identity, scope, roles });
}

describe("authorization gate vocabulary", () => {
  it('accepts "authorization" as a valid GateName', async () => {
    const gate: Gate = {
      name: "authorization",
      evaluate: () => ({ gate: "authorization", verdict: "allowed", reason: "ok" }),
    };
    const result: GateResult = await gate.evaluate({});
    expect(result.gate).toBe("authorization");
    expect(result.verdict).toBe("allowed");
  });
});

describe("AuthorizationGate: quantity-tier passthrough (ApprovalGate semantics)", () => {
  it("allows R0/R1 and unset materiality without consulting authorize()", () => {
    // Empty assignments prove authorize() was never consulted: had RBAC run,
    // the gate would fail closed to needs_input instead of allowing.
    const gate = new AuthorizationGate({ assignments: [] });
    for (const ctx of [{ materiality: "R0" }, { materiality: "R1" }, {}] as const) {
      const result = gate.evaluate(ctx as unknown as GateContext);
      expect(result.verdict).toBe("allowed");
      expect(result.reason).toMatch(/no approval required/);
      expect(result.gate).toBe("authorization");
    }
  });

  it("asks for input at R2 with no approval records", () => {
    const gate = new AuthorizationGate({ assignments: [] });
    const result = gate.evaluate({ materiality: "R2", approval: [] });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/approval required/);
    expect(result.envelope).toMatchObject({ materiality: "R2", requiredApprovers: 1 });
    expect(result.gate).toBe("authorization");
  });

  it("blocks R3 with a single distinct approver (quantity, before RBAC)", () => {
    const gate = new AuthorizationGate({ assignments: [] });
    const result = gate.evaluate({ materiality: "R3", approval: [approval("prof_a")] });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/dual approval required/);
    expect(result.gate).toBe("authorization");
  });

  it("blocks R3 when the same approver records twice (not distinct)", () => {
    const gate = new AuthorizationGate({ assignments: [] });
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a"), approval("prof_a", "2025-01-02T00:00:01.000Z")],
    });
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toMatch(/1 distinct approver/);
    expect(result.gate).toBe("authorization");
  });

  it("matches ApprovalGate verdicts, reasons, and envelopes for identical inputs", () => {
    const contexts = [
      {},
      { materiality: "R0" },
      { materiality: "R1" },
      { materiality: "R2", approval: [] },
      { materiality: "R3", approval: [approval("prof_a")] },
      {
        materiality: "R3",
        approval: [approval("prof_a"), approval("prof_a", "2025-01-02T00:00:01.000Z")],
      },
    ] as const;
    const gate = new AuthorizationGate({ assignments: [] });
    const approvalGate = new ApprovalGate();
    for (const ctx of contexts) {
      const viaAuthorization = gate.evaluate(ctx as unknown as GateContext);
      const viaApproval = approvalGate.evaluate(ctx as unknown as GateContext);
      expect(viaAuthorization.verdict).toBe(viaApproval.verdict);
      expect(viaAuthorization.reason).toBe(viaApproval.reason);
      expect(viaAuthorization.envelope).toEqual(viaApproval.envelope);
      expect(viaAuthorization.gate).toBe("authorization");
    }
  });
});

describe("AuthorizationGate: per-approver RBAC enforcement", () => {
  it("allows R2 when the single approver holds close:approve at the tenant scope", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_a")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("allowed");
    expect(result.reason).toMatch(/every approver holds close:approve/);
    expect(result.gate).toBe("authorization");
  });

  it("allows R3 when both distinct approvers hold close:approve at the tenant scope", () => {
    const gate = new AuthorizationGate({
      assignments: [assignment("prof_a", ["approver"]), assignment("prof_b", ["approver"])],
    });
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a"), approval("prof_b", "2025-01-02T00:00:01.000Z")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("allowed");
    expect(result.reason).toMatch(/every approver holds close:approve/);
    expect(result.gate).toBe("authorization");
  });

  it("blocks R2 when the approver holds only preparer permissions (close:propose)", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_prep", ["preparer"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_prep")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({ denial: { code: "insufficient-permission" } });
    expect(result.gate).toBe("authorization");
  });

  it("blocks R2 when the approver holds only reviewer permissions (close:review)", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_rev", ["reviewer"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_rev")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({ denial: { code: "insufficient-permission" } });
    expect(result.gate).toBe("authorization");
  });

  it("blocks R3 when only the SECOND of two records lacks close:approve (every record checked)", () => {
    const gate = new AuthorizationGate({
      assignments: [assignment("prof_a", ["approver"]), assignment("prof_b", ["preparer"])],
    });
    const result = gate.evaluate({
      materiality: "R3",
      approval: [approval("prof_a"), approval("prof_b", "2025-01-02T00:00:01.000Z")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({
      approverId: "prof_b",
      denial: { code: "insufficient-permission" },
    });
    expect(result.gate).toBe("authorization");
  });
});

describe("AuthorizationGate: scope isolation", () => {
  it("blocks an approver assigned at a different organization (scope-mismatch)", () => {
    const gate = new AuthorizationGate({
      assignments: [assignment("prof_foreign", ["approver"], scopeOf(FOREIGN_RUC, FOREIGN_RUC))],
    });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_foreign")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({ denial: { code: "scope-mismatch" } });
    expect(result.gate).toBe("authorization");
  });

  it("blocks an approver assigned at the same organization but a different period", () => {
    const gate = new AuthorizationGate({
      assignments: [assignment("prof_period", ["approver"], scopeOf(COMPANY_RUC, COMPANY_RUC, "202502"))],
    });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_period")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({ denial: { code: "scope-mismatch" } });
    expect(result.gate).toBe("authorization");
  });

  it("never leaks foreign scope detail in the denial reason, envelope, cause, or continuation", () => {
    const gate = new AuthorizationGate({
      assignments: [assignment("prof_foreign", ["approver"], scopeOf(FOREIGN_RUC, FOREIGN_RUC, "202502"))],
    });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_foreign")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    const serialized = JSON.stringify({ reason: result.reason, envelope: result.envelope });
    expect(serialized).not.toContain(FOREIGN_RUC);
    expect(serialized).not.toContain("202502");
  });
});

describe("AuthorizationGate: fail-closed evidence", () => {
  it("returns needs_input (never allowed) when no assignments are supplied", () => {
    const gate = new AuthorizationGate({ assignments: [] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_a")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/no role assignments/);
    expect(result.gate).toBe("authorization");
  });

  it("returns needs_input (never allowed) when the tenant scope is underivable (mission absent)", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_a")],
    });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/derivable tenant scope/);
    expect(result.gate).toBe("authorization");
  });

  it("returns needs_input (never allowed) when the mission scope fails validation", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_a")],
      mission: makeMission({ companyId: "synthetic-pe-01" }),
    });
    expect(result.verdict).toBe("needs_input");
    expect(result.reason).toMatch(/derivable tenant scope/);
    expect(result.gate).toBe("authorization");
  });

  it("surfaces a frozen, typed denial with code, cause, and continuation", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_prep", ["preparer"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_prep")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    const denial = result.envelope as { denial: { code: AuthorizationDenialCode; cause: string; continuation: string } };
    expect(Object.isFrozen(denial.denial)).toBe(true);
    expect(denial.denial.code).toBe("insufficient-permission");
    expect(denial.denial.cause.length).toBeGreaterThan(0);
    expect(denial.denial.continuation.length).toBeGreaterThan(0);
  });
});

describe("AuthorizationGate: determinism", () => {
  const assignments = [assignment("prof_a", ["approver"]), assignment("prof_b", ["approver"])];
  const ctx: GateContext = {
    materiality: "R3",
    approval: [approval("prof_a"), approval("prof_b", "2025-01-02T00:00:01.000Z")],
    mission: makeMission(),
  };

  it("produces identical verdicts, reasons, and envelopes for identical inputs", () => {
    const gate = new AuthorizationGate({ assignments });
    const first = gate.evaluate(ctx);
    const second = gate.evaluate(ctx);
    expect(second).toEqual(first);
  });

  it("treats the ApprovalRecord.at timestamp as inert", () => {
    const gate = new AuthorizationGate({ assignments });
    const later = gate.evaluate({
      ...ctx,
      approval: [
        approval("prof_a", "2030-06-15T12:00:00.000Z"),
        approval("prof_b", "2030-06-15T12:30:00.000Z"),
      ],
    });
    const baseline = gate.evaluate(ctx);
    expect(later).toEqual(baseline);
  });
});

describe("AuthorizationGate: barrel export and import boundary (W2)", () => {
  it("exports AuthorizationGate from gates/index.js alongside ApprovalGate", () => {
    expect(BarrelAuthorizationGate).toBeDefined();
    expect(BarrelApprovalGate).toBeDefined();
    expect(typeof BarrelAuthorizationGate).toBe("function");
    expect(new BarrelAuthorizationGate({ assignments: [] }).name).toBe("authorization");
    // Same class identity as the direct module import (no duplicate surface).
    expect(BarrelAuthorizationGate).toBe(AuthorizationGate);
    expect(BarrelApprovalGate).toBe(ApprovalGate);
  });

  it("imports only the allowed modules — no agents, cmd, ledger, mcp, adapters, or authorization internals", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "authorization.ts"),
      "utf8",
    );
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers).toHaveLength(4);
    const allowed = new Set([
      "./approval.js",
      "./types.js",
      "../authorization/index.js",
      "../tenant-core/index.js",
    ]);
    expect(new Set(specifiers)).toEqual(allowed);
    const forbidden = ["agents", "cmd/", "ledger", "mcp", "adapters"];
    for (const specifier of specifiers) {
      for (const fragment of forbidden) {
        expect(specifier).not.toContain(fragment);
      }
      // Only the public authorization barrel may be imported — never an internal module
      // (e.g. ../authorization/authorize.js, ../authorization/roles.js, ...).
      if (specifier.startsWith("../authorization/")) {
        expect(specifier).toBe("../authorization/index.js");
      }
    }
  });
});

describe("AuthorizationGate: GateRunner composition (W2)", () => {
  const runner = new GateRunner();
  const missionGate: Gate = {
    name: "mission",
    evaluate: () => ({ gate: "mission", verdict: "allowed", reason: "ok" }),
  };

  it("surfaces the authorization verdict and short-circuits the pipeline on a denial", async () => {
    const authorizationGate = new AuthorizationGate({
      assignments: [assignment("prof_a", ["approver"])],
    });
    const after: Gate = {
      name: "pre-commit",
      evaluate: () => {
        throw new Error("pre-commit gate must not run after a blocked authorization gate");
      },
    };
    const results = await runner.run([missionGate, authorizationGate, after], {
      materiality: "R2",
      approval: [approval("prof_ghost")],
      mission: makeMission(),
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.gate)).toEqual(["mission", "authorization"]);
    expect(results[1].verdict).toBe("blocked");
    expect(results[1].envelope).toMatchObject({ denial: { code: "unknown-identity" } });
  });

  it("allows the composed pipeline when every approver is authorized", async () => {
    const authorizationGate = new AuthorizationGate({
      assignments: [assignment("prof_a", ["approver"])],
    });
    const results = await runner.run([missionGate, authorizationGate], {
      materiality: "R2",
      approval: [approval("prof_a")],
      mission: makeMission(),
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.verdict === "allowed")).toBe(true);
    expect(results[1].reason).toMatch(/every approver holds close:approve/);
  });
});

describe("AuthorizationGate: boundary cases (triangulation)", () => {
  it("never throws for caller-shaped input — always a structured verdict", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const malformed: GateContext = {
      materiality: "R2",
      approval: [{ at: "" } as never],
      mission: makeMission(),
    };
    expect(() => gate.evaluate({})).not.toThrow();
    expect(() => gate.evaluate({ materiality: "R2", approval: [] })).not.toThrow();
    const result = gate.evaluate(malformed);
    expect(["allowed", "blocked", "needs_input"]).toContain(result.verdict);
    expect(result.gate).toBe("authorization");
  });

  it("blocks an approver identity with no assignment at all (unknown-identity)", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const result = gate.evaluate({
      materiality: "R2",
      approval: [approval("prof_ghost")],
      mission: makeMission(),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.envelope).toMatchObject({ denial: { code: "unknown-identity" } });
    expect(result.gate).toBe("authorization");
  });

  it("labels every returned GateResult with gate: \"authorization\"", () => {
    const gate = new AuthorizationGate({ assignments: [assignment("prof_a", ["approver"])] });
    const contexts: GateContext[] = [
      {},
      { materiality: "R2", approval: [] },
      { materiality: "R3", approval: [approval("prof_a")] },
      { materiality: "R2", approval: [approval("prof_a")], mission: makeMission() },
      { materiality: "R2", approval: [approval("prof_ghost")], mission: makeMission() },
    ];
    for (const ctx of contexts) {
      expect(gate.evaluate(ctx).gate).toBe("authorization");
    }
  });
});
