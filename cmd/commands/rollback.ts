/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai rollback run [--home <dir>]` — restore the immediately previous
 * recorded managed composition (SDD-020 first slice).
 *
 * Thin adapter: resolves `--home` via the shared rule, delegates the
 * deterministic one-step restore to configurator/managed-config.ts, renders
 * the deterministic JSON report, and maps failures (business → exit 1, usage →
 * exit 2, IO → exit 2 after the library restores prior state). No business
 * rules live here.
 */

import { businessErrorOutput, errorMessage } from "../output/errors.js";
import {
	ManagedConfigError,
	commitTransition,
	homeFromArgs,
	planRollback,
	type TransitionHooks,
} from "../../configurator/managed-config.js";

export interface RollbackDeps {
	hooks?: TransitionHooks;
}

/** `rollback run [--home <dir>]` — exit 0/1/2, JSON to stdout. */
export function rollbackCommand(
	args: string[] = [],
	deps: RollbackDeps = {},
): number {
	const home = homeFromArgs(args);
	try {
		const plan = planRollback(home);
		if (plan.status === "unchanged") {
			console.log(
				JSON.stringify(
					{ status: "unchanged", from: plan.from, to: plan.to, results: [] },
					null,
					2,
				),
			);
			return 0;
		}
		commitTransition(home, plan, deps.hooks);
		console.log(
			JSON.stringify(
				{
					status: "rolled-back",
					from: plan.from,
					to: plan.to,
					results: plan.results,
				},
				null,
				2,
			),
		);
		return 0;
	} catch (error) {
		if (error instanceof ManagedConfigError) {
			console.log(businessErrorOutput(error));
			console.error(`rollback: business error: ${errorMessage(error)}`);
			return 1;
		}
		console.error(`rollback: IO error: ${errorMessage(error)}`);
		return 2;
	}
}
