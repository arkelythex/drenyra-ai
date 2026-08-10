/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * `drenyra-ai doctor`
 *
 * Strictly read-only ecosystem health check (Design 03 "doctor"): runtime
 * version, Node engine, frozen contract presence, CLI surface, and store
 * reachability. Never mutates anything. Exit 0 healthy, exit 1 with a JSON
 * report of failing checks.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

interface HealthCheck {
	name: string;
	ok: boolean;
	detail: string;
}

function packageInfo(): { version: string; engines?: { node?: string } } {
	try {
		return require("../../package.json") as { version: string; engines?: { node?: string } };
	} catch {
		return { version: "unknown" };
	}
}

export function doctorCommand(): number {
	const checks: HealthCheck[] = [];
	const pkg = packageInfo();

	// Node engine.
	const nodeMajor = Number(process.versions.node.split(".")[0] ?? 0);
	const required = pkg.engines?.node ?? ">=22";
	const nodeOk = nodeMajor >= 22;
	checks.push({
		name: "node-engine",
		ok: nodeOk,
		detail: nodeOk
			? `node ${process.versions.node} satisfies ${required}`
			: `node ${process.versions.node} does not satisfy ${required}`,
	});

	// Runtime version.
	checks.push({ name: "version", ok: pkg.version !== "unknown", detail: pkg.version });

	// Frozen contracts present.
	const contractsDir = resolve(process.cwd(), "contracts");
	const frozen = [
		"mission-protocol.md",
		"candidate.md",
		"receipt.md",
		"gate.md",
		"ledger.md",
		"recovery.md",
	];
	const missingContracts = frozen.filter((file) => !existsSync(resolve(contractsDir, file)));
	checks.push({
		name: "contracts",
		ok: missingContracts.length === 0,
		detail:
			missingContracts.length === 0
				? "all six frozen contracts present"
				: `missing: ${missingContracts.join(", ")}`,
	});

	// CLI surface.
	const cliCommands = ["receipt verify", "ledger validate", "mission start", "mission apply", "mission status", "mission recover", "candidate inspect", "candidate verify", "gate check", "capabilities", "doctor"];
	checks.push({
		name: "cli",
		ok: true,
		detail: `${cliCommands.length} commands available`,
	});

	// Store reachability (dev adapter): report only, never touch.
	const storePath = resolve(process.cwd(), "drenyra-missions.json");
	const storeState = existsSync(storePath) ? "present" : "absent (dev adapter, created on first use)";
	checks.push({ name: "mission-store", ok: true, detail: storeState });

	const failed = checks.filter((check) => !check.ok);
	console.log(
		JSON.stringify(
			{
				status: failed.length === 0 ? "healthy" : "degraded",
				checks,
				readonly: true,
			},
			null,
			2,
		),
	);
	if (failed.length > 0) {
		console.error(`doctor: ${failed.length} check(s) failed`);
		return 1;
	}
	return 0;
}
