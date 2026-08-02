/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]`
 *
 * Validates a signed receipt bundle with ajv against the canonical schema
 * contracts/receipt-schema/schemas/signed-receipt.schema.json (the content
 * sub-schema is resolved through receipt-content.schema.json), then verifies
 * the receipt hash, Ed25519 signature, and trusted signer lifecycle.
 *
 * Fail-closed exit semantics: exit 0 only when the hash AND signature are
 * valid AND the signer is trusted (recognized, current, not revoked); exit 1
 * for any failed verification (JSON result to stdout); exit 2 for usage or
 * IO/parse errors, including documents that do not conform to the schema.
 */

import { Ajv, type AnySchema } from "ajv";
import { createRequire } from "node:module";
import {
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type KeyTrustResolver,
  type SignedReceipt,
  type SigningKeyInfo,
} from "../../receipts/index.js";
import { loadContractJson } from "../adapters/schema-loader.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

/** Embedded-key trust root: an epoch issue date so the key is always current. */
const EPOCH_ISSUED_AT = "1970-01-01T00:00:00.000Z";

// Schema validation: register the content sub-schema first (the
// signed-receipt schema references it by relative $ref, resolved through its
// $id), then compile the top-level validator once. Schemas load from the
// package-root contracts/ directory (works in src/ and dist/).
const receiptContentSchema = loadContractJson(
  "receipt-schema/schemas/receipt-content.schema.json",
);
const signedReceiptSchema = loadContractJson(
  "receipt-schema/schemas/signed-receipt.schema.json",
);
    const ajv = new Ajv({ allErrors: true, strict: false });
    // ajv-formats is CJS with ESM-style types; createRequire is the reliable
    // interop under NodeNext for both Bun (dev) and Node (dist).
    const addFormats = createRequire(import.meta.url)("ajv-formats") as (
      a: typeof ajv,
    ) => void;
    addFormats(ajv);
ajv.addSchema(receiptContentSchema as AnySchema);
const validateSignedReceipt = ajv.compile(signedReceiptSchema as AnySchema);

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

function makeResolver(
  receipt: SignedReceipt,
  keys: unknown,
): KeyTrustResolver {
  if (keys === undefined) {
    // Embedded public key only: self-trust the signer's own key with an epoch
    // issue date so the lifecycle check is deterministic.
    return (keyId: string) =>
      keyId === receipt.signerKeyId
        ? {
            keyId,
            publicKey: receipt.signerPublicKey,
            issuedAt: EPOCH_ISSUED_AT,
          }
        : undefined;
  }
  if (!Array.isArray(keys) || !(keys as unknown[]).every(isSigningKeyInfo)) {
    throw new Error("keys file must be an array of SigningKeyInfo objects");
  }
  const keyInfos = keys as unknown as SigningKeyInfo[];
  return (keyId: string) => keyInfos.find((key) => key.keyId === keyId);
}

export async function receiptVerifyCommand(args: string[]): Promise<number> {
  const receiptPath = args[0];
  if (receiptPath === undefined) {
    return usageError(
      "usage: drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]",
    );
  }
  let keysPath: string | undefined;
  if (args.length > 1) {
    if (args[1] === "--keys") {
      if (args[2] === undefined || args.length > 3) {
        return usageError("--keys requires exactly one <keys.json> path");
      }
      keysPath = args[2];
    } else {
      return usageError(`unknown option "${args[1]}"`);
    }
  }
  try {
    const raw = readJsonFile(receiptPath);
    if (!validateSignedReceipt(raw)) {
          const detail = (validateSignedReceipt.errors ?? [])
            .map((e: { instancePath?: string; message?: string }) =>
              `${e.instancePath === "" || e.instancePath === undefined ? "" : `${e.instancePath} `}${e.message ?? "invalid"}`,
            )
            .join("; ");
      return usageError(
        `${receiptPath} is not a valid SignedReceipt${
          detail === "" ? "" : ` (${detail})`
        }`,
      );
    }
    const receipt = raw as SignedReceipt;
    const keys = keysPath === undefined ? undefined : readJsonFile(keysPath);
    const resolver = makeResolver(receipt, keys);
    const local = verifySignedReceipt(receipt);
    const trusted = await verifySignedReceiptTrusted(receipt, resolver);
    // Fail closed on broken trust: exit 0 only when hash + signature are
    // valid AND the signer is trusted (recognized, current, not revoked).
    const valid = local.valid && trusted.status === "SIGNER_TRUSTED";
    const output = {
      valid,
      status: trusted.status,
      steps: trusted.steps,
      keyId: receipt.signerKeyId,
      protocolVersion: receipt.protocolVersion,
    };
    emitJson(output);
    emitSummary(
      "receipt verify",
      `valid=${valid} status=${trusted.status} keyId=${receipt.signerKeyId}`,
    );
    return valid ? 0 : 1;
  } catch (error) {
    console.error(`receipt verify: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
