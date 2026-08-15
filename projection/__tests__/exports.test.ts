/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Export surface smoke tests (REQ-PROJ-013 / SC-PROJ-018). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AccountingMissionStatus } from "../../missions/status.js";
import { projectMission as rootProjectMission } from "../../index.js";
import type { MissionNextAction, MissionProjectionResult } from "../../index.js";
import * as projection from "../index.js";

const S = AccountingMissionStatus;

describe("T-PRJ-006 projection export surface", () => {
	it("exposes only projectMission plus public types; no guards or mutations", () => {
		expect(Object.keys(projection)).toEqual(["projectMission"]);
		expect(typeof projection.projectMission).toBe("function");
		const forbidden = ["transition", "validateTransition", "reconcileTransition", "guardTerminal", "emitReceipt", "replayMission", "runtime", "gate", "store", "NEXT_ACTIONS", "VALID_TRANSITIONS"];
		for (const name of forbidden) expect(Object.keys(projection)).not.toContain(name);
	});
	it("re-exports the same entry point and types from the root barrel", () => {
		expect(rootProjectMission).toBe(projection.projectMission);
		const result: MissionProjectionResult = projection.projectMission({ status: S.QUEUED });
		const action: MissionNextAction = "nextAction" in result ? result.nextAction : "none";
		expect(action).toBe("run");
	});
	it("declares the ./projection package export target", () => {
		const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { exports: Record<string, string> };
		expect(packageJson.exports["./projection"]).toBe("./dist/projection/index.js");
	});
});
