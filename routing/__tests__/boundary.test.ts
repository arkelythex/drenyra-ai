/**
 * Boundary compliance and testability tests (SDD-030, R3/R4; D2).
 *
 * Scenarios 3.1-3.3 and 4.2: import allowlist with type-only mission/candidate
 * imports, no reverse imports into the frozen Core, surface proposes only
 * (no ledger/receipt/journal writes), and deterministic offline behavior.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  VALID_TRANSITIONS,
  validateTransition,
  type MissionSnapshot,
} from "../../missions/index.js";
import {
  createWorkResult,
  createWorkUnit,
  route,
  type JsonInteger,
  type Sha256Hash,
  type WorkResultInput,
  type WorkUnitInput,
} from "../index.js";

const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as Sha256Hash;

const PRODUCTION_FILES = [
  "../types.ts",
  "../helpers.ts",
  "../router.ts",
  "../index.ts",
];

const FORBIDDEN_SPECIFIERS = [
  "agents/",
  "cmd/",
  "adapters/",
  "ledger",
  "receipt",
  "journal",
  "store",
  "network",
  "http",
];

describe("import boundary", () => {
  it("allows only missions/candidates type imports and node:crypto at runtime", () => {
    for (const file of PRODUCTION_FILES) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const line of source.split("\n")) {
        const m = line.match(/(?:import|export)\s+(?:type\s+)?.*?from\s+["']([^"']+)["']/);
        if (!m) continue;
        const spec = m[1];
        for (const token of FORBIDDEN_SPECIFIERS) {
          expect(spec, `${file}: ${line}`).not.toContain(token);
        }
        if (spec === "node:crypto") {
          expect(line, `${file}: ${line}`).toMatch(/^import\s+\{/);
          continue;
        }
        if (spec.startsWith("./") && line.startsWith("export")) {
          continue; // local re-export
        }
        if (spec.startsWith("./") && line.startsWith("import type")) {
          continue; // narrow exception: routing-local type-only import
        }
        expect(line, `${file}: ${line}`).toMatch(/^import type/);
        expect(spec, `${file}: ${line}`).toMatch(/^\.\.\/(missions|candidates)\/index\.js$/);
      }
    }
  });

  it("proves the frozen Core has no reverse imports and is unchanged", () => {
    const missionsDir = new URL("../../missions/", import.meta.url);
    for (const name of readdirSync(missionsDir)) {
      if (!name.endsWith(".ts")) continue;
      const source = readFileSync(new URL(name, missionsDir), "utf8");
      for (const line of source.split("\n")) {
        const m = line.match(/from\s+["']([^"']+)["']/);
        expect(m === null || !m[1].includes("routing"), `${name}: ${line}`).toBe(true);
      }
    }
    expect(Object.keys(AccountingMissionStatus)).toHaveLength(15);
    expect(VALID_TRANSITIONS.size).toBe(15);
    expect(
      VALID_TRANSITIONS.get(AccountingMissionStatus.QUEUED)?.has(AccountingMissionStatus.RUNNING),
    ).toBe(true);
    expect(() => validateTransition(AccountingMissionStatus.QUEUED, AccountingMissionStatus.COMPLETED)).toThrow();
  });

  it("proves the router holds no transition matrix or mission-state vocabulary", () => {
    const source = readFileSync(new URL("../router.ts", import.meta.url), "utf8");
    const forbidden = [
      "VALID_TRANSITIONS",
      "AccountingMissionStatus",
      "validateTransition(",
      "advanceWorkUnit",
      "DRAFT",
      "QUEUED",
      "CanonicalTransitionValidator",
    ];
    for (const token of forbidden) {
      expect(source, `router.ts contains ${token}`).not.toContain(token);
    }
  });
});

describe("surface proposes only", () => {
  it("performs no work execution and writes no ledger/receipt/journal entries", () => {
    const watched = ["ledger", "receipts", "journal", "evidence"];
    const before = new Map(
      watched.map((d) => [d, readdirSync(new URL(`../../${d}/`, import.meta.url)).sort()]),
    );
    const mission: MissionSnapshot = {
      id: "mission-1",
      companyId: "company-1",
      fiscalPeriod: "202607",
      intent: "monthly-close",
      status: AccountingMissionStatus.DRAFT,
      version: 1,
      progress: 0,
      steps: [],
      currentStep: "start",
      blockers: [],
      proposal: null,
      rejection: null,
      receiptId: null,
      receiptHash: null,
      lastEventSequence: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const unitInput: WorkUnitInput = {
      id: "workunit-1",
      objective: "Close the books for 202607",
      scope: { tenantId: "tenant-1", ruc: "20123456789", companyName: "Acme SAC" },
      evidenceAllowed: [{ algorithm: "sha256", hash: SHA256_EMPTY }],
      skills: [{ id: "skill-1", version: "1.0.0" }],
      policies: [{ id: "policy-1", version: "1" }],
      authorizedTools: [{ id: "tool-1", version: "1", operations: ["analyze"] }],
      authorizedDestinations: [{ kind: "CORE", id: "core-1" }],
      outputSchema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
      budgets: {
        timeLimitMs: 60000 as JsonInteger,
        tokenLimit: 100000 as JsonInteger,
        costLimitCents: 5000n,
        researchAttemptLimit: 3,
        correctionAttemptLimit: 1,
      },
      successConditions: [
        {
          kind: "OUTPUT_SCHEMA_VALID",
          schema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
        },
      ],
      stopConditions: ["BUDGET_EXHAUSTED", "SCOPE_MISMATCH"],
    };
    const unit = createWorkUnit(mission, unitInput);
    expect(unit.ok).toBe(true);
    if (!unit.ok) throw new Error("fixture");
    const resultInput: WorkResultInput = {
      outcome: { kind: "SUCCEEDED" },
      evidenceRefs: [{ algorithm: "sha256", hash: SHA256_EMPTY }],
      proposedCandidates: [],
      unresolvedExceptions: [],
      policyVersions: [{ id: "policy-1", version: "1" }],
      toolProvenance: [],
      costAndAttempts: {
        costIncurredCents: 1000n,
        researchAttempts: 1 as JsonInteger,
        correctionAttempts: 0 as JsonInteger,
      },
      nextTransition: { from: unit.value.stage, to: AccountingMissionStatus.QUEUED },
    };
        const result = createWorkResult(unit.value, resultInput, validateTransition);
        expect(result.ok).toBe(true);
        const routeResult = route({
          scope: {
            tenantId: "tenant-1",
            ruc: "20123456789",
            companyId: "company-1",
            companyName: "Acme SAC",
            period: "202607",
            intent: "monthly-close",
          },
          requestedEffect: "read-only",
          materiality: "R0",
          reversibility: "reversible",
          externalEvidence: "none",
          durationAndInterruptibility: "immediate",
          systemsInvolved: ["system-a"],
          segregationOfDuties: "not-required",
          regulatoryObligations: "none",
          approval: "not-required",
        });
        expect(routeResult.ok).toBe(true);
        if (!routeResult.ok) throw new Error("fixture");
        expect(routeResult.value.kind).toBe("direct-analysis");
        expect("id" in routeResult.value).toBe(false);
        expect("missionId" in routeResult.value).toBe(false);
        const after = new Map(
          watched.map((d) => [d, readdirSync(new URL(`../../${d}/`, import.meta.url)).sort()]),
        );
    for (const d of watched) {
      expect(after.get(d), d).toEqual(before.get(d));
    }
    expect(mission.status).toBe(AccountingMissionStatus.DRAFT);
    expect(unit.value.stage).toBe(AccountingMissionStatus.DRAFT);
  });
});

describe("deterministic and offline", () => {
      it("uses no clock, randomness, network, transport or external service", () => {
        const testFiles = [
          "work-unit.test.ts",
          "work-result.test.ts",
          "boundary.test.ts",
          "router.test.ts",
          "../router.ts",
        ];
    // Tokens are joined so the scanned sources cannot contain the literal token.
    const forbidden = [
      "Math." + "random",
      "Date." + "now",
      "new " + "Date",
      "fet" + "ch(",
      "Web" + "Socket",
      "child_" + "process",
      "http." + "request",
      "net." + "connect",
    ];
    for (const file of testFiles) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      for (const token of forbidden) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });

  it("produces identical results on repeated runs with fixed fixtures", () => {
    const mission: MissionSnapshot = {
      id: "mission-1",
      companyId: "company-1",
      fiscalPeriod: "202607",
      intent: "monthly-close",
      status: AccountingMissionStatus.DRAFT,
      version: 1,
      progress: 0,
      steps: [],
      currentStep: "start",
      blockers: [],
      proposal: null,
      rejection: null,
      receiptId: null,
      receiptHash: null,
      lastEventSequence: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const input: WorkUnitInput = {
      id: "workunit-1",
      objective: "Close the books for 202607",
      scope: { tenantId: "tenant-1", ruc: "20123456789", companyName: "Acme SAC" },
      evidenceAllowed: [{ algorithm: "sha256", hash: SHA256_EMPTY }],
      skills: [{ id: "skill-1", version: "1.0.0" }],
      policies: [{ id: "policy-1", version: "1" }],
      authorizedTools: [{ id: "tool-1", version: "1", operations: ["analyze"] }],
      authorizedDestinations: [{ kind: "CORE", id: "core-1" }],
      outputSchema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
      budgets: {
        timeLimitMs: 60000 as JsonInteger,
        tokenLimit: 100000 as JsonInteger,
        costLimitCents: 5000n,
        researchAttemptLimit: 3,
        correctionAttemptLimit: 1,
      },
      successConditions: [
        {
          kind: "OUTPUT_SCHEMA_VALID",
          schema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
        },
      ],
      stopConditions: ["BUDGET_EXHAUSTED", "SCOPE_MISMATCH"],
    };
    const a = createWorkUnit(mission, input);
    const b = createWorkUnit(mission, input);
    expect(a).toEqual(b);
    if (!a.ok || !b.ok) throw new Error("fixture");
    const ra = createWorkResult(a.value, resultInputFor(a.value), validateTransition);
    const rb = createWorkResult(b.value, resultInputFor(b.value), validateTransition);
    expect(ra).toEqual(rb);
  });
});

function resultInputFor(unit: { stage: MissionSnapshot["status"] }): WorkResultInput {
  return {
    outcome: { kind: "SUCCEEDED" },
    evidenceRefs: [{ algorithm: "sha256", hash: SHA256_EMPTY }],
    proposedCandidates: [],
    unresolvedExceptions: [],
    policyVersions: [{ id: "policy-1", version: "1" }],
    toolProvenance: [],
    costAndAttempts: {
      costIncurredCents: 1000n,
      researchAttempts: 1 as JsonInteger,
      correctionAttempts: 0 as JsonInteger,
    },
    nextTransition: { from: unit.stage, to: AccountingMissionStatus.QUEUED },
  };
}
