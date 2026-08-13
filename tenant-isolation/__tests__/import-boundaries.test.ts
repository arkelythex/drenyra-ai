/**
 * Static import-boundary guard for the fiscal-authority program chain.
 *
 * Scans every non-test TypeScript file under the declared module directories
 * and fails on any forbidden edge: a relative import whose resolved top-level
 * target is not in that module's approved-dependency allowlist. Each module may
 * import only its own subtree plus the explicitly approved dependencies
 * (`receipts/` and `tenant-core/` for the evidence layer); any other target —
 * especially high-level layers (`agents/`, `cmd/`, `ingest/`, `ledger/`,
 * `missions/`, `candidates/`, `gates/`, ...) — is rejected fail-closed.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

/** Top-level dirs owned by the fiscal-authority program chain (additive). */
const MODULE_DIRS = ["tenant-core", "tenant-isolation", "evidence", "journal", "fiscal", "policy"] as const;

/**
 * Approved relative-import targets per module dir (top-level dir names under the
 * repo root). Every entry includes the module's own subtree; sibling program
 * modules are added only when that edge is sanctioned by the design. High-level
 * layers are absent from every list and therefore always rejected.
 */
const APPROVED_TARGETS: Readonly<Record<string, readonly string[]>> = {
	"tenant-core": ["tenant-core"],
	"tenant-isolation": ["tenant-core", "tenant-isolation"],
	evidence: ["evidence", "tenant-core", "receipts"],
	journal: ["journal", "tenant-core", "evidence", "receipts"],
	fiscal: ["fiscal", "tenant-core", "evidence", "journal", "candidates"],
	policy: ["policy", "candidates", "evidence", "journal"],
} as const;

const RELATIVE_IMPORT =
	/\bfrom\s+["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;

function collectSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "__tests__" || entry.name === "node_modules") continue;
			out.push(...collectSourceFiles(full));
		} else if (entry.name.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function relativeImports(source: string): string[] {
	const imports: string[] = [];
	for (const match of source.matchAll(RELATIVE_IMPORT)) {
		const specifier = match[1] ?? match[2];
		if (specifier !== undefined) imports.push(specifier);
	}
	return imports;
}

/** Top-level repo-root directory a relative specifier resolves into. */
function importTarget(filePath: string, specifier: string): string {
	const resolved = resolve(dirname(filePath), specifier);
	const rel = relative(repoRoot, resolved);
	if (rel === "" || rel.startsWith("..")) return "<outside>";
	return rel.split(sep)[0];
}

/**
 * Pure boundary check: returns the violation strings for one source file under
 * one module dir. Used by the per-module scan and by the synthetic
 * violation-detection triangulation cases below.
 */
function moduleBoundaryViolations(
	filePath: string,
	source: string,
	moduleDir: string,
): string[] {
	const approved = APPROVED_TARGETS[moduleDir];
	if (approved === undefined) {
		throw new Error(`no approved targets declared for module dir "${moduleDir}"`);
	}
	const violations: string[] = [];
	const relFile = relative(repoRoot, filePath);
	for (const specifier of relativeImports(source)) {
		const target = importTarget(filePath, specifier);
		if (!approved.includes(target)) {
			violations.push(
				`${relFile} imports "${specifier}" (${target}/), which is outside ${moduleDir}'s approved dependencies`,
			);
		}
	}
	return violations;
}

describe("fiscal-authority import boundaries", () => {
	for (const mod of MODULE_DIRS) {
		it(`${mod}/ imports only its approved dependencies and never a high-level layer`, () => {
			const moduleDir = resolve(repoRoot, mod);
			const files = collectSourceFiles(moduleDir);
			expect(files.length).toBeGreaterThan(0);

			const violations: string[] = [];
			for (const file of files) {
				violations.push(
					...moduleBoundaryViolations(file, readFileSync(file, "utf8"), mod),
				);
			}
			expect(violations).toEqual([]);
		});
	}

	describe("violation detection (TRIANGULATE)", () => {
		it("rejects forbidden high-level layer imports from the evidence layer", () => {
			const evidenceFile = join(repoRoot, "evidence/authority/authority.ts");
			for (const layer of ["agents", "cmd", "ingest"]) {
				const violations = moduleBoundaryViolations(
					evidenceFile,
				`import { x } from "../../${layer}/index.js";`,
				"evidence",
			);
				expect(violations).toEqual([
					`evidence/authority/authority.ts imports "../../${layer}/index.js" (${layer}/), which is outside evidence's approved dependencies`,
				]);
			}
		});
		it("rejects an unapproved sibling and allows the approved dependencies", () => {
			expect(
				moduleBoundaryViolations(
					join(repoRoot, "tenant-isolation/read.ts"),
					'import { acceptEvidence } from "../evidence/index.js";',
					"tenant-isolation",
				).length,
			).toBe(1);
			expect(
				moduleBoundaryViolations(
					join(repoRoot, "evidence/accept.ts"),
					[
						'import { computeEvidenceHash } from "../receipts/index.js";',
						'import { validateTenantScope } from "../tenant-core/index.js";',
						'import { registerEvidence } from "./authority/index.js";',
					].join("\n"),
					"evidence",
				),
    			).toEqual([]);
    		});
    		it("rejects the audit ledger and high-level layers from the journal layer", () => {
    			const journalFile = join(repoRoot, "journal/journal.ts");
    			for (const layer of ["ledger", "missions", "candidates", "agents", "cmd", "ingest"]) {
    				const violations = moduleBoundaryViolations(
    					journalFile,
    					`import { x } from "../${layer}/index.js";`,
    					"journal",
    				);
    				expect(violations).toEqual([
    					`journal/journal.ts imports "../${layer}/index.js" (${layer}/), which is outside journal's approved dependencies`,
    				]);
    			}
    		});
    		it("allows journal's approved dependencies and rejects an unapproved sibling", () => {
    			expect(
    				moduleBoundaryViolations(
    					join(repoRoot, "journal/index.ts"),
    					[
    						'import { record } from "./journal.js";',
    						'import { validateTenantScope } from "../tenant-core/index.js";',
    						'import { acceptEvidence } from "../evidence/index.js";',
    						'import { computeEvidenceHash } from "../receipts/index.js";',
    					].join("\n"),
    					"journal",
    				),
    			).toEqual([]);
    			expect(
    				moduleBoundaryViolations(
    					join(repoRoot, "journal/index.ts"),
    					'import { validateLedger } from "../ledger/index.js";',
    					"journal",
    				).length,
    			).toBe(1);
    		});
    		it("rejects the audit ledger and high-level layers from the fiscal layer", () => {
    			const fiscalFile = join(repoRoot, "fiscal/candidate-ordering.ts");
    			for (const layer of ["ledger", "missions", "gates", "agents", "cmd", "ingest"]) {
    	    	    	    	const violations = moduleBoundaryViolations(
    	    	    	    	    	fiscalFile,
    	    	    	    	    	`import { x } from "../${layer}/index.js";`,
    	    	    	    	    	"fiscal",
    	    	    	    	);
    	    	    	    	expect(violations).toEqual([
    	    	    	    	    	`fiscal/candidate-ordering.ts imports "../${layer}/index.js" (${layer}/), which is outside fiscal's approved dependencies`,
    	    	    	    	]);
    			}
    		});
    		it("allows fiscal's approved dependencies and rejects an unapproved sibling", () => {
    			expect(
    	    	    	    	moduleBoundaryViolations(
    	    	    	    	    	join(repoRoot, "fiscal/index.ts"),
    	    	    	    	    	[
    	    	    	    	    	    	'export * from "./types.js";',
    	    	    	    	    	    	'import { validateTenantScope } from "../tenant-core/index.js";',
    	    	    	    	    	    	'import { acceptEvidence } from "../evidence/index.js";',
    	    	    	    	    	    	'import { CandidateLifecycle } from "../candidates/index.js";',
    	    	    	    	    	].join("\n"),
    	    	    	    	    	"fiscal",
    	    	    	    	),
    			).toEqual([]);
    			expect(
    	    	    	    	moduleBoundaryViolations(
    	    	    	    	    	join(repoRoot, "fiscal/index.ts"),
    	    	    	    	    	'import { validateLedger } from "../ledger/index.js";',
    	    	    	    	    	"fiscal",
    	    	    	    	).length,
    			).toBe(1);
    		});
    		it("rejects the audit ledger and high-level layers from the policy layer", () => {
    			const policyFile = join(repoRoot, "policy/pe-policy.ts");
    			for (const layer of ["ledger", "missions", "gates", "agents", "cmd", "ingest"]) {
    	    	    	    	const violations = moduleBoundaryViolations(
    	    	    	    	    	policyFile,
    	    	    	    	    	`import { x } from "../${layer}/index.js";`,
    	    	    	    	    	"policy",
    	    	    	    	);
    	    	    	    	expect(violations).toEqual([
    	    	    	    	    	`policy/pe-policy.ts imports "../${layer}/index.js" (${layer}/), which is outside policy's approved dependencies`,
    	    	    	    	]);
    			}
    		});
    		it("allows only policy's approved dependencies", () => {
    			expect(
    	    	    	    	moduleBoundaryViolations(
    	    	    	    	    	join(repoRoot, "policy/index.ts"),
    	    	    	    	    	[
    	    	    	    	    	    	'export * from "./types.js";',
    	    	    	    	    	    	'import { HIGH_VALUE_CENTS } from "../candidates/materiality.js";',
    	    	    	    	    	    	'import { acceptEvidence } from "../evidence/index.js";',
    	    	    	    	    	    	'import { record } from "../journal/index.js";',
    	    	    	    	    	].join("\n"),
    	    	    	    	    	"policy",
    	    	    	    	),
    			).toEqual([]);
    		});
    	});
});
