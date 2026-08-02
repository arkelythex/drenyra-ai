/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * CLI command tests — exit-code contracts and end-to-end mission lifecycle for
 * the cmd/ command adapters.
 *
 * Covers: INTENT_HANDLER_NOT_CONFIGURED on execute without a handler, the
 * --demo lifecycle (start --demo -> 3x execute --demo -> approve -> APPROVED,
 * 5 events), the atomic JSON-file store round trip (storeSchemaVersion
 * present), the receipt verify exit-code contract (valid -> 0, revoked key ->
 * 1, tampered -> 1, schema-invalid -> 2), and the writeFileAtomic helper
 * (temp+rename leaves the target intact on failure; no stale tmp files).
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import {
  receiptVerifyCommand,
} from "../commands/receipt-verify.js";
import {
  missionStartCommand,
} from "../commands/mission-start.js";
import {
  missionApplyCommand,
} from "../commands/mission-apply.js";
import {
  missionStatusCommand,
} from "../commands/mission-status.js";
import {
  MissionFileStore,
  writeFileAtomic,
  buildTempPath,
  STORE_SCHEMA_VERSION,
} from "../adapters/file-mission-store.js";
import {
  generateReceiptKeyPair,
  buildSignedReceipt,
  type ReceiptContent,
  type SigningKeyInfo,
} from "../../receipts/index.js";

/** Creates a fresh temp directory for one test. */
function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "drenyra-cli-test-"));
}

/** Parses the last JSON object written to stdout by a command under test. */
function lastStdout(): unknown {
  const calls = vi.mocked(console.log).mock.calls;
  const last = calls[calls.length - 1];
  if (last === undefined) {
    throw new Error("no console.log output captured");
  }
  return JSON.parse(String(last[0])) as unknown;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function makeCreateCommand(): Record<string, unknown> {
  return {
    companyId: "20123456789",
    fiscalPeriod: "202501",
    intent: "monthly-close",
    input: { instruction: "close january books" },
  };
}

function makeExecuteCommand(missionId: string, expectedVersion: number): Record<string, unknown> {
  return {
    type: "execute",
    missionId,
    payload: { expectedMissionVersion: expectedVersion },
  };
}

function makeApproveCommand(missionId: string, expectedVersion: number): Record<string, unknown> {
  return {
    type: "approve",
    missionId,
    payload: {
      proposalId: "proposal_1",
      proposalVersion: 1,
      evidenceHash: "evt_hash_1",
      expectedMissionVersion: expectedVersion,
    },
  };
}

function makeReceiptContent(missionId: string): ReceiptContent {
  return {
    missionId,
    companyId: "20123456789",
    actorId: "actor_test",
    decision: "APPROVE",
    proposalVersion: 1,
    evidenceHash: "abc123",
    previousStatus: "AWAITING_APPROVAL",
    newStatus: "APPROVED",
    payloadHash: "def456",
    timestamp: new Date().toISOString(),
  };
}

describe("mission apply: intent handler policy", () => {
  let dir: string;
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("rejects execute without a handler with INTENT_HANDLER_NOT_CONFIGURED (exit 1)", async () => {
    dir = makeTmpDir();
    const storePath = join(dir, "store.json");
    const createPath = join(dir, "create.json");
    writeJson(createPath, makeCreateCommand());
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const startCode = await missionStartCommand([createPath, "--store", storePath]);
    expect(startCode).toBe(0);
    const missionId = (lastStdout() as { id: string }).id;

    const executePath = join(dir, "execute.json");
    writeJson(executePath, makeExecuteCommand(missionId, 1));
    const applyCode = await missionApplyCommand([executePath, "--store", storePath]);
    expect(applyCode).toBe(1);
    const error = lastStdout() as { error: { code: string } };
    expect(error.error.code).toBe("INTENT_HANDLER_NOT_CONFIGURED");

    // Fail closed: nothing was persisted.
    const store = JSON.parse(readFileSync(storePath, "utf-8")) as {
      missions: unknown[];
      events: unknown[];
    };
    expect(store.missions).toHaveLength(1);
    expect(store.events).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it("does not leak the demo handler across invocations (start --demo + apply without --demo still fails)", async () => {
    dir = makeTmpDir();
    const storePath = join(dir, "store.json");
    const createPath = join(dir, "create.json");
    writeJson(createPath, makeCreateCommand());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const startCode = await missionStartCommand([createPath, "--store", storePath, "--demo"]);
    expect(startCode).toBe(0);
    const missionId = (lastStdout() as { id: string }).id;

    const executePath = join(dir, "execute.json");
    writeJson(executePath, makeExecuteCommand(missionId, 1));
    const applyCode = await missionApplyCommand([executePath, "--store", storePath]);
    expect(applyCode).toBe(1);
    const error = lastStdout() as { error: { code: string } };
    expect(error.error.code).toBe("INTENT_HANDLER_NOT_CONFIGURED");
  });
});

describe("mission --demo lifecycle end-to-end", () => {
  let dir: string;
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("drives start --demo -> 3x execute --demo -> approve --demo to APPROVED with 5 events and a versioned store file", async () => {
    dir = makeTmpDir();
    const storePath = join(dir, "store.json");
    const createPath = join(dir, "create.json");
    writeJson(createPath, makeCreateCommand());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const startCode = await missionStartCommand([createPath, "--store", storePath, "--demo"]);
    expect(startCode).toBe(0);
    const missionId = (lastStdout() as { id: string }).id;

    const executePath = (n: number) => join(dir, `execute-${n}.json`);
    writeJson(executePath(1), makeExecuteCommand(missionId, 1));
    writeJson(executePath(2), makeExecuteCommand(missionId, 2));
    writeJson(executePath(3), makeExecuteCommand(missionId, 3));
    for (let i = 1; i <= 3; i++) {
      const code = await missionApplyCommand([executePath(i), "--store", storePath, "--demo"]);
      expect(code).toBe(0);
    }

    const approvePath = join(dir, "approve.json");
    writeJson(approvePath, makeApproveCommand(missionId, 4));
    const approveCode = await missionApplyCommand([approvePath, "--store", storePath, "--demo"]);
    expect(approveCode).toBe(0);

    // status reads back the persisted round trip.
    const statusCode = await missionStatusCommand([missionId, "--store", storePath]);
    expect(statusCode).toBe(0);
    const status = lastStdout() as {
      snapshot: { status: string; version: number };
      events: unknown[];
    };
    expect(status.snapshot.status).toBe("APPROVED");
    expect(status.snapshot.version).toBe(5);
    expect(status.events).toHaveLength(5);

    // Atomic store file round trip: storeSchemaVersion present and intact.
    const store = JSON.parse(readFileSync(storePath, "utf-8")) as {
      storeSchemaVersion: number;
      missions: unknown[];
      events: unknown[];
      idempotency: unknown[];
    };
    expect(store.storeSchemaVersion).toBe(STORE_SCHEMA_VERSION);
    expect(store.missions).toHaveLength(1);
    expect(store.events).toHaveLength(5);
    expect(store.idempotency).toHaveLength(0);

    // The file store hydrates the same data through its own API.
    const fileStore = new MissionFileStore(storePath);
    const stores = await fileStore.hydrate();
    const reloaded = await stores.missions.findById(missionId);
    expect(reloaded?.status).toBe("APPROVED");
    expect(await stores.events.list(missionId)).toHaveLength(5);
  });
});

describe("receipt verify exit-code contract", () => {
  let dir: string;
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("exits 0 for a valid receipt with a trusted signer", async () => {
    dir = makeTmpDir();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const key = generateReceiptKeyPair("key_test_valid");
    const receiptPath = join(dir, "receipt.json");
    writeJson(receiptPath, buildSignedReceipt(makeReceiptContent("mission_rv_1"), key));

    const code = await receiptVerifyCommand([receiptPath]);
    expect(code).toBe(0);
    const output = lastStdout() as { valid: boolean; status: string };
    expect(output.valid).toBe(true);
    expect(output.status).toBe("SIGNER_TRUSTED");
  });

  it("exits 1 with KEY_REVOKED when the signer key is revoked", async () => {
    dir = makeTmpDir();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const key = generateReceiptKeyPair("key_test_revoked");
    const receiptPath = join(dir, "receipt.json");
    writeJson(receiptPath, buildSignedReceipt(makeReceiptContent("mission_rv_2"), key));

    const revokedKeys: SigningKeyInfo[] = [
      {
        keyId: key.keyId,
        publicKey: key.publicKey,
        issuedAt: "2020-01-01T00:00:00.000Z",
        revokedAt: "2021-01-01T00:00:00.000Z",
      },
    ];
    const keysPath = join(dir, "revoked-keys.json");
    writeJson(keysPath, revokedKeys);

    const code = await receiptVerifyCommand([receiptPath, "--keys", keysPath]);
    expect(code).toBe(1);
    const output = lastStdout() as { valid: boolean; status: string };
    expect(output.valid).toBe(false);
    expect(output.status).toBe("KEY_REVOKED");
  });

  it("exits 1 with PAYLOAD_TAMPERED when the receipt hash was tampered with", async () => {
    dir = makeTmpDir();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const key = generateReceiptKeyPair("key_test_tampered");
    const receipt = buildSignedReceipt(makeReceiptContent("mission_rv_3"), key);
    receipt.receiptHash = receipt.receiptHash.startsWith("0")
      ? `1${receipt.receiptHash.slice(1)}`
      : `0${receipt.receiptHash.slice(1)}`;
    const receiptPath = join(dir, "receipt.json");
    writeJson(receiptPath, receipt);

    const code = await receiptVerifyCommand([receiptPath]);
    expect(code).toBe(1);
    const output = lastStdout() as { valid: boolean; status: string };
    expect(output.valid).toBe(false);
    expect(output.status).toBe("PAYLOAD_TAMPERED");
  });

  it("exits 2 for a document that does not conform to the signed-receipt schema", async () => {
    dir = makeTmpDir();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const receiptPath = join(dir, "not-a-receipt.json");
    writeJson(receiptPath, { not: "a receipt" });

    const code = await receiptVerifyCommand([receiptPath]);
    expect(code).toBe(2);
  });
});

describe("writeFileAtomic", () => {
  let dir: string;
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes atomically and leaves no stale tmp files behind", async () => {
    dir = makeTmpDir();
    const target = join(dir, "store.json");
    await writeFileAtomic(target, "{\"a\":1}\n");
    expect(readFileSync(target, "utf-8")).toBe("{\"a\":1}\n");
    const leftovers = readdirSync(dir).filter((name) => name.includes(".tmp"));
    expect(leftovers).toHaveLength(0);
  });

  it("uses a discoverable temp-file pattern in the target directory", () => {
    dir = makeTmpDir();
    const target = join(dir, "store.json");
    const tmp = buildTempPath(target);
    expect(dirname(tmp)).toBe(dir);
    expect(basename(tmp)).toMatch(/^store\.json\.tmp\.\d+\.[0-9a-f-]+$/);
  });

  it("leaves an existing target intact when the rename fails", async () => {
    dir = makeTmpDir();
    // Target path is an existing directory: the temp file is written and
    // fsynced, then renameSync over a directory fails deterministically.
    const blocked = join(dir, "store.json");
    mkdirSync(blocked);

    await expect(writeFileAtomic(blocked, "data")).rejects.toThrow();
    expect(statSync(blocked).isDirectory()).toBe(true);
    const leftovers = readdirSync(dir).filter((name) => name.includes(".tmp"));
    expect(leftovers).toHaveLength(0);
  });

  it("rejects when the target directory does not exist (unwritable path)", async () => {
    dir = makeTmpDir();
    const target = join(dir, "missing-dir", "store.json");
    await expect(writeFileAtomic(target, "data")).rejects.toThrow();
    expect(existsSync(join(dir, "missing-dir"))).toBe(false);
  });
});
