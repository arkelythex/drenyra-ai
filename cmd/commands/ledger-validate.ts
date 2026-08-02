/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai ledger validate <ledger.json>`
 *
 * Validates an append-only audit ledger (manifest + entries) against the
 * ledger module's hash-chain rules. Exit 0 when the chain is valid, 1 when it
 * diverges (JSON result to stdout), 2 for usage/IO errors.
 */

import {
  validateLedger,
  type EntryType,
  type LedgerEntry,
  type LedgerManifest,
} from "../../ledger/index.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

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

export function ledgerValidateCommand(args: string[]): number {
  const ledgerPath = args[0];
  if (ledgerPath === undefined) {
    return usageError("usage: drenyra-ai ledger validate <ledger.json>");
  }
  if (args.length > 1) {
    return usageError(`unknown option "${args[1]}"`);
  }
  try {
    const raw = readJsonFile(ledgerPath);
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
    emitJson(output);
    emitSummary(
      "ledger validate",
      `valid=${result.valid} reasons=${result.reasons.length}`,
    );
    return result.valid ? 0 : 1;
  } catch (error) {
    console.error(`ledger validate: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
