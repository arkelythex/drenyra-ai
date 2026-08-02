/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai mission recover [--store <file>]`
 *
 * Crash-safe resumption (contract: contracts/recovery.md): hydrates the JSON
 * store file, runs the runtime's default recovery policy
 * (recoverIncomplete — in-flight RUNNING missions are marked UNKNOWN, then
 * decided by evidence; human-wait and terminal states are never touched),
 * persists atomically, and prints the recovered missions.
 *
 * Exit 0 on success, 1 for business errors (JSON error object to stdout),
 * 2 for usage/IO/parse errors. Recovery is idempotent: a second run finds no
 * in-flight missions and persists no new events.
 */

import {
  MissionRuntime,
  isMissionError,
} from "../../missions/index.js";
import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags } from "./mission-demo-handler.js";
import { emitJson, emitSummary } from "../output/json.js";
import {
  businessErrorOutput,
  errorMessage,
  usageError,
} from "../output/errors.js";

export async function missionRecoverCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`mission recover: ${errorMessage(error)}`);
  }
  if (flags.demo) {
    return usageError("mission recover does not support --demo");
  }
  if (flags.rest.length > 0) {
    return usageError("usage: drenyra-ai mission recover [--store <file>]");
  }

  try {
    const fileStore = new MissionFileStore(flags.storePath);
    const stores = await fileStore.hydrate();
    const runtime = new MissionRuntime({
      store: stores.missions,
      events: stores.events,
      idempotency: stores.idempotency,
    });
    const recovered = await runtime.recoverIncomplete();
    await fileStore.persist(stores);

    emitJson({ recovered });
    emitSummary(
      "mission recover",
      `recovered ${recovered.length} mission(s): ${recovered
        .map((mission) => `${mission.id} ${mission.status} v${mission.version}`)
        .join(", ") || "none"}`,
    );
    return 0;
  } catch (error) {
    if (isMissionError(error)) {
      emitJson(JSON.parse(businessErrorOutput(error)));
      emitSummary("mission recover", `business error: ${error.code}`);
      return 1;
    }
    console.error(`mission recover: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
