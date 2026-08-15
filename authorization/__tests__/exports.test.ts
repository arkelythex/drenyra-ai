/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Export surface, no-wiring, and no-private-leak smoke (T-AUTH-007, REQ-AUTH-012/013). */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as authorization from "../index.js";
import {
  assignRoles as rootAssignRoles,
  assertSegregation as rootAssertSegregation,
  authorize as rootAuthorize,
} from "../../index.js";
import type {
  AuthorizationDecision,
  Denial,
  Identity,
  Permission,
  RbacDenialCode,
  Role,
  RoleAssignment,
  SegregationDecision,
} from "../index.js";
import type { ValidatedTenantScope } from "../../tenant-core/index.js";
import { distinctApprovers } from "../../gates/approval.js";
import type { ApprovalRecord } from "../../gates/types.js";

const RUNTIME_EXPORTS = [
  "AuthorizationInputError",
  "PERMISSIONS",
  "ROLES",
  "ROLE_PERMISSIONS",
  "assignRoles",
  "assertSegregation",
  "authorize",
  "permissionsForRole",
];

const AUTHORIZATION_DIR = dirname(fileURLToPath(import.meta.url)).replace(
  /\/__tests__$/,
  "",
);

describe("T-AUTH-007 public export surface", () => {
  it("exposes exactly the intended runtime surface through the barrel (SC-AUTH-029)", () => {
    expect(Object.keys(authorization).sort()).toEqual([...RUNTIME_EXPORTS].sort());
    expect(typeof authorization.assignRoles).toBe("function");
    expect(typeof authorization.authorize).toBe("function");
    expect(typeof authorization.assertSegregation).toBe("function");
    expect(typeof authorization.permissionsForRole).toBe("function");
    expect(Array.isArray(authorization.PERMISSIONS)).toBe(true);
    expect(Array.isArray(authorization.ROLES)).toBe(true);
    expect(typeof authorization.ROLE_PERMISSIONS).toBe("object");
    expect(authorization.AuthorizationInputError).toBeInstanceOf(Function);
  });

  it("leaks no private guards, matrices aliases, or denial tables (SC-AUTH-029/030)", () => {
    for (const forbidden of [
      "isRole",
      "isPermission",
      "MATRIX",
      "RBAC_DENIALS",
      "SEGREGATION_DENIALS",
      "deny",
      "validateAssignment",
      "ValidatedAssignment",
      "normalizeCompanyId",
    ]) {
      expect(Object.keys(authorization)).not.toContain(forbidden);
    }
  });

  it("re-exports the same functions and types from the root barrel (REQ-AUTH-012)", () => {
    expect(rootAuthorize).toBe(authorization.authorize);
    expect(rootAssignRoles).toBe(authorization.assignRoles);
    expect(rootAssertSegregation).toBe(authorization.assertSegregation);

    const scope: ValidatedTenantScope = {
      brand: "drenyra:validated-tenant-scope:v1",
      companyId: "ACME",
      ruc: "20123456789",
      period: "202603",
    };
    const assignment: RoleAssignment = rootAssignRoles({
      identity: "op-1",
      scope,
      roles: ["preparer"],
    });
    const decision: AuthorizationDecision = rootAuthorize({
      assignments: [assignment],
      identity: "op-1",
      permission: "close:propose",
      scope,
    });
    expect(decision.allowed).toBe(true);
    const sod: SegregationDecision = rootAssertSegregation({
      closeStepId: "step-1",
      proposerId: "op-1",
      approverIds: ["op-2"],
    });
    expect(sod.allowed).toBe(true);
    const permission: Permission = "close:approve";
    const role: Role = "approver";
    const identity: Identity = "op-9";
    const denial: Denial<RbacDenialCode> = {
      code: "unknown-identity",
      cause: "x",
      continuation: "y",
    };
    expect([permission, role, identity, denial.code].join("|")).toBe("close:approve|approver|op-9|unknown-identity");
  });

  it("declares the ./authorization package export without touching existing subpaths (SC-AUTH-030)", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, string> };
    expect(packageJson.exports["./authorization"]).toBe("./dist/authorization/index.js");
    expect(packageJson.exports["./projection"]).toBe("./dist/projection/index.js");
    expect(packageJson.exports["./gates"]).toBe("./dist/gates/index.js");
    expect(packageJson.exports["./flow"]).toBe("./dist/flow/index.js");
    expect(packageJson.exports["."]).toBe("./dist/index.js");
  });

  it("imports no gate, flow, command, or MCP module (no-wiring, SC-AUTH-032)", () => {
    const sources = readdirSync(AUTHORIZATION_DIR)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(AUTHORIZATION_DIR, file), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/from\s+["'][^"']*gates[^"']*["']/);
      expect(source).not.toMatch(/from\s+["'][^"']*flow[^"']*["']/);
      expect(source).not.toMatch(/from\s+["'][^"']*cmd[^"']*["']/);
      expect(source).not.toMatch(/from\s+["'][^"']*mcp[^"']*["']/);
    }
  });

  it("leaves the live R3 dual-approval invariant intact (REQ-AUTH-011, SC-AUTH-032)", () => {
    const records: ApprovalRecord[] = [
      { approverId: "a", at: "2026-03-01T00:00:00.000Z" },
      { approverId: "b", at: "2026-03-01T00:00:00.000Z" },
      { approverId: "a", at: "2026-03-01T00:00:00.000Z" },
    ];
    expect(distinctApprovers(records)).toBe(2);
  });
});
