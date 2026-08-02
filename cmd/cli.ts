#!/usr/bin/env bun
/**
 * drenyra-ai CLI — receipt verification, ledger validation, missions, and
 * candidate identity + proportional review.
 *
 * Commands:
 *   drenyra-ai receipt verify <receipt.json> [--keys <keys.json>]
 *   drenyra-ai ledger validate <ledger.json>
 *   drenyra-ai mission start <create-command.json> [--store <file>]
 *   drenyra-ai mission apply <command.json> [--store <file>]
 *   drenyra-ai mission status <missionId> [--store <file>]
 *   drenyra-ai candidate inspect <candidate.json>
 *   drenyra-ai candidate verify <candidate.json> --subject <subject-file>
 *
 * Candidate inspect file: { subjectB64, scope: { ruc, period }, valueCents,
 * reversibility, jurisdiction } — valueCents is a decimal string parsed to
 * BigInt (floats and negatives are rejected). Candidate verify revalidates
 * identity by hashing the exact bytes of --subject and comparing to the
 * candidate.subjectHash field.
 *
 * Exit codes: 0 valid, 1 invalid/business error, 2 usage/IO error. JSON goes
 * to stdout; the human-readable one-line summary goes to stderr.
 *
 * Mission store file (default ./drenyra-missions.json):
 *   { "missions": MissionSnapshot[], "events": MissionEvent[],
 *     "idempotency": IdempotencyRecord[] }
 * Apply command files may carry an optional "idempotencyKey" field beside the
 * mission command (type/missionId/payload). The CLI registers a demo
 * auto-advance intent handler so the full lifecycle can be driven from the
 * shell: start -> execute (queues) -> execute (runs) -> execute (awaits
 * approval) -> approve.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai, and exit codes are plain
 * integers (0/1/2).
 */

import { readFileSync, writeFileSync } from "node:fs";
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
import {
  AccountingMissionStatus,
  IdempotencyConflict,
  MissionRuntime,
  isMissionError,
  type BoundMissionCommand,
  type CreateMissionCommand,
  type IdempotencyRecord,
  type MissionEvent,
  type MissionSnapshot,
} from "../missions/index.js";
import {
  InMemoryIdempotencyStore,
  InMemoryMissionEventStore,
  InMemoryMissionStore,
  IntentRegistryImpl,
} from "../missions/index.js";
import { CandidateLifecycle } from "../candidates/lifecycle.js";
import { isCandidateError } from "../candidates/errors.js";
import { computeSubjectHash } from "../candidates/identity.js";
import type { Reversibility } from "../candidates/types.js";
import { selectReviewLenses } from "../review/lenses.js";
import { forecastReviewWorkload } from "../review/workload.js";

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

    // ─── missions ───────────────────────────────────────────────────────────────
    //
    // Thin executor over the in-memory stores. File I/O (hydrate/persist) lives
    // HERE only — the MissionRuntime never touches the filesystem. Fiscal
    // convention: monetary values in the Drenyra ecosystem are BigInt cents; no
    // float is ever used for money; sequence/index/version fields are JSON
    // integers, never floats.

    const DEFAULT_STORE_PATH = "./drenyra-missions.json";
    const VALID_MISSION_INTENTS = new Set([
      "monthly-close",
      "correction",
      "reconciliation",
      "invoice-review",
      "compliance-check",
    ]);
    const VALID_COMMAND_TYPES = new Set([
      "create",
      "execute",
      "approve",
      "reject",
      "reconcile",
    ]);

    interface MissionStoreFile {
      missions: MissionSnapshot[];
      events: MissionEvent[];
      idempotency: IdempotencyRecord[];
    }

    interface MissionRuntimeStores {
      missions: InMemoryMissionStore;
      events: InMemoryMissionEventStore;
      idempotency: InMemoryIdempotencyStore;
    }

    function isCreateMissionCommand(
      input: unknown,
    ): input is CreateMissionCommand {
      if (typeof input !== "object" || input === null) {
        return false;
      }
      const record = input as Record<string, unknown>;
      const inputField = record.input as Record<string, unknown> | undefined;
      return (
        typeof record.companyId === "string" &&
        typeof record.fiscalPeriod === "string" &&
        typeof record.intent === "string" &&
        VALID_MISSION_INTENTS.has(record.intent) &&
        typeof inputField === "object" &&
        inputField !== null &&
        typeof inputField.instruction === "string"
      );
    }

    function parseCommandFile(raw: unknown): {
      command: BoundMissionCommand;
      idempotencyKey?: string;
    } {
      if (typeof raw !== "object" || raw === null) {
        throw new Error("command file must be a JSON object");
      }
      const record = raw as Record<string, unknown>;
      const idempotencyKey =
        typeof record.idempotencyKey === "string"
          ? record.idempotencyKey
          : undefined;
      const type = record.type;
      const missionId = record.missionId;
      const payload = record.payload;
      if (typeof type !== "string" || !VALID_COMMAND_TYPES.has(type)) {
        throw new Error(`invalid command type: ${String(type)}`);
      }
      if (typeof missionId !== "string" || missionId.length === 0) {
        throw new Error("missionId is required");
      }
      if (typeof payload !== "object" || payload === null) {
        throw new Error("payload is required");
      }
      // JSON boundary: the structural shape is validated above; the runtime
      // enforces semantics (transitions, versions, reconciliation targets).
      return {
        command: {
          type,
          missionId,
          payload,
        } as unknown as BoundMissionCommand,
        idempotencyKey,
      };
    }

    function parseStoreFlag(args: string[]): {
      storePath: string;
      rest: string[];
    } {
      const rest: string[] = [];
      let storePath: string | undefined;
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--store") {
          const next = args[i + 1];
          if (next === undefined) {
            throw new Error("--store requires a file path");
          }
          storePath = next;
          i += 1;
        } else {
          rest.push(arg);
        }
      }
      return { storePath: storePath ?? DEFAULT_STORE_PATH, rest };
    }

    function loadStoreFile(filePath: string): MissionStoreFile {
      const raw = loadJson(filePath);
      if (typeof raw !== "object" || raw === null) {
        throw new Error(`${filePath} must be an object`);
      }
      const record = raw as Record<string, unknown>;
      const missions = record.missions;
      const events = record.events;
      const idempotency = record.idempotency;
      if (
        !Array.isArray(missions) ||
        !Array.isArray(events) ||
        !Array.isArray(idempotency)
      ) {
        throw new Error(
          `${filePath} must be { missions, events, idempotency } arrays`,
        );
      }
      return {
        missions: missions as MissionSnapshot[],
        events: events as MissionEvent[],
        idempotency: idempotency as IdempotencyRecord[],
      };
    }

    function emptyStoreFile(): MissionStoreFile {
      return { missions: [], events: [], idempotency: [] };
    }

    function isEnoent(error: unknown): boolean {
      return (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: unknown }).code === "ENOENT"
      );
    }

    function loadStoreFileOrEmpty(filePath: string): MissionStoreFile {
      try {
        return loadStoreFile(filePath);
      } catch (error) {
        if (isEnoent(error)) {
          return emptyStoreFile();
        }
        throw error;
      }
    }

    async function hydrateStores(
      stores: MissionRuntimeStores,
      file: MissionStoreFile,
    ): Promise<void> {
      for (const snapshot of file.missions) {
        await stores.missions.save(snapshot);
      }
      for (const event of file.events) {
        await stores.events.append(event);
      }
      for (const record of file.idempotency) {
        await stores.idempotency.put(record);
      }
    }

    async function persistStores(
      stores: MissionRuntimeStores,
      filePath: string,
    ): Promise<void> {
      const file: MissionStoreFile = {
        missions: await stores.missions.list(),
        events: stores.events.all(),
        idempotency: stores.idempotency.all(),
      };
      writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n", "utf-8");
    }

    function buildMissionStores(): MissionRuntimeStores {
      return {
        missions: new InMemoryMissionStore(),
        events: new InMemoryMissionEventStore(),
        idempotency: new InMemoryIdempotencyStore(),
      };
    }

    /** Next single legal status for the demo auto-advance intent handler. */
    function demoNextStatus(
      status: AccountingMissionStatus,
    ): AccountingMissionStatus | null {
      switch (status) {
        case AccountingMissionStatus.DRAFT:
          return AccountingMissionStatus.QUEUED;
        case AccountingMissionStatus.QUEUED:
          return AccountingMissionStatus.RUNNING;
        case AccountingMissionStatus.RUNNING:
          return AccountingMissionStatus.AWAITING_APPROVAL;
        case AccountingMissionStatus.APPROVED:
          return AccountingMissionStatus.COMPLETED;
        case AccountingMissionStatus.REVISION_REQUESTED:
          return AccountingMissionStatus.QUEUED;
        case AccountingMissionStatus.BLOCKED:
        case AccountingMissionStatus.WAITING_FOR_EVIDENCE:
        case AccountingMissionStatus.BLOCKED_BY_GATE:
        case AccountingMissionStatus.RETRYING:
        case AccountingMissionStatus.RECOVERING:
        case AccountingMissionStatus.UNKNOWN:
          return AccountingMissionStatus.RUNNING;
        case AccountingMissionStatus.REJECTED:
          return AccountingMissionStatus.REVISION_REQUESTED;
        case AccountingMissionStatus.AWAITING_APPROVAL:
        case AccountingMissionStatus.COMPLETED:
        case AccountingMissionStatus.FAILED:
          return null;
      }
    }

    /**
     * Registers the demo auto-advance intent handler for every intent so a
     * mission can be driven end-to-end from the shell without a real intent
     * pipeline (start -> execute/queue -> execute/run -> execute/await
     * approval -> approve).
     */
    function registerDemoIntentHandlers(registry: IntentRegistryImpl): void {
      const advance = async (
        mission: MissionSnapshot,
      ): Promise<MissionSnapshot | null> => {
        const next = demoNextStatus(mission.status);
        if (next === null) {
          return null;
        }
        return { ...mission, status: next };
      };
      for (const intent of VALID_MISSION_INTENTS) {
        registry.register({
          intent: intent as MissionSnapshot["intent"],
          execute: advance,
        });
      }
    }

    function buildMissionRuntime(stores: MissionRuntimeStores): MissionRuntime {
      const registry = new IntentRegistryImpl();
      registerDemoIntentHandlers(registry);
      return new MissionRuntime({
        store: stores.missions,
        events: stores.events,
        idempotency: stores.idempotency,
        registry,
      });
    }

    function businessErrorOutput(error: unknown): string {
      if (isMissionError(error)) {
        return JSON.stringify(
          {
            error: {
              code: error.code,
              message: error.message,
              statusCode: error.statusCode,
              details: error.details ?? undefined,
            },
          },
          null,
          2,
        );
      }
      if (error instanceof IdempotencyConflict) {
        return JSON.stringify(
          {
            error: {
              code: "IDEMPOTENCY_CONFLICT",
              message: error.message,
              statusCode: 409,
              details: { key: error.key },
            },
          },
          null,
          2,
        );
      }
      return JSON.stringify(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: errorMessage(error),
            statusCode: 500,
          },
        },
        null,
        2,
      );
    }

    async function missionStart(args: string[]): Promise<number> {
      let storePath: string;
      let rest: string[];
      try {
        ({ storePath, rest } = parseStoreFlag(args));
      } catch (error) {
        return usageError(`mission start: ${errorMessage(error)}`);
      }
      const createPath = rest[0];
      if (createPath === undefined || rest.length > 1) {
        return usageError(
          "usage: drenyra-ai mission start <create-command.json> [--store <file>]",
        );
      }
      try {
        const raw = loadJson(createPath);
        if (!isCreateMissionCommand(raw)) {
          return usageError(
            `${createPath} is not a valid create command (companyId, fiscalPeriod, intent, input.instruction)`,
          );
        }
        const stores = buildMissionStores();
        await hydrateStores(stores, loadStoreFileOrEmpty(storePath));
        const runtime = buildMissionRuntime(stores);
        const snapshot = await runtime.start(raw);
        await persistStores(stores, storePath);
        console.log(JSON.stringify(snapshot, null, 2));
        console.error(
          `mission start: ${snapshot.id} status=${snapshot.status} version=${snapshot.version}`,
        );
        return 0;
      } catch (error) {
        console.error(`mission start: IO/parse error: ${errorMessage(error)}`);
        return 2;
      }
    }

    async function missionApply(args: string[]): Promise<number> {
      let storePath: string;
      let rest: string[];
      try {
        ({ storePath, rest } = parseStoreFlag(args));
      } catch (error) {
        return usageError(`mission apply: ${errorMessage(error)}`);
      }
      const commandPath = rest[0];
      if (commandPath === undefined || rest.length > 1) {
        return usageError(
          "usage: drenyra-ai mission apply <command.json> [--store <file>]",
        );
      }
      try {
        let parsed: { command: BoundMissionCommand; idempotencyKey?: string };
        try {
          parsed = parseCommandFile(loadJson(commandPath));
        } catch (error) {
          return usageError(`mission apply: ${errorMessage(error)}`);
        }
        const stores = buildMissionStores();
        await hydrateStores(stores, loadStoreFileOrEmpty(storePath));
        const runtime = buildMissionRuntime(stores);
        const result = await runtime.apply(parsed.command, {
          idempotencyKey: parsed.idempotencyKey,
        });
        await persistStores(stores, storePath);
        console.log(
          JSON.stringify(
            {
              snapshot: result.snapshot,
              event: result.event,
              replayed: result.replayed ?? false,
            },
            null,
            2,
          ),
        );
        console.error(
          `mission apply: ${result.snapshot.id} status=${result.snapshot.status} version=${result.snapshot.version} replayed=${result.replayed ?? false}`,
        );
        return 0;
      } catch (error) {
        if (isMissionError(error) || error instanceof IdempotencyConflict) {
          console.log(businessErrorOutput(error));
          console.error(`mission apply: business error: ${errorMessage(error)}`);
          return 1;
        }
        console.error(`mission apply: IO/parse error: ${errorMessage(error)}`);
        return 2;
      }
    }

    async function missionStatus(args: string[]): Promise<number> {
      let storePath: string;
      let rest: string[];
      try {
        ({ storePath, rest } = parseStoreFlag(args));
      } catch (error) {
        return usageError(`mission status: ${errorMessage(error)}`);
      }
      const missionId = rest[0];
      if (missionId === undefined || rest.length > 1) {
        return usageError(
          "usage: drenyra-ai mission status <missionId> [--store <file>]",
        );
      }
      try {
        const stores = buildMissionStores();
        await hydrateStores(stores, loadStoreFileOrEmpty(storePath));
        const snapshot = await stores.missions.findById(missionId);
        if (snapshot === undefined) {
          console.log(
            JSON.stringify(
              {
                error: {
                  code: "MISSION_NOT_FOUND",
                  message: `Mission ${missionId} not found`,
                  statusCode: 404,
                },
              },
              null,
              2,
            ),
          );
          console.error(`mission status: mission ${missionId} not found`);
          return 1;
        }
        const events = await stores.events.list(missionId);
        console.log(JSON.stringify({ snapshot, events }, null, 2));
        console.error(
          `mission status: ${missionId} status=${snapshot.status} version=${snapshot.version} events=${events.length}`,
        );
        return 0;
      } catch (error) {
        console.error(`mission status: IO/parse error: ${errorMessage(error)}`);
        return 2;
      }
    }

        // ─── candidates ────────────────────────────────────────────────────────────
        //
        // Candidate identity + proportional review (contracts/candidate.md).
        // valueCents is parsed as BigInt from a decimal string — floats and
        // negatives are rejected. Fiscal convention: monetary values in the
        // Drenyra ecosystem are BigInt cents; no float is ever used for money;
        // exit codes are plain integers (0/1/2).

        const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
        const DECIMAL_CENTS_RE = /^\d+$/;
        const REVERSIBILITY_VALUES = new Set<Reversibility>([
          "reversible",
          "partially-reversible",
          "irreversible",
        ]);

        interface CandidateInspectFile {
          subjectB64: string;
          scope: { ruc: string; period: string };
          valueCents: string;
          reversibility: Reversibility;
          jurisdiction: string;
        }

        function isCandidateInspectFile(input: unknown): input is CandidateInspectFile {
          if (typeof input !== "object" || input === null) {
            return false;
          }
          const record = input as Record<string, unknown>;
          const scope = record.scope as Record<string, unknown> | undefined;
          return (
            typeof record.subjectB64 === "string" &&
            BASE64_RE.test(record.subjectB64) &&
            record.subjectB64.length % 4 === 0 &&
            scope !== undefined &&
            typeof scope.ruc === "string" &&
            typeof scope.period === "string" &&
            typeof record.valueCents === "string" &&
            DECIMAL_CENTS_RE.test(record.valueCents) &&
            typeof record.reversibility === "string" &&
            REVERSIBILITY_VALUES.has(record.reversibility as Reversibility) &&
            typeof record.jurisdiction === "string" &&
            record.jurisdiction.length > 0
          );
        }

        function candidateInspect(args: string[]): number {
          const candidatePath = args[0];
          if (candidatePath === undefined) {
            return usageError("usage: drenyra-ai candidate inspect <candidate.json>");
          }
          if (args.length > 1) {
            return usageError(`unknown option "${args[1]}"`);
          }
          try {
            const raw = loadJson(candidatePath);
            if (!isCandidateInspectFile(raw)) {
              return usageError(
                `${candidatePath} must be { subjectB64, scope: { ruc, period }, valueCents, reversibility, jurisdiction }`,
              );
            }
            const subject = Buffer.from(raw.subjectB64, "base64");
            const valueCents = BigInt(raw.valueCents);
            const lifecycle = new CandidateLifecycle();
            const candidate = lifecycle.propose({
              subject,
              scope: raw.scope,
              materialityInput: {
                value: valueCents,
                reversibility: raw.reversibility,
                jurisdiction: raw.jurisdiction,
              },
            });
            const recommendedLenses = selectReviewLenses({
              filePaths: [],
              changedLines: 1,
              isPreCommit: false,
              isPrePR: true,
              isPostSDDPhase: false,
            });
            const workload = forecastReviewWorkload({
              estimatedLines: 1,
              estimatedFiles: 1,
              affectedSubsystems: ["candidates"],
              isMechanicalRefactor: false,
              isFiscalChange: false,
              reviewerContext: "fresh",
            });
            const output = {
              id: candidate.id,
              subjectHash: candidate.subjectHash,
              scope: candidate.scope,
              materiality: candidate.materiality,
              status: candidate.status,
              recommendedLenses,
              workload,
            };
            console.log(JSON.stringify(output, null, 2));
            console.error(
              `candidate inspect: id=${candidate.id} materiality=${candidate.materiality} status=${candidate.status}`,
            );
            return 0;
          } catch (error) {
            if (isCandidateError(error)) {
              console.error(`candidate inspect: ${error.code}: ${error.message}`);
            } else {
              console.error(`candidate inspect: IO/parse error: ${errorMessage(error)}`);
            }
            return 2;
          }
        }

        function candidateVerify(args: string[]): number {
          let subjectPath: string | undefined;
          const rest: string[] = [];
          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === "--subject") {
              const next = args[i + 1];
              if (next === undefined) {
                return usageError("--subject requires a file path");
              }
              if (subjectPath !== undefined) {
                return usageError("--subject given more than once");
              }
              subjectPath = next;
              i += 1;
            } else {
              rest.push(arg);
            }
          }
          const candidatePath = rest[0];
          if (candidatePath === undefined || rest.length > 1 || subjectPath === undefined) {
            return usageError(
              "usage: drenyra-ai candidate verify <candidate.json> --subject <subject-file>",
            );
          }
          try {
            const raw = loadJson(candidatePath);
            if (typeof raw !== "object" || raw === null) {
              return usageError(`${candidatePath} must be an object with a subjectHash field`);
            }
            const expectedHash = (raw as Record<string, unknown>).subjectHash;
            if (typeof expectedHash !== "string" || expectedHash.length === 0) {
              return usageError(`${candidatePath} must contain a subjectHash string`);
            }
            const subjectBytes = readFileSync(subjectPath);
            const subjectHash = computeSubjectHash(subjectBytes);
            const valid = subjectHash === expectedHash;
            const output = { valid, subjectHash, expectedHash };
            console.log(JSON.stringify(output, null, 2));
            console.error(`candidate verify: valid=${valid}`);
            return valid ? 0 : 1;
          } catch (error) {
            console.error(`candidate verify: IO/parse error: ${errorMessage(error)}`);
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
          if (command === "mission" && subcommand === "start") {
            return missionStart(argv.slice(2));
          }
          if (command === "mission" && subcommand === "apply") {
            return missionApply(argv.slice(2));
          }
          if (command === "mission" && subcommand === "status") {
            return missionStatus(argv.slice(2));
          }
          if (command === "candidate" && subcommand === "inspect") {
            return candidateInspect(argv.slice(2));
          }
          if (command === "candidate" && subcommand === "verify") {
            return candidateVerify(argv.slice(2));
          }
          return usageError(
            `unknown command "${command ?? ""} ${subcommand ?? ""}"; expected "receipt verify", "ledger validate", "mission start|apply|status", or "candidate inspect|verify"`,
          );
        }

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
