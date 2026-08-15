/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai project <missionId> [--store <file>]`
 *
 * Read-only projection dump. Loads a persisted mission snapshot from the store,
 * computes the projection with the existing projectMission library, and emits
 * `{ missionId, projection }` as JSON. Never mutates, never runs gates, never
 * emits receipts. The projection is emitted exactly as the library returns it;
 * this command is a transport adapter, never a second projector. This CLI slice
 * does not add a requested-continuation flag.
 * Exit 0 success, 1 mission not found, 2 usage/IO.
 */

import { MissionFileStore } from "../adapters/file-mission-store.js";
import { parseMissionFlags } from "./mission-demo-handler.js";
import { emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";
import { projectMission } from "../../projection/index.js";

export async function projectCommand(args: string[]): Promise<number> {
  let flags: ReturnType<typeof parseMissionFlags>;
  try {
    flags = parseMissionFlags(args);
  } catch (error) {
    return usageError(`project: ${errorMessage(error)}`);
  }
  if (flags.demo) {
    return usageError("project does not support --demo");
  }
  if (flags.rest.some((arg) => arg.startsWith("-"))) {
    return usageError("project: unsupported flag");
  }
  const missionId = flags.rest[0];
  if (missionId === undefined || flags.rest.length !== 1) {
    return usageError("usage: drenyra-ai project <missionId> [--store <file>]");
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
      emitSummary("project", `mission ${missionId} not found`);
      return 1;
    }
    const projection = projectMission({ status: snapshot.status });
    emitJson({ missionId, projection });
    emitSummary("project", `${missionId} status=${snapshot.status}`);
    return 0;
  } catch (error) {
    console.error(`project: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
