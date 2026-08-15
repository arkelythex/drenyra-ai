/**
 * WorkUnit surface conformance tests (SDD-030, R1/R4; D2/D3/D4/D5/D6).
 *
 * Scenarios 1.1-1.4: mission-derived construction, 15-state stage alignment
 * with the canonical matrix, budget types and bounds, typed stop reasons, and
 * evidence hashing. Deterministic and offline.
 */
import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  VALID_TRANSITIONS,
  validateTransition,
  type MissionSnapshot,
} from "../../missions/index.js";
import {
  advanceWorkUnit,
  createEvidenceRef,
  createWorkUnit,
  parseSha256Hash,
  toJsonInteger,
  validateWorkUnit,
  type JsonInteger,
  type Sha256Hash,
  type WorkBudgets,
  type WorkStopReason,
  type WorkUnitInput,
} from "../index.js";

const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as Sha256Hash;
const SHA256_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" as Sha256Hash;
const ENCODER = new TextEncoder();

function makeMission(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
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
    ...overrides,
  };
}

function budgets(overrides: Partial<WorkBudgets> = {}): WorkBudgets {
  return {
    timeLimitMs: 60000 as JsonInteger,
    tokenLimit: 100000 as JsonInteger,
    costLimitCents: 5000n,
    researchAttemptLimit: 3,
    correctionAttemptLimit: 1,
    ...overrides,
  };
}

function makeInput(overrides: Partial<WorkUnitInput> = {}): WorkUnitInput {
  return {
    id: "workunit-1",
    objective: "Close the books for 202607",
    scope: {
      tenantId: "tenant-1",
      ruc: "20123456789",
      companyName: "Acme SAC",
    },
    evidenceAllowed: [{ algorithm: "sha256", hash: SHA256_EMPTY }],
    skills: [{ id: "skill-1", version: "1.0.0" }],
    policies: [{ id: "policy-1", version: "1" }],
    authorizedTools: [{ id: "tool-1", version: "1", operations: ["analyze"] }],
    authorizedDestinations: [{ kind: "CORE", id: "core-1" }],
    outputSchema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
    budgets: budgets(),
    successConditions: [
      {
        kind: "OUTPUT_SCHEMA_VALID",
        schema: { id: "schema-1", version: "1", contentHash: SHA256_EMPTY },
      },
    ],
    stopConditions: ["BUDGET_EXHAUSTED", "SCOPE_MISMATCH"],
    ...overrides,
  };
}

describe("createWorkUnit mission-derived construction", () => {
  it("derives identity and scope from the mission and starts at DRAFT", () => {
    const res = createWorkUnit(makeMission(), makeInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.missionId).toBe("mission-1");
    expect(res.value.scope.companyId).toBe("company-1");
    expect(res.value.scope.period).toBe("202607");
    expect(res.value.scope.intent).toBe("monthly-close");
    expect(res.value.scope.ruc).toBe("20123456789");
    expect(res.value.scope.tenantId).toBe("tenant-1");
    expect(res.value.scope.companyName).toBe("Acme SAC");
    expect(res.value.stage).toBe(AccountingMissionStatus.DRAFT);
  });

  it("rejects invalid 11-digit RUC shapes", () => {
    for (const ruc of ["123", "20AB23456789", "", "201234567890"]) {
      const res = createWorkUnit(
        makeMission(),
        makeInput({ scope: { tenantId: "tenant-1", ruc, companyName: "Acme" } }),
      );
      expect(res.ok, `ruc=${ruc}`).toBe(false);
    }
  });

  it("rejects fiscal periods that are not YYYYMM", () => {
    for (const period of ["2026-1", "20260701", "2607", "abcd07"]) {
      const res = createWorkUnit(makeMission({ fiscalPeriod: period }), makeInput());
      expect(res.ok, `period=${period}`).toBe(false);
    }
  });

  it("rejects empty tenant and company identity", () => {
    const emptyTenant = createWorkUnit(
      makeMission(),
      makeInput({ scope: { tenantId: "", ruc: "20123456789", companyName: "Acme" } }),
    );
    expect(emptyTenant.ok).toBe(false);
    const emptyCompany = createWorkUnit(
      makeMission(),
      makeInput({ scope: { tenantId: "tenant-1", ruc: "20123456789", companyName: "" } }),
    );
    expect(emptyCompany.ok).toBe(false);
  });

  it("re-validates an accepted unit against its mission", () => {
    const unit = createWorkUnit(makeMission(), makeInput());
    if (!unit.ok) throw new Error("fixture");
    expect(validateWorkUnit(unit.value, makeMission()).ok).toBe(true);
  });

  it("rejects mission/scope mismatch on re-validation", () => {
    const unit = createWorkUnit(makeMission(), makeInput());
    if (!unit.ok) throw new Error("fixture");
    const other = makeMission({
      id: "mission-2",
      companyId: "company-2",
      fiscalPeriod: "202608",
      intent: "reconciliation",
    });
    const res = validateWorkUnit(unit.value, other);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.issues.some((i) => i.code === "MISSION_MISMATCH")).toBe(true);
  });

  it("fails closed with no partial envelope on any issue", () => {
    const res = createWorkUnit(makeMission(), makeInput({ objective: "" }));
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res).not.toHaveProperty("value");
  });
});

describe("15-state stage alignment", () => {
  it("exposes exactly the 15 canonical states with no parallel lifecycle", () => {
    const states = Object.keys(AccountingMissionStatus);
    expect(states).toEqual([
      "DRAFT",
      "QUEUED",
      "RUNNING",
      "BLOCKED",
      "AWAITING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "REVISION_REQUESTED",
      "COMPLETED",
      "FAILED",
      "UNKNOWN",
      "RECOVERING",
      "WAITING_FOR_EVIDENCE",
      "BLOCKED_BY_GATE",
      "RETRYING",
    ]);
  });

  it("accepts exactly the pairs in the real VALID_TRANSITIONS matrix", () => {
    const base = createWorkUnit(makeMission(), makeInput());
    if (!base.ok) throw new Error("fixture");
    const states = Object.keys(AccountingMissionStatus) as AccountingMissionStatus[];
    for (const from of states) {
      for (const to of states) {
        const unit = { ...base.value, stage: from };
        const res = advanceWorkUnit(unit, to, validateTransition);
        const expected = VALID_TRANSITIONS.get(from)?.has(to) ?? false;
        expect(res.ok, `${from} -> ${to}`).toBe(expected);
        if (res.ok) expect(res.value.stage).toBe(to);
      }
    }
  });

  it("accepts QUEUED -> RUNNING and rejects QUEUED -> COMPLETED", () => {
    const base = createWorkUnit(makeMission(), makeInput());
    if (!base.ok) throw new Error("fixture");
    const queued = { ...base.value, stage: AccountingMissionStatus.QUEUED };
    expect(advanceWorkUnit(queued, AccountingMissionStatus.RUNNING, validateTransition).ok).toBe(true);
    expect(advanceWorkUnit(queued, AccountingMissionStatus.COMPLETED, validateTransition).ok).toBe(false);
  });

  it("accepts UNKNOWN recovery targets and rejects all other UNKNOWN pairs", () => {
    const base = createWorkUnit(makeMission(), makeInput());
    if (!base.ok) throw new Error("fixture");
    const unknown = { ...base.value, stage: AccountingMissionStatus.UNKNOWN };
    for (const to of [
      AccountingMissionStatus.RUNNING,
      AccountingMissionStatus.FAILED,
      AccountingMissionStatus.COMPLETED,
    ]) {
      expect(advanceWorkUnit(unknown, to, validateTransition).ok, `UNKNOWN -> ${to}`).toBe(true);
    }
    for (const to of [
      AccountingMissionStatus.DRAFT,
      AccountingMissionStatus.QUEUED,
      AccountingMissionStatus.APPROVED,
      AccountingMissionStatus.REVISION_REQUESTED,
      AccountingMissionStatus.WAITING_FOR_EVIDENCE,
    ]) {
      expect(advanceWorkUnit(unknown, to, validateTransition).ok, `UNKNOWN -> ${to}`).toBe(false);
    }
  });

  it("rejects a self-transition and leaves the original unit unchanged", () => {
    const base = createWorkUnit(makeMission(), makeInput());
    if (!base.ok) throw new Error("fixture");
    const res = advanceWorkUnit(base.value, AccountingMissionStatus.DRAFT, validateTransition);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.issues[0].code).toBe("INVALID_TRANSITION");
    expect(base.value.stage).toBe(AccountingMissionStatus.DRAFT);
  });
});

describe("budget types and bounds", () => {
  it("accepts positive bigint cents and research limits 1|2|3 with correction 1", () => {
    for (const research of [1, 2, 3] as const) {
      const res = createWorkUnit(
        makeMission(),
        makeInput({ budgets: budgets({ researchAttemptLimit: research }) }),
      );
      expect(res.ok, `research=${research}`).toBe(true);
    }
    expect(createWorkUnit(makeMission(), makeInput({ budgets: budgets({ costLimitCents: 1n }) })).ok).toBe(true);
    expect(createWorkUnit(makeMission(), makeInput({ budgets: budgets({ costLimitCents: 0n }) })).ok).toBe(true);
  });

  it("rejects negative, floating and unsafe counters and out-of-bounds limits", () => {
    const cases: { label: string; patch: Partial<WorkBudgets> }[] = [
      { label: "negative cost", patch: { costLimitCents: -1n } },
      { label: "research 0", patch: { researchAttemptLimit: 0 as never } },
      { label: "research 4", patch: { researchAttemptLimit: 4 as never } },
      { label: "correction 2", patch: { correctionAttemptLimit: 2 as never } },
      { label: "float time", patch: { timeLimitMs: 60.5 as never } },
      { label: "float token", patch: { tokenLimit: 10.5 as never } },
      { label: "unsafe token", patch: { tokenLimit: 9007199254740992 as never } },
    ];
    for (const c of cases) {
      const res = createWorkUnit(makeMission(), makeInput({ budgets: budgets(c.patch) }));
      expect(res.ok, c.label).toBe(false);
    }
  });

  it("fails typechecking for Number/float monetary and counter values", () => {
    // @ts-expect-error monetary cost must be bigint cents, never Number
    const badCost: WorkBudgets = { timeLimitMs: 60000 as JsonInteger, tokenLimit: 1000 as JsonInteger, costLimitCents: 5000, researchAttemptLimit: 3, correctionAttemptLimit: 1 };
    // @ts-expect-error counters are JSON integers, never floats
    const badToken: WorkBudgets = { timeLimitMs: 60000 as JsonInteger, tokenLimit: 10.5, costLimitCents: 5000n, researchAttemptLimit: 3, correctionAttemptLimit: 1 };
    // @ts-expect-error research limit is 1|2|3
    const badResearch: WorkBudgets = { timeLimitMs: 60000 as JsonInteger, tokenLimit: 1000 as JsonInteger, costLimitCents: 5000n, researchAttemptLimit: 4, correctionAttemptLimit: 1 };
    // @ts-expect-error correction limit is exactly 1
    const badCorrection: WorkBudgets = { timeLimitMs: 60000 as JsonInteger, tokenLimit: 1000 as JsonInteger, costLimitCents: 5000n, researchAttemptLimit: 3, correctionAttemptLimit: 2 };
    expect([badCost, badToken, badResearch, badCorrection]).toBeDefined();
  });

  it("brands only safe non-negative integers", () => {
    expect(toJsonInteger(0).ok).toBe(true);
    expect(toJsonInteger(Number.MAX_SAFE_INTEGER).ok).toBe(true);
    expect(toJsonInteger(1.5).ok).toBe(false);
    expect(toJsonInteger(-1).ok).toBe(false);
    expect(toJsonInteger(Number.MAX_SAFE_INTEGER + 1).ok).toBe(false);
    expect(toJsonInteger(Number.NaN).ok).toBe(false);
  });
});

describe("typed stop reasons", () => {
  it("accepts every discriminant of the closed union", () => {
    const reasons: WorkStopReason[] = [
      { kind: "MISSING_EVIDENCE", requiredHashes: [SHA256_ABC] },
      { kind: "POLICY_BLOCKED", policy: { id: "policy-1", version: "1" } },
      { kind: "APPROVAL_REQUIRED", approvalType: "human" },
      { kind: "BUDGET_EXHAUSTED", budget: "TIME" },
      { kind: "SCOPE_MISMATCH", fields: ["ruc"] },
      {
        kind: "INVALID_TRANSITION",
        from: AccountingMissionStatus.DRAFT,
        to: AccountingMissionStatus.COMPLETED,
      },
      { kind: "EXTERNAL_SYSTEM_UNAVAILABLE", systemId: "sap" },
      { kind: "AMBIGUOUS_INPUT", fields: ["invoice"] },
      { kind: "UNSUPPORTED_WORK", intent: "invoice-review" },
    ];
    for (const reason of reasons) {
      const res = createWorkUnit(makeMission(), makeInput({ stopConditions: [reason.kind] }));
      expect(res.ok, reason.kind).toBe(true);
    }
  });

  it("fails typechecking for an unknown stop reason kind", () => {
    // @ts-expect-error unknown stop kind must fail typechecking
    const bad: WorkStopReason = { kind: "WHATEVER", detail: "x" };
    expect(bad).toBeDefined();
  });

  it("rejects empty and free-text-only stop conditions at runtime (fail closed)", () => {
    expect(createWorkUnit(makeMission(), makeInput({ stopConditions: [] })).ok).toBe(false);
    const prose = makeInput({ stopConditions: ["because reasons"] as never });
    expect(createWorkUnit(makeMission(), prose).ok).toBe(false);
  });
});

describe("evidence allowlist and hashing", () => {
  it("hashes known bytes to the exact SHA-256 vector", () => {
    expect(createEvidenceRef(new Uint8Array(0)).hash).toBe(SHA256_EMPTY);
    expect(createEvidenceRef(ENCODER.encode("abc")).hash).toBe(SHA256_ABC);
    expect(createEvidenceRef(ENCODER.encode("abc")).algorithm).toBe("sha256");
  });

  it("rejects malformed and non-hash evidence references", () => {
    for (const hash of [
      "",
      "abc",
      "Z".repeat(64),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
    ] as never[]) {
      const input = makeInput({ evidenceAllowed: [{ algorithm: "sha256", hash }] });
      expect(createWorkUnit(makeMission(), input).ok, hash).toBe(false);
    }
    const wrongAlgo = makeInput({ evidenceAllowed: [{ algorithm: "md5", hash: SHA256_EMPTY } as never] });
    expect(createWorkUnit(makeMission(), wrongAlgo).ok).toBe(false);
  });

  it("parses only 64-character lowercase hex hashes", () => {
    expect(parseSha256Hash(SHA256_EMPTY).ok).toBe(true);
    expect(parseSha256Hash(SHA256_EMPTY.toUpperCase()).ok).toBe(false);
    expect(parseSha256Hash("abc").ok).toBe(false);
    expect(parseSha256Hash("").ok).toBe(false);
  });
});
