/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai mission apply <command.json> [--store <file>] [--demo]`
 *
 * Applies one mission command (execute/approve/reject/reconcile) with
 * idempotency replay and optimistic concurrency. Real deterministic intent
 * handlers for every frozen mission intent (see agents/) are registered by
 * default: execute commands stage work and pause at the evidence or approval
 * gate. The Core lifecycle, gates, and approval remain authoritative.
 * `--demo` is accepted for compatibility and has no effect.
 */
    
import {
  MissionRuntime,
  IdempotencyConflict,
  isMissionError,
  type BoundMissionCommand,
} from "../../missions/index.js";
import { createAgentRegistry } from "../../agents/index.js";
import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags } from "./mission-demo-handler.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import {
  businessErrorOutput,
  errorMessage,
  usageError,
} from "../output/errors.js";

const VALID_COMMAND_TYPES = new Set([
  "create",
  "execute",
  "approve",
  "reject",
  "reconcile",
]);

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

export async function missionApplyCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`mission apply: ${errorMessage(error)}`);
  }
  const commandPath = flags.rest[0];
  if (commandPath === undefined || flags.rest.length > 1) {
    return usageError(
      "usage: drenyra-ai mission apply <command.json> [--store <file>] [--demo]",
    );
  }
  try {
    let parsed: { command: BoundMissionCommand; idempotencyKey?: string };
    try {
      parsed = parseCommandFile(readJsonFile(commandPath));
    } catch (error) {
      return usageError(`mission apply: ${errorMessage(error)}`);
    }
    const fileStore = new MissionFileStore(flags.storePath);
    const stores = await fileStore.hydrate();
    // Real deterministic intent handlers cover every frozen mission intent:
    // execute commands stage work and pause at the evidence/approval gate.
    const registry = createAgentRegistry();
    const runtime = new MissionRuntime({
      store: stores.missions,
      events: stores.events,
      idempotency: stores.idempotency,
      registry,
    });
    const result = await runtime.apply(parsed.command, {
      idempotencyKey: parsed.idempotencyKey,
    });
    await fileStore.persist(stores);
    emitJson({
      snapshot: result.snapshot,
      event: result.event,
      replayed: result.replayed ?? false,
    });
    emitSummary(
      "mission apply",
      `${result.snapshot.id} status=${result.snapshot.status} version=${result.snapshot.version} replayed=${result.replayed ?? false}`,
    );
    return 0;
  } catch (error) {
    if (
      isMissionError(error) ||
      error instanceof IdempotencyConflict
    ) {
      console.log(businessErrorOutput(error));
      console.error(`mission apply: business error: ${errorMessage(error)}`);
      return 1;
    }
    console.error(`mission apply: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
