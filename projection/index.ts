/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Projection-only public barrel: types + projectMission. No guard, gate,
 * mutation, receipt, store, or private map is exported. */
export { projectMission } from "./project-mission.js";
export type {
	MissionNextAction, MissionProjection, MissionProjectionBlockingCondition,
	MissionProjectionContinuation, MissionProjectionDenial, MissionProjectionDenialCode,
	MissionProjectionDenialCause, MissionProjectionRequest, MissionProjectionResult,
	MissionProjectionSnapshot, UnsupportedMissionProjection,
} from "./types.js";
