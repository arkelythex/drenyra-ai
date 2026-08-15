/**
 * Connector-adapter conformance — SDD-110 Option A (DRAFT v0.1).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai. Commands in this suite are
 * JSON-serializable plain values (never BigInt) so canonicalHash stays defined.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ConnectorValidationError,
  ConnectorValidationErrorCode,
  assertConnectorAuthority,
  assertConnectorResult,
  assertSameConnectorScope,
  validateConnectorExecuteRequest,
  type ConnectorAdapter,
  type ConnectorAdapterDependencies,
  type ConnectorAdapterFactory,
  type ConnectorCapability,
  type ConnectorExecuteInput,
  type ConnectorExecuteRequest,
  type ConnectorExecuteResult,
  type ConnectorTarget,
} from "../index.js";
import {
  InMemoryIdempotencyStore,
  IdempotencyConflict,
  ReconciliationError,
  canonicalHash,
  isVerifiableEvidence,
  reconcileExternalCall,
  type ExternalCall,
  type ExternalEvidence,
  type IdempotencyRecord,
} from "../../missions/index.js";
import {
  TENANT_SCOPE_BRAND,
  TENANT_SCOPE_ERROR,
  TenantScopeError,
  sameTenantScope,
  validateTenantScope,
  type TenantScope,
  type ValidatedTenantScope,
} from "../../tenant-core/index.js";
import { ReceiptType } from "../../receipts/index.js";

const TTL_MS = 24 * 60 * 60 * 1000;

const SCOPE_A: TenantScope = { companyId: "acme-a", ruc: "20123456789", period: "202607" };
const SCOPE_B: TenantScope = { companyId: "acme-b", ruc: "20123456788", period: "202608" };
const VALIDATED_A: ValidatedTenantScope = validateTenantScope(SCOPE_A);

const SUNAT_SIRE_PE: ConnectorCapability = {
  system: "sunat-sire",
  jurisdiction: "PE",
  operations: ["submit"],
};
const SUBMIT_PE: ConnectorTarget = { system: "sunat-sire", jurisdiction: "PE", operation: "submit" };
const SETTLE_PE: ConnectorTarget = { system: "sunat-sire", jurisdiction: "PE", operation: "settle" };

const EVIDENCE: ExternalEvidence = {
  identifier: "sunat-sire-2026-000123",
  state: "accepted",
  provenance: "sunat-sire",
  moment: "2026-08-01T00:00:00.000Z",
  responseHash: "a".repeat(64),
};

const BASE_REQUEST: ConnectorExecuteRequest = {
  missionId: "mission_conn_1",
  idempotencyKey: "submit-20260801-0001",
  command: { invoice: "F001-000123", amountCents: "12500" },
  tenantScope: SCOPE_A,
  target: SUBMIT_PE,
};

/** Returns the thrown value, or undefined when the call does not throw. */
function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

async function thrownAsync(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("validateConnectorExecuteRequest (T-CONN-001)", () => {
  it("returns a branded input whose tenantScope is a ValidatedTenantScope", () => {
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    expect(input.missionId).toBe(BASE_REQUEST.missionId);
    expect(input.idempotencyKey).toBe(BASE_REQUEST.idempotencyKey);
    expect(input.target).toEqual(SUBMIT_PE);
    expect(input.command).toEqual(BASE_REQUEST.command);
    expect(input.tenantScope.brand).toBe(TENANT_SCOPE_BRAND);
    expect(sameTenantScope(input.tenantScope, SCOPE_A)).toBe(true);
  });

  it("rejects an empty mission ID with ConnectorValidationError", () => {
    expect(() =>
      validateConnectorExecuteRequest({ ...BASE_REQUEST, missionId: "   " }),
    ).toThrow(ConnectorValidationError);
  });

  it("rejects an invalid idempotency key with INVALID_IDEMPOTENCY_KEY", () => {
    const error = thrown(() =>
      validateConnectorExecuteRequest({ ...BASE_REQUEST, idempotencyKey: "x-1" }),
    );
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.INVALID_IDEMPOTENCY_KEY,
    );
  });

  it("propagates TenantScopeError with its specific code for a malformed scope (SC-CONN-011)", () => {
    const cases: Array<{ scope: TenantScope; code: string }> = [
      { scope: { ...SCOPE_A, ruc: "12345" }, code: TENANT_SCOPE_ERROR.INVALID_RUC },
      { scope: { ...SCOPE_A, period: "202613" }, code: TENANT_SCOPE_ERROR.INVALID_PERIOD },
      { scope: { ...SCOPE_A, companyId: "   " }, code: TENANT_SCOPE_ERROR.INVALID_COMPANY },
    ];
    for (const testCase of cases) {
      const error = thrown(() =>
        validateConnectorExecuteRequest({ ...BASE_REQUEST, tenantScope: testCase.scope }),
      );
      expect(error).toBeInstanceOf(TenantScopeError);
      expect((error as TenantScopeError).code).toBe(testCase.code);
    }
  });
});

describe("assertConnectorAuthority (T-CONN-006)", () => {
  it("accepts the declared target exactly and rejects drift without reinterpretation (SC-CONN-014/015)", () => {
    expect(() => assertConnectorAuthority(SUNAT_SIRE_PE, SUBMIT_PE)).not.toThrow();
    const cases: Array<{ target: ConnectorTarget; code: ConnectorValidationErrorCode }> = [
      { target: SETTLE_PE, code: ConnectorValidationErrorCode.UNDECLARED_OPERATION },
      { target: { system: "bank", jurisdiction: "PE", operation: "submit" }, code: ConnectorValidationErrorCode.UNDECLARED_SYSTEM },
      { target: { system: "sunat-sire", jurisdiction: "CL", operation: "submit" }, code: ConnectorValidationErrorCode.UNDECLARED_JURISDICTION },
      { target: { system: "SUNAT-SIRE", jurisdiction: "PE", operation: "submit" }, code: ConnectorValidationErrorCode.UNDECLARED_SYSTEM },
    ];
    for (const testCase of cases) {
      const error = thrown(() => assertConnectorAuthority(SUNAT_SIRE_PE, testCase.target));
      expect(error).toBeInstanceOf(ConnectorValidationError);
      expect((error as ConnectorValidationError).code).toBe(testCase.code);
    }
  });

  it("grants no authority from an empty operations list", () => {
    const error = thrown(() =>
      assertConnectorAuthority({ system: "sunat-sire", jurisdiction: "PE", operations: [] }, SUBMIT_PE),
    );
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.UNDECLARED_OPERATION,
    );
  });
});

describe("assertSameConnectorScope (T-CONN-004)", () => {
  it("rejects cross-tenant scope with SCOPE_MISMATCH and accepts the same scope", () => {
    expect(() => assertSameConnectorScope(VALIDATED_A, SCOPE_A)).not.toThrow();
    const error = thrown(() => assertSameConnectorScope(VALIDATED_A, SCOPE_B));
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.SCOPE_MISMATCH,
    );
  });
});

describe("assertConnectorResult (T-CONN-005)", () => {
  it("accepts SUCCESS with verifiable evidence and UNKNOWN with a stable identifier", () => {
    expect(isVerifiableEvidence(EVIDENCE)).toBe(true);
    expect(() => assertConnectorResult({ kind: "SUCCESS", evidence: EVIDENCE })).not.toThrow();
    expect(() => assertConnectorResult({ kind: "UNKNOWN", stableIdentifier: "sunat-ticket-42" })).not.toThrow();
  });

  it("rejects success without verifiable evidence with UNVERIFIABLE_EVIDENCE", () => {
    const cases: ConnectorExecuteResult[] = [
      { kind: "SUCCESS", evidence: { ...EVIDENCE, responseHash: "zz".repeat(32) } },
      { kind: "SUCCESS" } as ConnectorExecuteResult,
    ];
    for (const result of cases) {
      const error = thrown(() => assertConnectorResult(result));
      expect(error).toBeInstanceOf(ConnectorValidationError);
      expect((error as ConnectorValidationError).code).toBe(
        ConnectorValidationErrorCode.UNVERIFIABLE_EVIDENCE,
      );
    }
  });

  it("rejects UNKNOWN without a non-empty stable identifier and unknown result kinds", () => {
    const cases: ConnectorExecuteResult[] = [
      { kind: "UNKNOWN", stableIdentifier: "" } as ConnectorExecuteResult,
      { kind: "UNKNOWN", stableIdentifier: "   " } as ConnectorExecuteResult,
      { kind: "FAILED", reason: "boom" } as unknown as ConnectorExecuteResult,
    ];
    for (const result of cases) {
      const error = thrown(() => assertConnectorResult(result));
      expect(error).toBeInstanceOf(ConnectorValidationError);
      expect((error as ConnectorValidationError).code).toBe(
        ConnectorValidationErrorCode.INVALID_STABLE_IDENTIFIER,
      );
    }
  });
});

describe("MockConnectorAdapter idempotent execute (T-CONN-002)", () => {
  const successHook = async (): Promise<ConnectorExecuteResult> => ({
    kind: "SUCCESS",
    evidence: EVIDENCE,
  });
  const build = () =>
    new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, executeHook: successHook },
    );

  it("replays the recorded result for the same key and payload without re-execution (SC-CONN-001)", async () => {
    const adapter = build();
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    const first = await adapter.execute(input);
    expect(first).toEqual({ kind: "SUCCESS", evidence: EVIDENCE });
    const second = await adapter.execute(input);
    expect(second).toEqual(first);
    expect(adapter.mutationCount).toBe(1);
  });

  it("throws IdempotencyConflict for the same key with a different payload and never mutates (SC-CONN-002)", async () => {
    const adapter = build();
    const inputA = validateConnectorExecuteRequest(BASE_REQUEST);
    await adapter.execute(inputA);
    const inputB = validateConnectorExecuteRequest({
      ...BASE_REQUEST,
      command: { invoice: "F001-000999", amountCents: "99900" },
    });
    const error = await thrownAsync(() => adapter.execute(inputB));
    expect(error).toBeInstanceOf(IdempotencyConflict);
    const conflict = error as IdempotencyConflict;
    expect(conflict.key).toBe(BASE_REQUEST.idempotencyKey);
    expect(conflict.originalPayload).toBe(canonicalHash(envelopeOf(inputA)));
    expect(conflict.newPayload).toBe(canonicalHash(envelopeOf(inputB)));
    expect(conflict.originalPayload).not.toBe(conflict.newPayload);
    expect(adapter.mutationCount).toBe(1);
  });

  it("fails closed with ALREADY_EXECUTING on a concurrent same-key attempt (SC-CONN-003)", async () => {
    let release!: () => void;
    let markInHook!: () => void;
    const inHook = new Promise<void>((resolve) => {
      markInHook = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      {
        capability: SUNAT_SIRE_PE,
        executeHook: async () => {
          markInHook();
          await gate;
          return { kind: "SUCCESS", evidence: EVIDENCE };
        },
      },
    );
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    const first = adapter.execute(input);
    await inHook;
    const error = await thrownAsync(() => adapter.execute(input));
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.ALREADY_EXECUTING,
    );
    release();
    expect(await first).toEqual({ kind: "SUCCESS", evidence: EVIDENCE });
    expect(adapter.mutationCount).toBe(1);
  });

  it("replays a recorded terminal local error without another mutation", async () => {
    const failing = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      {
        capability: SUNAT_SIRE_PE,
        executeHook: async () => {
          throw new Error("vendor unreachable");
        },
      },
    );
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    await expect(failing.execute(input)).rejects.toThrow("vendor unreachable");
    await expect(failing.execute(input)).rejects.toThrow("vendor unreachable");
    expect(failing.mutationCount).toBe(1);
  });
});

describe("UNKNOWN outcome and reconciliation (T-CONN-003)", () => {
  const CALL: ExternalCall = {
    stableIdentifier: "sunat-ticket-42",
    system: SUBMIT_PE.system,
    missionId: BASE_REQUEST.missionId,
  };
  const unknownAdapter = () =>
    new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      {
        capability: SUNAT_SIRE_PE,
        executeHook: async () => ({ kind: "UNKNOWN", stableIdentifier: CALL.stableIdentifier }),
      },
    );

  it("returns UNKNOWN with a stable identifier and no verdict (SC-CONN-004/005)", async () => {
    const adapter = unknownAdapter();
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    const result = await adapter.execute(input);
    expect(result).toEqual({ kind: "UNKNOWN", stableIdentifier: CALL.stableIdentifier });
    expect(() => assertConnectorResult(result)).not.toThrow();
    // UNKNOWN persists as COMPLETED and replays without re-execution.
    expect(await adapter.execute(input)).toEqual(result);
    expect(adapter.mutationCount).toBe(1);
  });

  it("maps executed with verifiable evidence to record (SC-CONN-006)", async () => {
    const result = await reconcileExternalCall(
      { resolve: async () => ({ outcome: "executed", evidence: EVIDENCE }) },
      CALL,
    );
    expect(result.decision).toBe("record");
    expect(result.evidence).toEqual(EVIDENCE);
  });

  it("fails closed with EXECUTED_WITHOUT_EVIDENCE when executed lacks verifiable evidence (SC-CONN-007)", async () => {
    const call = CALL;
    const noEvidence = await thrownAsync(() =>
      reconcileExternalCall({ resolve: async () => ({ outcome: "executed" }) }, call),
    );
    expect((noEvidence as ReconciliationError).code).toBe("EXECUTED_WITHOUT_EVIDENCE");
    const badEvidence = await thrownAsync(() =>
      reconcileExternalCall(
        { resolve: async () => ({ outcome: "executed", evidence: { ...EVIDENCE, responseHash: "nope" } }) },
        call,
      ),
    );
    expect((badEvidence as ReconciliationError).code).toBe("EXECUTED_WITHOUT_EVIDENCE");
  });

  it("maps not-executed to retry; the retry reuses the original idempotency key (SC-CONN-008)", async () => {
    const result = await reconcileExternalCall(
      { resolve: async () => ({ outcome: "not-executed" }) },
      CALL,
    );
    expect(result.decision).toBe("retry");
    // Idempotent retry with the ORIGINAL key replays — never a second mutation.
    const adapter = unknownAdapter();
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    await adapter.execute(input);
    await adapter.execute(input);
    expect(adapter.mutationCount).toBe(1);
  });

  it("maps indeterminate to human-intervention without retry or record (SC-CONN-009)", async () => {
    const result = await reconcileExternalCall(
      { resolve: async () => ({ outcome: "indeterminate" }) },
      CALL,
    );
    expect(result.decision).toBe("human-intervention");
    expect(result.reason).toMatch(/professional/i);
  });

  it("fails closed with NO_RESOLVER when no resolver is configured (REQ-CONN-003)", async () => {
    const error = await thrownAsync(() => reconcileExternalCall(undefined, CALL));
    expect((error as ReconciliationError).code).toBe("NO_RESOLVER");
  });
});

describe("scope isolation at execution (T-CONN-004)", () => {
  it("rejects a response belonging to another tenant before mutation and evidence acceptance (SC-CONN-010)", async () => {
    const adapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      {
        capability: SUNAT_SIRE_PE,
        responseScope: SCOPE_B,
        executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }),
      },
    );
    const input = validateConnectorExecuteRequest(BASE_REQUEST); // scope A
    const error = await thrownAsync(() => adapter.execute(input));
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.SCOPE_MISMATCH,
    );
    expect(adapter.mutationCount).toBe(0);
  });
});

describe("restricted authority at execution (T-CONN-006)", () => {
  it("rejects undeclared operation, system, or jurisdiction before mutation (SC-CONN-014/015)", async () => {
    const adapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }) },
    );
    const cases: Array<{ target: ConnectorTarget; code: ConnectorValidationErrorCode }> = [
      { target: SETTLE_PE, code: ConnectorValidationErrorCode.UNDECLARED_OPERATION },
      { target: { system: "bank", jurisdiction: "PE", operation: "submit" }, code: ConnectorValidationErrorCode.UNDECLARED_SYSTEM },
      { target: { system: "sunat-sire", jurisdiction: "CL", operation: "submit" }, code: ConnectorValidationErrorCode.UNDECLARED_JURISDICTION },
    ];
    for (const testCase of cases) {
      const error = await thrownAsync(() =>
        adapter.execute(validateConnectorExecuteRequest({ ...BASE_REQUEST, target: testCase.target })),
      );
      expect(error).toBeInstanceOf(ConnectorValidationError);
      expect((error as ConnectorValidationError).code).toBe(testCase.code);
    }
    expect(adapter.mutationCount).toBe(0);
  });
});

describe("evidence-bound success (T-CONN-005)", () => {
  const successAdapter = () =>
    new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }) },
    );

  it("returns verifiable, hash-addressed evidence on SUCCESS (SC-CONN-012)", async () => {
    const result = await successAdapter().execute(validateConnectorExecuteRequest(BASE_REQUEST));
    expect(result.kind).toBe("SUCCESS");
    const success = result as Extract<ConnectorExecuteResult, { kind: "SUCCESS" }>;
    expect(success.evidence).toEqual(EVIDENCE);
    expect(success.evidence.responseHash).toMatch(/^[0-9a-f]{64}$/);
    expect(isVerifiableEvidence(success.evidence)).toBe(true);
  });

  it("asserts EXTERNAL_SUBMISSION compatibility and the absence of receipt fields (SC-CONN-013)", async () => {
    const result = await successAdapter().execute(validateConnectorExecuteRequest(BASE_REQUEST));
    expect(result.kind).toBe("SUCCESS");
    const success = result as Extract<ConnectorExecuteResult, { kind: "SUCCESS" }>;
    expect(ReceiptType.EXTERNAL_SUBMISSION).toBe("EXTERNAL_SUBMISSION");
    expect(success).not.toHaveProperty("receiptType");
    expect(success).not.toHaveProperty("receiptHash");
    expect(success).not.toHaveProperty("signature");
    expect(success).not.toHaveProperty("signerKeyId");
    expect(success).not.toHaveProperty("issuedAt");
    expect(success).not.toHaveProperty("content");
  });
});

describe("ConnectorAdapterFactory (D3)", () => {
  it("composes an adapter over the injected idempotency store", () => {
    const factory: ConnectorAdapterFactory = (deps) =>
      new MockConnectorAdapter(deps, {
        capability: SUNAT_SIRE_PE,
        executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }),
      });
    const adapter: ConnectorAdapter = factory({ idempotencyStore: new InMemoryIdempotencyStore() });
    expect(adapter.name).toBe("mock-connector");
    expect(adapter.declareCapability()).toEqual(SUNAT_SIRE_PE);
  });
});

describe("conformance suite (T-CONN-008)", () => {
  it("the mock passes every normative vector (SC-CONN-019)", async () => {
    const adapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }) },
    );
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    const first = await adapter.execute(input);
    expect(first.kind).toBe("SUCCESS");
    expect(await adapter.execute(input)).toEqual(first); // replay
    expect(adapter.mutationCount).toBe(1);
    const conflictError = await thrownAsync(() =>
      adapter.execute(
        validateConnectorExecuteRequest({ ...BASE_REQUEST, command: { invoice: "F001-000999" } }),
      ),
    );
    expect(conflictError).toBeInstanceOf(IdempotencyConflict); // IDEMPOTENCY_CONFLICT
    const authorityError = await thrownAsync(() =>
      adapter.execute(validateConnectorExecuteRequest({ ...BASE_REQUEST, target: SETTLE_PE })),
    );
    expect(authorityError).toBeInstanceOf(ConnectorValidationError); // restricted authority
    const unknown = await new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      {
        capability: SUNAT_SIRE_PE,
        executeHook: async () => ({ kind: "UNKNOWN", stableIdentifier: "sunat-ticket-42" }),
      },
    ).execute(input);
    expect(unknown.kind).toBe("UNKNOWN"); // UNKNOWN reconciliation path
    const scopeAdapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, responseScope: SCOPE_B, executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }) },
    );
    const scopeError = await thrownAsync(() => scopeAdapter.execute(input));
    expect((scopeError as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.SCOPE_MISMATCH,
    );
  });

  it("a vector that drifts from the DRAFT contract fails the suite (SC-CONN-020)", async () => {
    // Drift: success without verifiable evidence must fail the result guard.
    const drifted = { kind: "SUCCESS", evidence: { ...EVIDENCE, responseHash: "deadbeef" } } as ConnectorExecuteResult;
    const error = thrown(() => assertConnectorResult(drifted));
    expect(error).toBeInstanceOf(ConnectorValidationError);
    expect((error as ConnectorValidationError).code).toBe(
      ConnectorValidationErrorCode.UNVERIFIABLE_EVIDENCE,
    );
    // Drift: replay re-executing must never happen — the mutation counter proves it.
    const adapter = new MockConnectorAdapter(
      { idempotencyStore: new InMemoryIdempotencyStore() },
      { capability: SUNAT_SIRE_PE, executeHook: async () => ({ kind: "SUCCESS", evidence: EVIDENCE }) },
    );
    const input = validateConnectorExecuteRequest(BASE_REQUEST);
    await adapter.execute(input);
    await adapter.execute(input);
    expect(adapter.mutationCount).toBe(1);
  });
});

describe("node:crypto-only surface (T-CONN-006, REQ-CONN-007)", () => {
  const source = readFileSync(new URL("../connector.ts", import.meta.url), "utf8");

  it("imports no built-in other than node:crypto through existing Core (SC-CONN-016)", () => {
    for (const forbidden of [
      "node:http",
      "node:net",
      "node:pg",
      "node:fs",
      "node:path",
      "node:os",
      "node:child_process",
    ]) {
      expect(source).not.toContain(`from "${forbidden}"`);
    }
    // Hashing flows through the missions barrel (canonicalHash) — the single permitted path.
    expect(source).toContain('from "../missions/index.js"');
  });

  it("contains no credentials, secrets, or key material (REQ-CONN-007)", () => {
    for (const marker of [
      "password",
      "apiKey",
      "clientSecret",
      "privateKey",
      "BEGIN PRIVATE KEY",
      "BEGIN RSA PRIVATE KEY",
    ]) {
      expect(source).not.toContain(marker);
    }
  });
});

interface MockConnectorOptions {
  capability: ConnectorCapability;
  executeHook: (input: ConnectorExecuteInput) => Promise<ConnectorExecuteResult>;
  responseScope?: TenantScope;
}

interface ConnectorEnvelope {
  missionId: string;
  target: ConnectorTarget;
  scope: { companyId: string; ruc: string; period: string };
  command: unknown;
}

/** Immutable execution envelope (D3): mission ID, target, scope, command — no key. */
function envelopeOf(input: ConnectorExecuteInput): ConnectorEnvelope {
  return {
    missionId: input.missionId,
    target: input.target,
    scope: {
      companyId: input.tenantScope.companyId,
      ruc: input.tenantScope.ruc,
      period: input.tenantScope.period,
    },
    command: input.command,
  };
}

function createdAtOf(record: IdempotencyRecord): string {
  const result = record.result as { createdAt?: unknown } | undefined;
  if (result !== undefined && typeof result.createdAt === "string") {
    return result.createdAt;
  }
  return new Date(record.expiresAt).toISOString();
}

function errorDescriptor(error: unknown): { code: string; message: string } {
  if (error instanceof ConnectorValidationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}

function replayRecord(record: IdempotencyRecord): ConnectorExecuteResult {
  const result = record.result as { outcome?: ConnectorExecuteResult } | undefined;
  if (record.status === "COMPLETED" && result !== undefined && result.outcome !== undefined) {
    return result.outcome;
  }
  const error =
    (record.result as { error?: { code: string; message: string } } | undefined)?.error ?? {
      code: "INTERNAL_ERROR",
      message: `replayed connector failure for key "${record.key}"`,
    };
  if ((Object.values(ConnectorValidationErrorCode) as string[]).includes(error.code)) {
    throw new ConnectorValidationError(error.code as ConnectorValidationErrorCode, error.message);
  }
  throw new Error(error.message);
}

/** In-memory, test-only driver over the injected store (design D3 / GREEN 2). */
class MockConnectorAdapter implements ConnectorAdapter {
  readonly name = "mock-connector";
  private readonly deps: ConnectorAdapterDependencies;
  private readonly options: MockConnectorOptions;
  private mutations = 0;

  constructor(deps: ConnectorAdapterDependencies, options: MockConnectorOptions) {
    this.deps = deps;
    this.options = options;
  }

  get mutationCount(): number {
    return this.mutations;
  }

  declareCapability(): ConnectorCapability {
    return this.options.capability;
  }

  async execute(input: ConnectorExecuteInput): Promise<ConnectorExecuteResult> {
    const { idempotencyStore } = this.deps;
    assertConnectorAuthority(this.options.capability, input.target);
    if (this.options.responseScope !== undefined) {
      assertSameConnectorScope(input.tenantScope, this.options.responseScope);
    }
    const payloadHash = canonicalHash(envelopeOf(input));
    const record = await idempotencyStore.get(input.idempotencyKey);
    if (record !== undefined) {
      if (record.payloadHash !== payloadHash) {
        throw new IdempotencyConflict({
          key: input.idempotencyKey,
          originalPayload: record.payloadHash,
          newPayload: payloadHash,
          originalTimestamp: createdAtOf(record),
        });
      }
      if (record.status === "EXECUTING") {
        throw new ConnectorValidationError(
          ConnectorValidationErrorCode.ALREADY_EXECUTING,
          `idempotency key "${input.idempotencyKey}" is already executing`,
        );
      }
      return replayRecord(record);
    }
    await idempotencyStore.put({
      key: input.idempotencyKey,
      payloadHash,
      status: "EXECUTING",
      result: { createdAt: new Date().toISOString() },
      expiresAt: Date.now() + TTL_MS,
    });
    try {
      this.mutations += 1;
      const outcome = await this.options.executeHook(input);
      assertConnectorResult(outcome);
      await idempotencyStore.put({
        key: input.idempotencyKey,
        payloadHash,
        status: "COMPLETED",
        result: { outcome, createdAt: new Date().toISOString() },
        expiresAt: Date.now() + TTL_MS,
      });
      return outcome;
    } catch (error) {
      await idempotencyStore.put({
        key: input.idempotencyKey,
        payloadHash,
        status: "FAILED",
        result: { error: errorDescriptor(error), createdAt: new Date().toISOString() },
        expiresAt: Date.now() + TTL_MS,
      });
      throw error;
    }
  }
}
