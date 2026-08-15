/**
 * WorkResult surface conformance tests (SDD-030, R2/R4; D4/D5/D6).
 *
 * Scenarios 2.1-2.5: BigInt costs and integer attempts, evidence provenance,
 * candidate identity by subjectHash, nextTransition consistency with the
 * canonical validator, typed outcomes with no free-text authority, and
 * structured exceptions/provenance.
 */
import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  validateTransition,
  type AccountingException,
  type MissionSnapshot,
} from "../../missions/index.js";
import type { Candidate, MaterialityInput } from "../../candidates/index.js";
import {
  createEvidenceRef,
  createProposedCandidateRef,
  createWorkResult,
  createWorkUnit,
  validateWorkResult,
  type CostAndAttempts,
  type JsonInteger,
  type Sha256Hash,
  type WorkResultInput,
  type WorkUnit,
  type WorkUnitInput,
} from "../index.js";

const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as Sha256Hash;
const SHA256_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" as Sha256Hash;
const BASIS: MaterialityInput = {
  value: 15000n,
  reversibility: "partially-reversible",
  jurisdiction: "PE",
};

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
    ...overrides,
  };
}

function makeUnit(): WorkUnit {
  const res = createWorkUnit(makeMission(), makeInput());
  if (!res.ok) throw new Error(`fixture: ${JSON.stringify(res.issues)}`);
  return res.value;
}

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "candidate-1",
    subjectHash: SHA256_ABC,
    scope: { ruc: "20123456789", period: "202607" },
    materiality: "R2",
    status: "proposed",
    reviews: [],
    corrections: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function makeResultInput(
  unit: WorkUnit,
  overrides: Partial<WorkResultInput> = {},
): WorkResultInput {
  return {
    outcome: { kind: "SUCCEEDED" },
    evidenceRefs: [{ algorithm: "sha256", hash: SHA256_ABC }],
    proposedCandidates: [
      {
        id: "candidate-1",
        subjectHash: SHA256_ABC,
        scope: { ruc: "20123456789", period: "202607" },
        materiality: "R2",
        materialityBasis: BASIS,
      },
    ],
    unresolvedExceptions: [],
    policyVersions: [{ id: "policy-1", version: "1" }],
    toolProvenance: [
      { toolId: "tool-1", version: "1", operation: "analyze", outputHash: SHA256_ABC },
    ],
    costAndAttempts: {
      costIncurredCents: 1000n,
      researchAttempts: 1 as JsonInteger,
      correctionAttempts: 0 as JsonInteger,
    },
    nextTransition: { from: unit.stage, to: AccountingMissionStatus.QUEUED },
    explanation: "Optional human context",
    ...overrides,
  };
}

describe("BigInt costs and integer attempts", () => {
  it("accepts bigint cents and safe integer counters", () => {
    const unit = makeUnit();
    const res = createWorkResult(unit, makeResultInput(unit), validateTransition);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.costAndAttempts.costIncurredCents).toBe(1000n);
    expect(typeof res.value.costAndAttempts.costIncurredCents).toBe("bigint");
  });

  it("rejects non-bigint, negative, floating and unsafe amounts", () => {
    const unit = makeUnit();
    const cases: { label: string; patch: Partial<WorkResultInput> }[] = [
      {
        label: "number cost",
        patch: { costAndAttempts: { costIncurredCents: 1000 as never, researchAttempts: 1 as JsonInteger, correctionAttempts: 0 as JsonInteger } },
      },
      {
        label: "negative cost",
        patch: { costAndAttempts: { costIncurredCents: -5n, researchAttempts: 1 as JsonInteger, correctionAttempts: 0 as JsonInteger } },
      },
      {
        label: "float research",
        patch: { costAndAttempts: { costIncurredCents: 1000n, researchAttempts: 1.5 as never, correctionAttempts: 0 as JsonInteger } },
      },
      {
        label: "unsafe correction",
        patch: { costAndAttempts: { costIncurredCents: 1000n, researchAttempts: 1 as JsonInteger, correctionAttempts: 9007199254740992 as never } },
      },
    ];
    for (const c of cases) {
      const res = createWorkResult(unit, makeResultInput(unit, c.patch), validateTransition);
      expect(res.ok, c.label).toBe(false);
    }
  });

  it("fails typechecking for Number/float monetary costs", () => {
    // @ts-expect-error monetary cost must be bigint cents, never Number
    const bad: CostAndAttempts = { costIncurredCents: 1000, researchAttempts: 1 as JsonInteger, correctionAttempts: 0 as JsonInteger };
    expect(bad).toBeDefined();
  });
});

describe("evidence provenance", () => {
  it("produces the exact SHA-256 for known bytes", () => {
    const unit = makeUnit();
    const res = createWorkResult(
      unit,
      makeResultInput(unit, {
        evidenceRefs: [{ algorithm: "sha256", hash: createEvidenceRef(new Uint8Array(0)).hash }],
      }),
      validateTransition,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.evidenceRefs[0].hash).toBe(SHA256_EMPTY);
  });

  it("rejects memory keys, prose and malformed strings as evidence", () => {
    const unit = makeUnit();
    for (const hash of ["memory://key-1", "prose reference", "ABC", "abc"] as never[]) {
      const res = createWorkResult(
        unit,
        makeResultInput(unit, { evidenceRefs: [{ algorithm: "sha256", hash }] }),
        validateTransition,
      );
      expect(res.ok, hash).toBe(false);
    }
  });
});

describe("candidate identity", () => {
  it("preserves subjectHash, scope and materiality from a real Candidate", () => {
    const ref = createProposedCandidateRef(makeCandidate(), BASIS);
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    expect(ref.value.subjectHash).toBe(SHA256_ABC);
    expect(ref.value.scope).toEqual({ ruc: "20123456789", period: "202607" });
    expect(ref.value.materiality).toBe("R2");
    expect(ref.value.materialityBasis).toEqual(BASIS);
  });

  it("rejects malformed subject hashes and invalid materiality inputs", () => {
    expect(createProposedCandidateRef(makeCandidate({ subjectHash: "nope" }), BASIS).ok).toBe(false);
    expect(createProposedCandidateRef(makeCandidate(), { value: -1n, reversibility: "reversible", jurisdiction: "PE" }).ok).toBe(false);
    expect(createProposedCandidateRef(makeCandidate(), { value: 100n, reversibility: "flaky" as never, jurisdiction: "PE" }).ok).toBe(false);
    expect(createProposedCandidateRef(makeCandidate(), { value: 100n, reversibility: "reversible", jurisdiction: "" }).ok).toBe(false);
  });

  it("rejects a candidate whose scope differs from the WorkUnit scope", () => {
    const unit = makeUnit();
    const res = createWorkResult(
      unit,
      makeResultInput(unit, {
        proposedCandidates: [
          {
            id: "candidate-1",
            subjectHash: SHA256_ABC,
            scope: { ruc: "20123456788", period: "202607" },
            materiality: "R1",
            materialityBasis: BASIS,
          },
        ],
      }),
      validateTransition,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.issues.some((i) => i.code === "INVALID_SCOPE")).toBe(true);
  });
});

describe("nextTransition consistency", () => {
  it("accepts RUNNING -> AWAITING_APPROVAL and other canonical pairs", () => {
    const unit = makeUnit();
    const running = { ...unit, stage: AccountingMissionStatus.RUNNING };
    const res = createWorkResult(
      running,
      makeResultInput(running, {
        nextTransition: {
          from: AccountingMissionStatus.RUNNING,
          to: AccountingMissionStatus.AWAITING_APPROVAL,
        },
      }),
      validateTransition,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects absent pairs and a from that differs from the unit stage", () => {
    const unit = makeUnit();
    const absent = makeResultInput(unit, {
      nextTransition: { from: AccountingMissionStatus.DRAFT, to: AccountingMissionStatus.COMPLETED },
    });
    expect(createWorkResult(unit, absent, validateTransition).ok).toBe(false);
    const wrongFrom = makeResultInput(unit, {
      nextTransition: { from: AccountingMissionStatus.RUNNING, to: AccountingMissionStatus.COMPLETED },
    });
    const res = createWorkResult(unit, wrongFrom, validateTransition);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.issues.some((i) => i.code === "INVALID_TRANSITION")).toBe(true);
  });

  it("accepts UNKNOWN recovery targets via the canonical validator", () => {
    const unit = makeUnit();
    const unknown = { ...unit, stage: AccountingMissionStatus.UNKNOWN };
    for (const to of [
      AccountingMissionStatus.RUNNING,
      AccountingMissionStatus.FAILED,
      AccountingMissionStatus.COMPLETED,
    ]) {
      const res = createWorkResult(
        unknown,
        makeResultInput(unknown, { nextTransition: { from: AccountingMissionStatus.UNKNOWN, to } }),
        validateTransition,
      );
      expect(res.ok, `UNKNOWN -> ${to}`).toBe(true);
    }
  });

  it("derives workUnitId and missionId from the WorkUnit", () => {
    const unit = makeUnit();
    const res = createWorkResult(unit, makeResultInput(unit), validateTransition);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.workUnitId).toBe(unit.id);
    expect(res.value.missionId).toBe(unit.missionId);
  });

  it("rejects id disagreement on re-validation", () => {
    const unit = makeUnit();
    const res = createWorkResult(unit, makeResultInput(unit), validateTransition);
    if (!res.ok) throw new Error("fixture");
    const tampered = { ...res.value, workUnitId: "other" };
    const vr = validateWorkResult(tampered, unit, validateTransition);
    expect(vr.ok).toBe(false);
    if (vr.ok) throw new Error("expected failure");
    expect(vr.issues.some((i) => i.code === "MISSION_MISMATCH")).toBe(true);
  });
});

describe("typed outcomes and no free-text authority", () => {
  it("requires a typed stop reason for STOPPED and FAILED outcomes", () => {
    const unit = makeUnit();
    expect(createWorkResult(unit, makeResultInput(unit, { outcome: { kind: "STOPPED" } as never }), validateTransition).ok).toBe(false);
    expect(createWorkResult(unit, makeResultInput(unit, { outcome: { kind: "FAILED" } as never }), validateTransition).ok).toBe(false);
    const stopped = makeResultInput(unit, {
      outcome: { kind: "STOPPED", reason: { kind: "BUDGET_EXHAUSTED", budget: "TIME" } },
    });
    expect(createWorkResult(unit, stopped, validateTransition).ok).toBe(true);
    const failed = makeResultInput(unit, {
      outcome: { kind: "FAILED", reason: { kind: "EXTERNAL_SYSTEM_UNAVAILABLE", systemId: "sap" } },
    });
    expect(createWorkResult(unit, failed, validateTransition).ok).toBe(true);
  });

  it("rejects a SUCCEEDED outcome carrying a reason", () => {
    const unit = makeUnit();
    const weird = makeResultInput(unit, {
      outcome: { kind: "SUCCEEDED", reason: { kind: "BUDGET_EXHAUSTED", budget: "COST" } } as never,
    });
    expect(createWorkResult(unit, weird, validateTransition).ok).toBe(false);
  });

  it("treats explanation as non-authoritative", () => {
    const unit = makeUnit();
    const a = createWorkResult(unit, makeResultInput(unit, { explanation: "first" }), validateTransition);
    const b = createWorkResult(unit, makeResultInput(unit, { explanation: "second" }), validateTransition);
    const c = createWorkResult(unit, makeResultInput(unit, { explanation: undefined }), validateTransition);
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(a.value).toEqual({ ...b.value, explanation: "first" });
    const va = validateWorkResult(a.value, unit, validateTransition);
    const vc = validateWorkResult({ ...c.value, explanation: "completely different" }, unit, validateTransition);
    expect(va.ok).toBe(true);
    expect(vc.ok).toBe(true);
    if (!va.ok || !vc.ok) return;
    expect(va.value.evidenceRefs).toEqual(vc.value.evidenceRefs);
    expect(va.value.proposedCandidates).toEqual(vc.value.proposedCandidates);
    expect(va.value.policyVersions).toEqual(vc.value.policyVersions);
    expect(va.value.costAndAttempts).toEqual(vc.value.costAndAttempts);
    expect(va.value.nextTransition).toEqual(vc.value.nextTransition);
  });
});

describe("structured exceptions and provenance", () => {
  it("preserves exceptions, policy pins and tool provenance without coercion", () => {
    const unit = makeUnit();
    const exception: AccountingException = {
      id: "exc-1",
      missionId: "mission-1",
      code: "INVOICE_MISSING",
      severity: "ERROR",
      subjectRef: "candidate-1",
      evidenceRefs: [SHA256_ABC],
      resolutionStatus: "OPEN",
    };
    const res = createWorkResult(
      unit,
      makeResultInput(unit, {
        unresolvedExceptions: [exception],
        policyVersions: [{ id: "policy-1", version: "1", contentHash: SHA256_EMPTY }],
        toolProvenance: [
          { toolId: "tool-1", version: "1.2.0", operation: "analyze", outputHash: SHA256_ABC },
        ],
      }),
      validateTransition,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.unresolvedExceptions[0]).toEqual(exception);
    expect(res.value.policyVersions[0]).toEqual({
      id: "policy-1",
      version: "1",
      contentHash: SHA256_EMPTY,
    });
    expect(res.value.toolProvenance[0]).toEqual({
      toolId: "tool-1",
      version: "1.2.0",
      operation: "analyze",
      outputHash: SHA256_ABC,
    });
  });

  it("rejects unpinned policy versions", () => {
    const unit = makeUnit();
    const noVersion = makeResultInput(unit, { policyVersions: [{ id: "policy-1", version: "" }] });
    expect(createWorkResult(unit, noVersion, validateTransition).ok).toBe(false);
    const noId = makeResultInput(unit, { policyVersions: [{ id: "", version: "1" }] });
    expect(createWorkResult(unit, noId, validateTransition).ok).toBe(false);
  });
});
