#!/usr/bin/env bun
/**
 * drenyra-ai CLI — receipt verification and ledger validation.
 *
 * Commands:
 *   drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]
 *   drenyra-ai ledger validate <ledger.json>
 *
 * Exit codes: 0 valid, 1 invalid, 2 usage/IO error. JSON goes to stdout; the
 * human-readable one-line summary goes to stderr.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money, and exit codes are plain integers (0/1/2).
 */

import { readFileSync } from "node:fs";
import {
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type KeyTrustResolver,
  type ReceiptContent,
  type SignedReceipt,
  type SigningKeyInfo,
} from "../receipts/index.js";
import {
  validateLedger,
  type EntryType,
  type LedgerEntry,
  type LedgerManifest,
} from "../ledger/index.js";

/** Embedded-key trust root: an epoch issue date so the key is always current. */
const EPOCH_ISSUED_AT = "1970-01-01T00:00:00.000Z";

// ─── JSON narrowing guards (no any) ──────────────────────────────────────────

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

function isSignedReceipt(input: unknown): input is SignedReceipt {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return (
    typeof record.protocolVersion === "string" &&
    (record.receiptType === "APPROVAL" ||
      record.receiptType === "EXECUTION" ||
      record.receiptType === "COMPLETION" ||
      record.receiptType === "EXTERNAL_SUBMISSION") &&
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

function isStringArray(input: unknown): input is string[] {
  if (!Array.isArray(input)) {
    return false;
  }
  return (input as unknown[]).every((item) => typeof item === "string");
}

function isLedgerManifest(input: unknown): input is LedgerManifest {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  const trustRoot = record.trustRoot as Record<string, unknown> | undefined;
  const policy = record.signingPolicy as Record<string, unknown> | undefined;
  return (
    typeof record.ledgerId === "string" &&
    typeof record.protocolVersion === "string" &&
    record.hashAlgorithm === "SHA-256" &&
    typeof record.jurisdiction === "string" &&
    typeof record.createdAt === "string" &&
    trustRoot !== undefined &&
    isStringArray(trustRoot.keyIds) &&
    policy !== undefined &&
    typeof policy.required === "boolean" &&
    policy.algorithm === "Ed25519" &&
    isStringArray(policy.keyIds)
  );
}

function isEntryType(input: unknown): input is EntryType {
  return (
    input === "GENESIS" ||
    input === "RECEIPT_RECORDED" ||
    input === "ATTESTATION_ADDED" ||
    input === "ENTRY_SUPERSEDED" ||
    input === "ENTRY_REVOKED" ||
    input === "CHECKPOINT_CREATED"
  );
}

function isLedgerEntry(input: unknown): input is LedgerEntry {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  const baseShape =
    typeof record.entryId === "string" &&
    typeof record.ledgerId === "string" &&
    typeof record.sequence === "number" &&
    isEntryType(record.entryType) &&
    typeof record.previousEntryHash === "string" &&
    typeof record.payloadHash === "string" &&
    typeof record.receiptHash === "string" &&
    typeof record.occurredAt === "string" &&
    typeof record.recordedAt === "string" &&
    typeof record.actor === "string" &&
    typeof record.schemaVersion === "string" &&
    typeof record.signerKeyId === "string";
  if (!baseShape) {
    return false;
  }
  if (record.signerKeyId === "hash-only") {
    return record.signature === undefined && record.signerPublicKey === undefined;
  }
  return (
    typeof record.signature === "string" &&
    typeof record.signerPublicKey === "string"
  );
}

function isLedgerEntryArray(input: unknown): input is LedgerEntry[] {
  return (
    Array.isArray(input) && (input as unknown[]).every(isLedgerEntry)
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function loadJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function usageError(message: string): number {
  console.error(`drenyra-ai: ${message}`);
  return 2;
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

async function receiptVerify(args: string[]): Promise<number> {
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
    const raw = loadJson(receiptPath);
    if (!isSignedReceipt(raw)) {
      return usageError(`${receiptPath} is not a valid SignedReceipt`);
    }
    const receipt = raw;
    const keys = keysPath === undefined ? undefined : loadJson(keysPath);
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
    console.log(JSON.stringify(output, null, 2));
    console.error(
      `receipt verify: valid=${valid} status=${trusted.status} keyId=${receipt.signerKeyId}`,
    );
    return valid ? 0 : 1;
  } catch (error) {
    console.error(`receipt verify: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}

function ledgerValidate(args: string[]): number {
  const ledgerPath = args[0];
  if (ledgerPath === undefined) {
    return usageError("usage: drenyra-ai ledger validate <ledger.json>");
  }
  if (args.length > 1) {
    return usageError(`unknown option "${args[1]}"`);
  }
  try {
    const raw = loadJson(ledgerPath);
    if (typeof raw !== "object" || raw === null) {
      return usageError(`${ledgerPath} must be { manifest, entries }`);
    }
    const record = raw as Record<string, unknown>;
    if (
      !isLedgerManifest(record.manifest) ||
      !isLedgerEntryArray(record.entries)
    ) {
      return usageError(`${ledgerPath} must be { manifest, entries }`);
    }
    const result = validateLedger(record.manifest, record.entries);
    const output = {
      valid: result.valid,
      firstDivergence: result.firstDivergence ?? null,
      reasons: result.reasons,
    };
    console.log(JSON.stringify(output, null, 2));
    console.error(
      `ledger validate: valid=${result.valid} reasons=${result.reasons.length}`,
    );
    return result.valid ? 0 : 1;
  } catch (error) {
    console.error(`ledger validate: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}

async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const subcommand = argv[1];
  if (command === "receipt" && subcommand === "verify") {
    return receiptVerify(argv.slice(2));
  }
  if (command === "ledger" && subcommand === "validate") {
    return ledgerValidate(argv.slice(2));
  }
  return usageError(
    `unknown command "${command ?? ""} ${subcommand ?? ""}"; expected "receipt verify" or "ledger validate"`,
  );
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
