/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai mission status <missionId> [--store <file>]`
 *
 * Reads the mission snapshot and its full event log from the store file.
 * Exit 0 on success, 1 when the mission is not found (JSON error object to
 * stdout), 2 for usage/IO errors.
 */

import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags } from "./mission-demo-handler.js";
import { emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

export async function missionStatusCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`mission status: ${errorMessage(error)}`);
  }
  if (flags.demo) {
    return usageError("mission status does not support --demo");
  }
  const missionId = flags.rest[0];
  if (missionId === undefined || flags.rest.length > 1) {
    return usageError(
      "usage: drenyra-ai mission status <missionId> [--store <file>]",
    );
  }
  try {
    const fileStore = new MissionFileStore(flags.storePath);
    const stores = await fileStore.hydrate();
    const snapshot = await stores.missions.findById(missionId);
    if (snapshot === undefined) {
      emitJson({
        error: {
          code: "MISSION_NOT_FOUND",
          message: `Mission ${missionId} not found`,
          statusCode: 404,
        },
      });
      emitSummary("mission status", `mission ${missionId} not found`);
      return 1;
    }
    const events = await stores.events.list(missionId);
    emitJson({ snapshot, events });
    emitSummary(
      "mission status",
      `${missionId} status=${snapshot.status} version=${snapshot.version} events=${events.length}`,
    );
    return 0;
  } catch (error) {
    console.error(`mission status: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
