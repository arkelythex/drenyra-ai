/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai upgrade run <version> [--home <dir>]` — transition the recorded
 * package-level managed composition to a packaged version (SDD-020 first slice).
 *
 * Thin adapter: resolves `<version>` and `--home` via the shared rule, injects
 * the packaged version from package metadata, delegates the deterministic
 * transition to configurator/managed-config.ts, renders the deterministic JSON
 * report, and maps failures (business → exit 1, usage → exit 2, IO → exit 2
 * after the library restores prior state). No business rules live here.
 */

import { getPackageMetadata } from "../adapters/package-metadata.js";
import { businessErrorOutput, errorMessage, usageError } from "../output/errors.js";
import {
	ManagedConfigError,
	commitTransition,
	homeFromArgs,
	planUpgrade,
	type TransitionHooks,
	type TransitionNow,
} from "../../configurator/managed-config.js";

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export interface UpgradeDeps {
	packagedVersion?: string;
	now?: TransitionNow;
	hooks?: TransitionHooks;
}

/** `upgrade run <version> [--home <dir>]` — exit 0/1/2, JSON to stdout. */
export function upgradeCommand(
	args: string[] = [],
	deps: UpgradeDeps = {},
): number {
	const version = args[0];
	if (version === undefined || !SEMVER_RE.test(version)) {
		return usageError("usage: drenyra-ai upgrade run <version> [--home <dir>]");
	}
	const home = homeFromArgs(args);
	const packagedVersion = deps.packagedVersion ?? getPackageMetadata().version;
	const now = deps.now ?? (() => new Date().toISOString());
	try {
		const plan = planUpgrade(home, version, packagedVersion, now);
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
					status: "upgraded",
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
			console.error(`upgrade: business error: ${errorMessage(error)}`);
			return 1;
		}
		console.error(`upgrade: IO error: ${errorMessage(error)}`);
		return 2;
	}
}
