/**
 * TS receipt conformance harness for contracts/receipt-schema (drift-guard).
 *
 * For every canonical vector the suite recomputes the content hash, runs local
 * verification (verifySignedReceipt), and — when the vector carries trustedKeys
 * — runs verifySignedReceiptTrusted with a resolver built from those keys,
 * asserting the exact §2.6 status and the per-stage flags.
 *
 * The committed vector suite is immutable and only read. Fixture paths resolve
 * from import.meta.url, never from the process working directory. Fixture bytes
 * are parsed as unknown and narrowed with test-only type guards; no any is
 * used. Fiscal convention: money is BigInt cents; proposalVersion and
 * proposalVersion-like fields always serialize as JSON integers, never floats.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv";
import addFormats from "ajv-formats";
import {
  buildSignedReceipt,
  generateReceiptHash,
  generateReceiptKeyPair,
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type KeyTrustResolver,
  type ReceiptContent,
  type ReceiptVerificationSteps,
  type SignedReceipt,
  type SigningKeyInfo,
} from "../index.js";

const conformanceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(conformanceDir, "../..");

const SCHEMAS_DIR = join(
  repoRoot,
  "contracts",
  "receipt-schema",
  "schemas",
);
const VECTORS_PATH = join(
  repoRoot,
  "contracts",
  "receipt-schema",
  "fixtures",
  "conformance-vectors.v1.json",
);

const EXPECTED_VECTOR_COUNT = 8;
const EXPECTED_TRUSTED_VECTOR_COUNT = 5;

/** §2.6 verification status vocabulary shared by every conformance surface. */
const RECEIPT_STATUS = {
  SIGNER_TRUSTED: "SIGNER_TRUSTED",
  VALID: "VALID",
  UNKNOWN_SIGNER: "UNKNOWN_SIGNER",
  KEY_EXPIRED: "KEY_EXPIRED",
  KEY_REVOKED: "KEY_REVOKED",
  CONTENT_VALID: "CONTENT_VALID",
  PAYLOAD_TAMPERED: "PAYLOAD_TAMPERED",
} as const;

type ReceiptStatus =
  (typeof RECEIPT_STATUS)[keyof typeof RECEIPT_STATUS];

const LOCALLY_VALID_STATUSES: readonly ReceiptStatus[] = [
  RECEIPT_STATUS.SIGNER_TRUSTED,
  RECEIPT_STATUS.VALID,
  RECEIPT_STATUS.UNKNOWN_SIGNER,
  RECEIPT_STATUS.KEY_EXPIRED,
  RECEIPT_STATUS.KEY_REVOKED,
];

interface LocalVerification {
  valid: boolean;
  hashValid: boolean;
  signatureValid: boolean;
}

/** Maps a local verification result onto the §2.6 vocabulary. */
function localStatusFor(verification: LocalVerification): ReceiptStatus {
  if (!verification.hashValid) {
    return RECEIPT_STATUS.PAYLOAD_TAMPERED;
  }
  if (!verification.signatureValid) {
    return RECEIPT_STATUS.CONTENT_VALID;
  }
  return RECEIPT_STATUS.VALID;
}

/** True when a §2.6 status is a local pass (valid hash AND valid signature). */
function isLocallyValid(status: string): boolean {
  return (LOCALLY_VALID_STATUSES as readonly string[]).includes(status);
}

// ─── narrowing guards for the §3.1 envelope (test-only, no any) ──────────────

function isReceiptContent(input: unknown): input is ReceiptContent {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return (
    typeof record.missionId === "string" &&
    typeof record.companyId === "string" &&
    typeof record.actorId === "string" &&
    (record.decision === "APPROVE" || record.decision === "REJECT") &&
    typeof record.proposalVersion === "number" &&
    typeof record.evidenceHash === "string" &&
    typeof record.previousStatus === "string" &&
    typeof record.newStatus === "string" &&
    typeof record.payloadHash === "string" &&
    typeof record.timestamp === "string"
  );
}

function isReceiptType(input: unknown): input is
  | "APPROVAL"
  | "EXECUTION"
  | "COMPLETION"
  | "EXTERNAL_SUBMISSION" {
  return (
    input === "APPROVAL" ||
    input === "EXECUTION" ||
    input === "COMPLETION" ||
    input === "EXTERNAL_SUBMISSION"
  );
}

function isSignedReceipt(input: unknown): input is SignedReceipt {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return (
    typeof record.protocolVersion === "string" &&
    isReceiptType(record.receiptType) &&
    record.algorithm === "Ed25519" &&
    isReceiptContent(record.content) &&
    typeof record.receiptHash === "string" &&
    typeof record.signerKeyId === "string" &&
    typeof record.signerPublicKey === "string" &&
    typeof record.signature === "string" &&
    typeof record.issuedAt === "string"
  );
}

function isSigningKeyInfo(input: unknown): input is SigningKeyInfo {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return (
    typeof record.keyId === "string" &&
    typeof record.publicKey === "string" &&
    typeof record.issuedAt === "string" &&
    (record.expiresAt === undefined || typeof record.expiresAt === "string") &&
    (record.revokedAt === undefined || typeof record.revokedAt === "string")
  );
}

interface VectorEntryShape {
  name: string;
  description: string;
  receipt: SignedReceipt;
  trustedKeys?: SigningKeyInfo[];
  vectors: {
    receiptHash: string;
    signatureValid: boolean;
    status: string;
  };
}

interface VectorSuiteShape {
  contract: string;
  version: string;
  vectors: VectorEntryShape[];
}

function isVectorSuite(input: unknown): input is VectorSuiteShape {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  if (record.contract !== "receipt-schema" || record.version !== "v1") {
    return false;
  }
  if (!Array.isArray(record.vectors)) {
    return false;
  }
  return (record.vectors as unknown[]).every((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }
    const candidate = entry as Record<string, unknown>;
    const meta = candidate.vectors as Record<string, unknown> | undefined;
    const keys = candidate.trustedKeys;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.description === "string" &&
      isSignedReceipt(candidate.receipt) &&
      (keys === undefined ||
        (Array.isArray(keys) && (keys as unknown[]).every(isSigningKeyInfo))) &&
      typeof meta === "object" &&
      meta !== null &&
      typeof meta.receiptHash === "string" &&
      typeof meta.signatureValid === "boolean" &&
      typeof meta.status === "string"
    );
  });
}

function loadVectorSuite(): VectorSuiteShape {
  const raw = JSON.parse(readFileSync(VECTORS_PATH, "utf-8")) as unknown;
  if (!isVectorSuite(raw)) {
    throw new Error(
      "conformance-vectors.v1.json does not match the §3.1 vector envelope",
    );
  }
  return raw;
}

/** Builds a KeyTrustResolver from a vector's trustedKeys array. */
function resolverFromTrustedKeys(keys: SigningKeyInfo[]): KeyTrustResolver {
  return (keyId: string) => keys.find((key) => key.keyId === keyId);
}

/** Expected per-stage flags for every trusted pipeline outcome (spec §2.6). */
const EXPECTED_TRUSTED_STEPS: Record<string, ReceiptVerificationSteps> = {
  [RECEIPT_STATUS.SIGNER_TRUSTED]: {
    hashValid: true,
    signatureValid: true,
    signerRecognized: true,
    keyCurrent: true,
    keyRevoked: false,
  },
  [RECEIPT_STATUS.UNKNOWN_SIGNER]: {
    hashValid: true,
    signatureValid: true,
    signerRecognized: false,
    keyCurrent: false,
    keyRevoked: false,
  },
  [RECEIPT_STATUS.KEY_EXPIRED]: {
    hashValid: true,
    signatureValid: true,
    signerRecognized: true,
    keyCurrent: false,
    keyRevoked: false,
  },
  [RECEIPT_STATUS.KEY_REVOKED]: {
    hashValid: true,
    signatureValid: true,
    signerRecognized: true,
    keyCurrent: true,
    keyRevoked: true,
  },
  [RECEIPT_STATUS.CONTENT_VALID]: {
    hashValid: true,
    signatureValid: false,
    signerRecognized: false,
    keyCurrent: false,
    keyRevoked: false,
  },
  [RECEIPT_STATUS.PAYLOAD_TAMPERED]: {
    hashValid: false,
    signatureValid: false,
    signerRecognized: false,
    keyCurrent: false,
    keyRevoked: false,
  },
};

// ─── schema harness (Ajv 8, allErrors + strict, ajv-formats) ─────────────────

function loadSchema(filePath: string): AnySchema {
  return JSON.parse(readFileSync(filePath, "utf-8")) as AnySchema;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (errors === null || errors === undefined || errors.length === 0) {
    return "no errors";
  }
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message ?? ""}`)
    .join("; ");
}

function compileValidator(
  contentSchema: AnySchema,
  signedReceiptSchema: AnySchema,
  keyInfoSchema: AnySchema,
): {
  validate: ValidateFunction;
  validateContent: ValidateFunction;
  validateKey: ValidateFunction;
  warnings: string[];
} {
  const warnings: string[] = [];
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    logger: {
      log: () => {},
      warn: (message: unknown) => warnings.push(String(message)),
      error: () => {},
    },
  });
  addFormats(ajv);
  ajv.addSchema(contentSchema, "receipt-content.schema.json");
  ajv.addSchema(keyInfoSchema, "signing-key-info.schema.json");
  const validateContent = ajv.compile(contentSchema);
  const validateKey = ajv.compile(keyInfoSchema);
  const validate = ajv.compile(signedReceiptSchema);
  return { validate, validateContent, validateKey, warnings };
}

function expectSchemaValid(
  validate: ValidateFunction,
  label: string,
  data: unknown,
): void {
  const valid = validate(data);
  expect(valid, `${label} should validate: ${formatErrors(validate.errors)}`).toBe(
    true,
  );
}

function expectSchemaInvalid(
  validate: ValidateFunction,
  label: string,
  data: unknown,
  errorContains: string,
): void {
  const valid = validate(data);
  expect(valid, `${label} should NOT validate`).toBe(false);
  expect(
    formatErrors(validate.errors),
    `${label} error should mention ${errorContains}`,
  ).toContain(errorContains);
}

const sampleContent: ReceiptContent = {
  missionId: "mis_schema_test",
  companyId: "cmp_schema_test",
  actorId: "user_schema_test",
  decision: "APPROVE",
  proposalVersion: 3,
  evidenceHash: "a1b2c3d4e5",
  previousStatus: "AWAITING_APPROVAL",
  newStatus: "APPROVED",
  payloadHash: "f6e7d8c9b0",
  timestamp: "2026-07-30T12:00:00Z",
};

// ─── suite ───────────────────────────────────────────────────────────────────

describe("TS receipt conformance harness (drift-guard)", () => {
  it("recomputes every vector content hash against the vector expectation", () => {
    const suite = loadVectorSuite();
    expect(suite.vectors).toHaveLength(EXPECTED_VECTOR_COUNT);
    for (const entry of suite.vectors) {
      const computed = generateReceiptHash(entry.receipt.content);
      if (entry.vectors.status === RECEIPT_STATUS.PAYLOAD_TAMPERED) {
        // §3.1: the tampered vector carries a stale receiptHash over the
        // pre-tamper content — recomputing over the mutated content MUST differ.
        expect(computed).not.toBe(entry.vectors.receiptHash);
      } else {
        expect(computed).toBe(entry.vectors.receiptHash);
      }
    }
  });

  it("matches local verification signatureValid to vectors.signatureValid", () => {
    const suite = loadVectorSuite();
    expect(suite.vectors).toHaveLength(EXPECTED_VECTOR_COUNT);
    for (const entry of suite.vectors) {
      const local = verifySignedReceipt(entry.receipt);
      expect(local.signatureValid).toBe(entry.vectors.signatureValid);
    }
  });

  it("maps local verification onto the §2.6 vocabulary per the local-equivalence rule", () => {
    const suite = loadVectorSuite();
    expect(suite.vectors).toHaveLength(EXPECTED_VECTOR_COUNT);
    for (const entry of suite.vectors) {
      const local = verifySignedReceipt(entry.receipt);
      const mapped = localStatusFor(local);
      if (isLocallyValid(entry.vectors.status)) {
        // Trusted lifecycle statuses are a local pass: hash and signature hold.
        expect(local.valid).toBe(true);
        expect(mapped).toBe(RECEIPT_STATUS.VALID);
      } else {
        // Local-only statuses must match exactly (CONTENT_VALID / PAYLOAD_TAMPERED).
        expect(mapped).toBe(entry.vectors.status);
      }
    }
  });

  it("keeps envelope self-consistency: non-tampered receipts carry the canonical hash", () => {
    const suite = loadVectorSuite();
    expect(suite.vectors).toHaveLength(EXPECTED_VECTOR_COUNT);
    for (const entry of suite.vectors) {
      if (entry.vectors.status !== RECEIPT_STATUS.PAYLOAD_TAMPERED) {
        expect(entry.receipt.receiptHash).toBe(entry.vectors.receiptHash);
      }
    }
  });

  describe("trusted verification (verifySignedReceiptTrusted)", () => {
    it("asserts the exact §2.6 status for every vector with trustedKeys", async () => {
      const suite = loadVectorSuite();
      const keyed = suite.vectors.filter(
        (entry) => entry.trustedKeys !== undefined,
      );
      expect(keyed).toHaveLength(EXPECTED_TRUSTED_VECTOR_COUNT);
      for (const entry of keyed) {
        const resolver = resolverFromTrustedKeys(entry.trustedKeys ?? []);
        const trusted = await verifySignedReceiptTrusted(
          entry.receipt,
          resolver,
        );
        expect(trusted.status).toBe(entry.vectors.status);
      }
    });

    it("asserts the per-stage flags for every trusted outcome", async () => {
      const suite = loadVectorSuite();
      const keyed = suite.vectors.filter(
        (entry) => entry.trustedKeys !== undefined,
      );
      expect(keyed).toHaveLength(EXPECTED_TRUSTED_VECTOR_COUNT);
      for (const entry of keyed) {
        const resolver = resolverFromTrustedKeys(entry.trustedKeys ?? []);
        const trusted = await verifySignedReceiptTrusted(
          entry.receipt,
          resolver,
        );
        expect(trusted.status).toBe(entry.vectors.status);
        expect(trusted.steps).toEqual(
          EXPECTED_TRUSTED_STEPS[entry.vectors.status],
        );
      }
    });
  });

  describe("schema conformance (draft-07 via Ajv 8 + ajv-formats)", () => {
    const contentSchema = loadSchema(
      join(SCHEMAS_DIR, "receipt-content.schema.json"),
    );
    const signedReceiptSchema = loadSchema(
      join(SCHEMAS_DIR, "signed-receipt.schema.json"),
    );
    const keyInfoSchema = loadSchema(
      join(SCHEMAS_DIR, "signing-key-info.schema.json"),
    );

    const { validate, validateContent, validateKey, warnings } =
      compileValidator(contentSchema, signedReceiptSchema, keyInfoSchema);

    it("compiles the three schemas in Ajv strict mode without warnings", () => {
      expect(warnings, "Ajv strict mode must emit no compilation warnings").toEqual(
        [],
      );
    });

    it("validates a typed SignedReceipt built with buildSignedReceipt", () => {
      const keyPair = generateReceiptKeyPair("key_schema_test");
      const receipt = buildSignedReceipt(sampleContent, keyPair);
      expectSchemaValid(validate, "typed buildSignedReceipt receipt", receipt);
    });

    it("validates every vector receipt and content against the schemas", () => {
      const suite = loadVectorSuite();
      expect(suite.vectors).toHaveLength(EXPECTED_VECTOR_COUNT);
      for (const entry of suite.vectors) {
        expectSchemaValid(
          validate,
          `vector ${entry.name} receipt`,
          entry.receipt,
        );
        expectSchemaValid(
          validateContent,
          `vector ${entry.name} content`,
          entry.receipt.content,
        );
      }
    });

    it("validates every trustedKeys entry against signing-key-info.schema.json", () => {
      const suite = loadVectorSuite();
      const keyedVectors = suite.vectors.filter(
        (entry) => entry.trustedKeys !== undefined,
      );
      expect(keyedVectors).toHaveLength(EXPECTED_TRUSTED_VECTOR_COUNT);
      for (const entry of keyedVectors) {
        for (const key of entry.trustedKeys ?? []) {
          expectSchemaValid(
            validateKey,
            `vector ${entry.name} trusted key`,
            key,
          );
        }
      }
    });

    describe("negative cases (broken receipts must fail)", () => {
      const suite = loadVectorSuite();
      const fixture = suite.vectors[0].receipt;
      const fixtureRecord = fixture as unknown as Record<string, unknown>;
      const content = fixtureRecord.content as Record<string, unknown>;

      it("rejects an unknown receiptType", () => {
        expectSchemaInvalid(
          validate,
          "receiptType BOGUS",
          { ...fixtureRecord, receiptType: "BOGUS" },
          "receiptType",
        );
      });

      it("rejects a non-hex receiptHash", () => {
        expectSchemaInvalid(
          validate,
          "receiptHash not hex",
          { ...fixtureRecord, receiptHash: "zz-not-hex" },
          "receiptHash",
        );
      });

      it("rejects extra bundle properties", () => {
        expectSchemaInvalid(
          validate,
          "extra property",
          { ...fixtureRecord, extraField: "surprise" },
          "additional properties",
        );
      });

      it("rejects content with an unknown decision", () => {
        expectSchemaInvalid(
          validate,
          "decision MAYBE",
          { ...fixtureRecord, content: { ...content, decision: "MAYBE" } },
          "decision",
        );
      });

      it("rejects content with a non-integer proposalVersion", () => {
        // Non-integer built arithmetically: the schema must enforce integer.
        expectSchemaInvalid(
          validate,
          "proposalVersion non-integer",
          {
            ...fixtureRecord,
            content: { ...content, proposalVersion: 7 / 2 },
          },
          "proposalVersion",
        );
      });

      it("rejects a bundle missing a required field", () => {
        const missingSignature: Record<string, unknown> = {
          ...fixtureRecord,
        };
        delete missingSignature.signature;
        expectSchemaInvalid(
          validate,
          "missing signature",
          missingSignature,
          "signature",
        );
      });

      it("rejects a bundle with a non-RFC3339 issuedAt", () => {
        expectSchemaInvalid(
          validate,
          "issuedAt not RFC3339",
          { ...fixtureRecord, issuedAt: "31/07/2026" },
          "issuedAt",
        );
      });
    });
  });
});
