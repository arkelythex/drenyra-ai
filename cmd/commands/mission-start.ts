/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai mission start <create-command.json> [--store <file>] [--demo]`
 *
 * Thin executor over the in-memory stores; the JSON-file store adapter owns
 * all file I/O (hydrate/persist). The MissionRuntime itself never touches the
 * filesystem. `--demo` registers the demo auto-advance intent handler for THIS
 * invocation only; without it no intent handlers are registered.
 */

import { MissionRuntime, IntentRegistryImpl, type CreateMissionCommand } from "../../missions/index.js";
import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags, registerDemoIntentHandlers, VALID_MISSION_INTENTS } from "./mission-demo-handler.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

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

export async function missionStartCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`mission start: ${errorMessage(error)}`);
  }
  const createPath = flags.rest[0];
  if (createPath === undefined || flags.rest.length > 1) {
    return usageError(
      "usage: drenyra-ai mission start <create-command.json> [--store <file>] [--demo]",
    );
  }
  try {
    const raw = readJsonFile(createPath);
    if (!isCreateMissionCommand(raw)) {
      return usageError(
        `${createPath} is not a valid create command (companyId, fiscalPeriod, intent, input.instruction)`,
      );
    }
    const fileStore = new MissionFileStore(flags.storePath);
    const stores = await fileStore.hydrate();
    const registry = new IntentRegistryImpl();
    if (flags.demo) {
      registerDemoIntentHandlers(registry);
    }
    const runtime = new MissionRuntime({
      store: stores.missions,
      events: stores.events,
      idempotency: stores.idempotency,
      registry,
    });
    const snapshot = await runtime.start(raw);
    await fileStore.persist(stores);
    emitJson(snapshot);
    emitSummary(
      "mission start",
      `${snapshot.id} status=${snapshot.status} version=${snapshot.version}`,
    );
    return 0;
  } catch (error) {
    console.error(`mission start: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
