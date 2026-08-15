/**
 * Preflight router conformance tests (SDD-030, slice C).
 *
 * Scenarios 1.1, 1.2 (RouteRequest shape + validation), 2.1-2.4 (route
 * decision and fail-closed ambiguity), 3.1-3.2 (authority ceiling and
 * propose-only purity), 5.3 (determinism). Deterministic and offline: no
 * clock, randomness, network, transport, or external service.
 */
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AccountingMissionStatus, type MissionSnapshot } from "../../missions/index.js";
import type { Materiality, Reversibility } from "../../candidates/index.js";
import {
  route,
  type AuthorityCeiling,
  type Route,
  type RouteRequest,
  type WorkScope,
} from "../index.js";

const RUC = "20123456789";
const PERIOD = "202607";
const R0: Materiality = "R0";
const REVERSIBLE: Reversibility = "reversible";

function makeScope(overrides: Partial<WorkScope> = {}): WorkScope {
  return {
    tenantId: "tenant-1",
    ruc: RUC,
    companyId: "company-1",
    companyName: "Acme SAC",
    period: PERIOD,
    intent: "monthly-close",
    ...overrides,
  };
}

function directRequest(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    scope: makeScope(),
    requestedEffect: "read-only",
    materiality: R0,
    reversibility: REVERSIBLE,
    externalEvidence: "none",
    durationAndInterruptibility: "immediate",
    systemsInvolved: ["system-a"],
    segregationOfDuties: "not-required",
    regulatoryObligations: "none",
    approval: "not-required",
    ...overrides,
  };
}

function makeMission(): MissionSnapshot {
  return {
    id: "mission-1",
    companyId: "company-1",
    fiscalPeriod: PERIOD,
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
}

const REQUIRED_FIELDS: readonly string[] = [
  "scope",
  "requestedEffect",
  "materiality",
  "reversibility",
  "externalEvidence",
  "durationAndInterruptibility",
  "systemsInvolved",
  "segregationOfDuties",
  "regulatoryObligations",
  "approval",
];

const UNSUPPORTED_LITERALS: ReadonlyArray<{ field: string; value: string }> = [
  { field: "requestedEffect", value: "execute-immediately" },
  { field: "materiality", value: "R4" },
  { field: "reversibility", value: "partially" },
  { field: "externalEvidence", value: "high" },
  { field: "durationAndInterruptibility", value: "long-running" },
  { field: "segregationOfDuties", value: "yes" },
  { field: "regulatoryObligations", value: "yes" },
  { field: "approval", value: "yes" },
];

const SPECIALIZED_CASES: ReadonlyArray<{ label: string; overrides: Partial<RouteRequest> }> = [
  { label: "a proposes-change effect", overrides: { requestedEffect: "proposes-change" } },
  { label: "bounded external evidence", overrides: { externalEvidence: "bounded" } },
  {
    label: "bounded-interruptible duration",
    overrides: { durationAndInterruptibility: "bounded-interruptible" },
  },
  { label: "partially-reversible work", overrides: { reversibility: "partially-reversible" } },
];

const DURABLE_CASES: ReadonlyArray<{ label: string; overrides: Partial<RouteRequest> }> = [
  { label: "a core-governed effect", overrides: { requestedEffect: "core-governed-change" } },
  { label: "R2 materiality", overrides: { materiality: "R2" } },
  { label: "R3 materiality", overrides: { materiality: "R3" } },
  // D10: read-only + irreversible is contradictory, so the durable trigger is
  // exercised from a proposes-change base with every other axis low-risk.
  {
    label: "irreversible work",
    overrides: { requestedEffect: "proposes-change", reversibility: "irreversible" },
  },
  { label: "material external evidence", overrides: { externalEvidence: "material" } },
  { label: "a recoverable duration", overrides: { durationAndInterruptibility: "recoverable" } },
  { label: "a second system involved", overrides: { systemsInvolved: ["system-a", "system-b"] } },
  { label: "segregation of duties required", overrides: { segregationOfDuties: "required" } },
  { label: "regulatory obligations applicable", overrides: { regulatoryObligations: "applicable" } },
  // D10: read-only + approval-required is contradictory, so the durable trigger
  // is exercised from a proposes-change base with every other axis low-risk.
  {
    label: "approval required",
    overrides: { requestedEffect: "proposes-change", approval: "required" },
  },
];

const AMBIGUOUS_SYSTEMS: ReadonlyArray<{ label: string; systems: readonly string[] }> = [
  { label: "an empty systemsInvolved collection", systems: [] },
  { label: "a malformed (empty) system id", systems: [""] },
  { label: "duplicate system ids", systems: ["system-a", "system-a"] },
];

const directPair = {
  kind: "direct-analysis",
  authorityCeiling: "no-mutation",
  request: directRequest(),
} satisfies Route;
const specializedPair = {
  kind: "specialized-agent",
  authorityCeiling: "proposes-only",
  request: directRequest(),
} satisfies Route;
const durablePair = {
  kind: "durable-mission",
  authorityCeiling: "through-core",
  request: directRequest(),
} satisfies Route;

describe("RouteRequest shape (scenarios 1.1, 1.2)", () => {
  it("decides identically for structurally equal requests with different object identity", () => {
    const a = directRequest();
    const b = directRequest();
    expect(a).not.toBe(b);
    expect(a.scope).not.toBe(b.scope);
    expect(a.systemsInvolved).not.toBe(b.systemsInvolved);
    expect(route(a)).toEqual(route(b));
  });

  it("proves omitted axes and an empty systems tuple fail typechecking", () => {
    const { systemsInvolved: omittedSystems, ...withoutSystems } = directRequest();
    // @ts-expect-error systemsInvolved is a required axis
    const missing: RouteRequest = withoutSystems;
    // @ts-expect-error an empty systemsInvolved tuple is unrepresentable
    const empty: RouteRequest = { ...directRequest(), systemsInvolved: [] };
    expect(omittedSystems).toEqual(["system-a"]);
    expect(missing).not.toHaveProperty("systemsInvolved");
    expect(empty.systemsInvolved).toHaveLength(0);
  });

  it.each(REQUIRED_FIELDS)("rejects a request missing the %s field", (field) => {
    const request: Record<string, unknown> = { ...directRequest() };
    delete request[field];
    const result = route(request as unknown as RouteRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([{ code: "AMBIGUOUS_INPUT", path: field }]);
    expect("value" in result).toBe(false);
  });

  it.each(UNSUPPORTED_LITERALS)("rejects the unsupported literal %s for %s", ({ field, value }) => {
    const result = route({ ...directRequest(), [field]: value } as unknown as RouteRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([{ code: "AMBIGUOUS_INPUT", path: field }]);
    expect("value" in result).toBe(false);
  });

  it("rejects an unknown top-level key", () => {
    const result = route({ ...directRequest(), surprise: "flag" } as unknown as RouteRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([{ code: "AMBIGUOUS_INPUT", path: "surprise" }]);
  });

  it("rejects an unknown scope key", () => {
    const result = route({
      ...directRequest(),
      scope: { ...makeScope(), authority: "x" },
    } as unknown as RouteRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([{ code: "AMBIGUOUS_INPUT", path: "scope.authority" }]);
  });
});

describe("route decision (scenarios 2.1, 2.2, 2.3)", () => {
  it.each(["R0", "R1"] as const)(
    "routes a fully safe %s request to direct-analysis and never escalates",
    (materiality) => {
      const result = route(directRequest({ materiality }));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("fixture");
      expect(result.value.kind).toBe("direct-analysis");
      expect(result.value.authorityCeiling).toBe("no-mutation");
    },
  );

  it.each(SPECIALIZED_CASES)("routes %s to specialized-agent with no durable trigger", ({ overrides }) => {
    const result = route(directRequest(overrides));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("fixture");
    expect(result.value.kind).toBe("specialized-agent");
    expect(result.value.authorityCeiling).toBe("proposes-only");
  });

  it.each(DURABLE_CASES)("routes %s to durable-mission even when every other axis is low-risk", ({ overrides }) => {
    const result = route(directRequest(overrides));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("fixture");
    expect(result.value.kind).toBe("durable-mission");
    expect(result.value.authorityCeiling).toBe("through-core");
  });
});

describe("fail-closed ambiguity and authority ceilings (scenarios 2.4, 3.1)", () => {
  it.each(AMBIGUOUS_SYSTEMS)("rejects %s as AMBIGUOUS_INPUT with no route", ({ systems }) => {
    const result = route({ ...directRequest(), systemsInvolved: systems } as RouteRequest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([{ code: "AMBIGUOUS_INPUT", path: "systemsInvolved" }]);
    expect("value" in result).toBe(false);
  });

  it("rejects read-only with approval required as contradictory", () => {
    const result = route(directRequest({ approval: "required" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([
      { code: "AMBIGUOUS_INPUT", path: "requestedEffect" },
      { code: "AMBIGUOUS_INPUT", path: "approval" },
    ]);
    expect("value" in result).toBe(false);
  });

  it("rejects read-only with irreversible work as contradictory", () => {
    const result = route(directRequest({ reversibility: "irreversible" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("fixture");
    expect(result.issues).toEqual([
      { code: "AMBIGUOUS_INPUT", path: "requestedEffect" },
      { code: "AMBIGUOUS_INPUT", path: "reversibility" },
    ]);
    expect("value" in result).toBe(false);
  });

  it("carries the exact authority ceiling for every route member", () => {
    const direct = route(directRequest());
    const specialized = route(directRequest({ requestedEffect: "proposes-change" }));
    const durable = route(directRequest({ materiality: "R2" }));
    for (const result of [direct, specialized, durable]) {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("fixture");
    }
    if (!direct.ok || !specialized.ok || !durable.ok) throw new Error("fixture");
    expect([direct.value.kind, direct.value.authorityCeiling]).toEqual([
      "direct-analysis",
      "no-mutation",
    ]);
    expect([specialized.value.kind, specialized.value.authorityCeiling]).toEqual([
      "specialized-agent",
      "proposes-only",
    ]);
    expect([durable.value.kind, durable.value.authorityCeiling]).toEqual([
      "durable-mission",
      "through-core",
    ]);
    const ceilings: readonly AuthorityCeiling[] = [
      direct.value.authorityCeiling,
      specialized.value.authorityCeiling,
      durable.value.authorityCeiling,
    ];
    expect(ceilings).toEqual(["no-mutation", "proposes-only", "through-core"]);
  });

  it("proves the exact authority pair per route member at compile time", () => {
    expect([directPair, specializedPair, durablePair]).toHaveLength(3);
    expect(directPair.authorityCeiling).toBe("no-mutation");
    expect(specializedPair.authorityCeiling).toBe("proposes-only");
    expect(durablePair.authorityCeiling).toBe("through-core");
  });

  it("proves a wrong authority pair is not representable at compile time", () => {
    // @ts-expect-error direct-analysis can only carry no-mutation
    const wrongDirect: Route = {
      kind: "direct-analysis",
      authorityCeiling: "through-core",
      request: directRequest(),
    };
    // @ts-expect-error specialized-agent can only carry proposes-only
    const wrongSpecialized: Route = {
      kind: "specialized-agent",
      authorityCeiling: "through-core",
      request: directRequest(),
    };
    // @ts-expect-error durable-mission can only carry through-core
    const wrongDurable: Route = {
      kind: "durable-mission",
      authorityCeiling: "no-mutation",
      request: directRequest(),
    };
    expect([wrongDirect, wrongSpecialized, wrongDurable]).toHaveLength(3);
  });
});

describe("propose-only purity and determinism (scenarios 3.2, 5.3)", () => {
  it("proposes only: writes no persistence and mutates no mission data", () => {
    const watched = ["ledger", "receipts", "journal", "evidence"];
    const before = new Map(
      watched.map((d) => [d, readdirSync(new URL(`../../${d}/`, import.meta.url)).sort()]),
    );
    const mission = makeMission();
    const fixtures = [
      directRequest(),
      directRequest({ requestedEffect: "proposes-change" }),
      directRequest({ materiality: "R2" }),
    ];
    const results = fixtures.map((r) => route(r));
    const after = new Map(
      watched.map((d) => [d, readdirSync(new URL(`../../${d}/`, import.meta.url)).sort()]),
    );
    for (const d of watched) {
      expect(after.get(d), d).toEqual(before.get(d));
    }
    expect(mission).toEqual(makeMission());
    for (const result of results) {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("fixture");
      expect(result.value.kind).toBeDefined();
      expect("id" in result.value).toBe(false); // no WorkUnit id
      expect("missionId" in result.value).toBe(false); // no mission id
      expect("stage" in result.value).toBe(false); // no mission stage
    }
  });

  it("embeds a fresh validated snapshot and never mutates caller objects", () => {
    const request = directRequest();
    const callerSystems = request.systemsInvolved;
    const callerScope = request.scope;
    const result = route(request);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("fixture");
    const snapshot = result.value.request;
    expect(snapshot).not.toBe(request);
    expect(snapshot.scope).not.toBe(callerScope);
    expect(snapshot.systemsInvolved).not.toBe(callerSystems);
    (callerSystems as unknown as string[]).push("system-b");
    expect(result.value.request.systemsInvolved).toEqual(["system-a"]);
    expect(request.systemsInvolved).toEqual(["system-a", "system-b"]);
  });

  it("produces identical results on repeated runs with fixed fixtures", () => {
    const fixtures = [
      directRequest(),
      directRequest({ requestedEffect: "proposes-change" }),
      directRequest({ materiality: "R2" }),
      directRequest({ reversibility: "irreversible" }),
      directRequest({ externalEvidence: "material", segregationOfDuties: "required" }),
    ];
    for (const fixture of fixtures) {
      expect(route(fixture)).toEqual(route(fixture));
    }
  });
});

describe("precedence conformance (scenario 5.1)", () => {
  it("durable always wins when a durable signal coexists with specialized signals", () => {
    const cases: readonly Partial<RouteRequest>[] = [
      { requestedEffect: "proposes-change", materiality: "R2" },
      { requestedEffect: "proposes-change", externalEvidence: "bounded", reversibility: "irreversible" },
      { durationAndInterruptibility: "bounded-interruptible", segregationOfDuties: "required" },
      { requestedEffect: "proposes-change", regulatoryObligations: "applicable" },
      { requestedEffect: "proposes-change", reversibility: "partially-reversible", approval: "required" },
    ];
    for (const overrides of cases) {
      const result = route(directRequest(overrides));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("fixture");
      expect(result.value.kind).toBe("durable-mission");
      expect(result.value.authorityCeiling).toBe("through-core");
    }
  });
});
