/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Base Peruvian skills — Design 03 "Drenyra Skills" (Peru layer), versioned by
 * validity period. These are the auditable base policies shipped with the
 * runtime; the registry (registry.ts) validates and resolves them.
 */

import { computeSkillChecksum } from "./registry.js";
import type { SkillDefinition } from "./types.js";

function make(
	id: string,
	version: string,
	normativeSources: readonly string[],
	inputs: readonly string[],
	outputs: readonly string[],
	maxAutonomy: SkillDefinition["maxAutonomy"],
): SkillDefinition {
	const skill: SkillDefinition = {
		id,
		version,
		jurisdiction: "PE",
		validity: { from: "2026-01-01" },
		normativeSources,
		inputs,
		outputs,
		requiredPermissions: ["evidence:read"],
		maxAutonomy,
		contractCompatibility: ["candidate@0.1", "receipt@0.1", "gate@0.1"],
		retirementPolicy: "superseded-by-next-major",
		checksum: "",
	};
	skill.checksum = computeSkillChecksum(skill);
	return skill;
}

/** IGV validation against the TUO (D.S. 055-99-EF). */
export const IGV_VALIDATE = make(
	"pe.igv-validate",
	"1.0.0",
	["TUO IGV — D.S. 055-99-EF"],
	["invoice", "tax-period"],
	["igv-validation"],
	"R1",
);

/** SIRE proposal comparison (R.S. 085-2020/SUNAT). */
export const SIRE_COMPARE = make(
	"pe.sire-compare",
	"1.0.0",
	["SUNAT SIRE — R.S. 085-2020/SUNAT"],
	["sire-proposal", "ledger"],
	["exceptions", "candidates"],
	"R1",
);

/** Detraction check (D.S. 155-98-EF). */
export const DETRACTION_CHECK = make(
	"pe.detraction-check",
	"1.0.0",
	["D.S. 155-98-EF (detracciones)"],
	["operation", "period"],
	["detraction-validation"],
	"R1",
);

/** Withholding validation (D.S. 56-97-EF — retenciones del IGV). */
export const RETENTION_CHECK = make(
	"pe.retention-check",
	"1.0.0",
	["D.S. 56-97-EF (retenciones del IGV)"],
	["operation", "supplier", "period"],
	["retention-validation"],
	"R1",
);

/** Perception validation (D.S. 122-94-EF — percepciones del IGV). */
export const PERCEPTION_CHECK = make(
	"pe.perception-check",
	"1.0.0",
	["D.S. 122-94-EF (percepciones del IGV)"],
	["operation", "customer", "period"],
	["perception-validation"],
	"R1",
);

/** SIRE filing readiness (R.S. 085-2020/SUNAT). */
export const SIRE_FILING = make(
	"pe.sire-filing",
	"1.0.0",
	["SUNAT SIRE — R.S. 085-2020/SUNAT"],
	["sire-proposal", "ledger", "period"],
	["filing-readiness", "exceptions"],
	"R2",
);

/**
 * Bank-statement vs ledger reconciliation (PCGE cash accounts; NIC 1
 * financial statement structure; Código Tributario registration duty).
 * Deterministic engine core; adapters/missions/gates are separate slices.
 */
export const CONCILIACION_BANCARIA = make(
	"pe.conciliacion-bancaria",
	"1.0.0",
	[
		"PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)",
		"NIC 1 — Presentación de Estados Financieros",
		"Código Tributario — D.S. 133-2013-EF",
	],
	["bank-statement", "ledger", "scope"],
	["differences", "adjustments", "reconciliation-report"],
	"R1",
);

/** Fixed-asset depreciation per LIR (D.S. 179-2004-EF) and PCGE. */
export const DEPRECIACION_ACTIVO_FIJO = make(
	"pe.depreciacion-activo-fijo",
	"1.0.0",
	[
		"PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)",
		"LIR — Ley del Impuesto a la Renta (D.S. 179-2004-EF)",
	],
	["fixed-asset", "policy", "scope"],
	["depreciation-entries"],
	"R1",
);

/** Provisions for past-due receivables and inventory per LIR + Código Tributario. */
export const PROVISION_CARTERA = make(
	"pe.provision-cartera",
	"1.0.0",
	[
		"PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)",
		"LIR — Ley del Impuesto a la Renta (D.S. 179-2004-EF)",
		"Código Tributario — D.S. 133-2013-EF",
	],
	["receivables", "inventory", "policy", "scope"],
	["provision-entries"],
	"R1",
);

/** Provisional ISR (pago a cuenta) per LIR Art. 85. */
export const ISR_MENSUAL = make(
	"pe.isr-mensual",
	"1.0.0",
	["LIR — Ley del Impuesto a la Renta (D.S. 179-2004-EF), Art. 85"],
	["net-income", "prior-year-ratio", "scope"],
	["isr-entry", "cedula"],
	"R1",
);

/** Closing of result accounts to retained earnings (PCGE 59) per PCGE + NIC 1. */
export const CIERRE_RESULTADOS = make(
	"pe.cierre-resultados",
	"1.0.0",
	[
		"PCGE — Plan Contable General Empresarial (R. SMV 043-2010-SMV/01)",
		"NIC 1 — Presentación de Estados Financieros",
	],
	["result-balances", "chart", "scope"],
	["closing-entries"],
	"R1",
);

/** All base Peruvian skills, ready to register. */
export const BASE_PE_SKILLS: readonly SkillDefinition[] = [
	IGV_VALIDATE,
	SIRE_COMPARE,
	DETRACTION_CHECK,
	RETENTION_CHECK,
	PERCEPTION_CHECK,
	SIRE_FILING,
	CONCILIACION_BANCARIA,
	DEPRECIACION_ACTIVO_FIJO,
	PROVISION_CARTERA,
	ISR_MENSUAL,
	CIERRE_RESULTADOS,
];
