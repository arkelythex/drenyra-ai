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

/** Legacy system report normalizer (CONCAR, SISCONT, StarSoft). */
export const LEGACY_INGEST = make(
	"pe.legacy-ingest",
	"1.0.0",
	[
		"PCGE — Plan Contable General Empresarial (R. CNC 002-2019-EF/30)",
		"R.S. 234-2006/SUNAT — Formatos de Libros y Registros Vinculados a Asuntos Tributarios",
	],
	["source-format", "raw-payload", "scope"],
	["normalized-journal-entries", "parsing-diagnostics"],
	"R0",
);

/** Tax shield & causality validation against Art. 37/44 LIR. */
export const TAX_SHIELD = make(
	"pe.tax-shield",
	"1.0.0",
	[
		"TUO LIR — D.S. 179-2004-EF, Art. 37 (Principio de Causalidad)",
		"TUO LIR — D.S. 179-2004-EF, Art. 44 (Gastos No Deducibles)",
	],
	["journal-entry", "industry-context", "scope"],
	["causality-disposition", "reparo-tax-target", "normative-justification"],
	"R1",
);

/** SIRE adversarial reconciliation and action preparation. */
export const SIRE_ADVERSARIAL = make(
	"pe.sire-adversarial",
	"1.0.0",
	[
		"SUNAT SIRE — R.S. 112-2021/SUNAT y R.S. 040-2022/SUNAT",
		"TUO IGV — D.S. 055-99-EF, Arts. 18 y 19",
	],
	["sire-proposal", "ledger", "period"],
	["discrepancies", "proposed-actions", "adversarial-payload"],
	"R1",
);

/** ITF transactions monitoring and defense evidence compiling. */
export const ITF_JUSTIFICATION = make(
	"pe.itf-justification",
	"1.0.0",
	[
		"Ley 28194 — Ley para la Lucha contra la Evasión y para la Formalización de la Economía (ITF)",
		"TUO LIR — D.S. 179-2004-EF, Art. 52 (Incremento Patrimonial No Justificado)",
		"Código Tributario — D.S. 133-2013-EF, Art. 62 (Facultad de Fiscalización)",
	],
	["bank-statement", "itf-movements", "legal-contracts", "scope"],
	["justification-file", "unjustified-movements", "defense-evidence"],
	"R1",
);

/** Bancarization gate for mandatory banking payment compliance. */
export const BANCARIZACION_GATE = make(
	"pe.bancarizacion-gate",
	"1.0.0",
	[
		"Ley 28194 — Ley de Bancarización y D.L. 1529 (Uso de Medios de Pago)",
		"TUO LIR — D.S. 179-2004-EF, Art. 44 inc. j (Gastos sin medio de pago)",
		"TUO IGV — D.S. 055-99-EF, Art. 19 (Pérdida de Crédito Fiscal)",
	],
	["payment-entry", "payment-method", "amount", "scope"],
	["bancarizacion-verdict", "compliance-exception"],
	"R1",
);

/** Official SBS daily exchange rates and foreign currency revaluation. */
export const SBS_EXCHANGE_RATES = make(
	"pe.sbs-exchange-rates",
	"1.0.0",
	[
		"SBS — Tipos de Cambio Oficiales (Superintendencia de Banca, Seguros y AFP)",
		"TUO LIR — D.S. 179-2004-EF, Art. 61 (Tratamiento de Diferencia de Cambio)",
		"PCGE — Cuentas 676 y 776 (Diferencia de Cambio)",
		"NIC 21 — Efectos de las Variaciones en las Tasas de Cambio de la Moneda Extranjera",
	],
	["daily-sbs-rates", "foreign-currency-ledger", "scope"],
	["revalued-ledger-entries", "exchange-difference-drafts"],
	"R0",
);

/** Official SUNAT PLE flat-file export compiler. */
export const PLE_EXPORT = make(
	"pe.ple-export",
	"1.0.0",
	[
		"R.S. 286-2009/SUNAT — Sistema de Libros Electrónicos (PLE)",
		"R.S. 234-2006/SUNAT — Formatos de Libros y Registros Vinculados a Asuntos Tributarios",
		"R.S. 379-2013/SUNAT — Sujetos Obligados a Llevar Libros de Manera Electrónica",
	],
	["ledger", "book-type", "period", "scope"],
	["ple-txt-payload", "hash-validation-record", "export-diagnostics"],
	"R1",
);

/** Monthly social benefits and payroll provisions for PDT PLAME. */
export const PLAME_PROVISION = make(
	"pe.plame-provision",
	"1.0.0",
	[
		"D.S. 001-97-TR — TUO de la Ley de Compensación por Tiempo de Servicios (CTS)",
		"Ley 27735 y D.S. 005-2002-TR — Ley y Reglamento de Gratificaciones Legales",
		"D.L. 713 y D.S. 012-92-TR — Descansos Remunerados y Vacaciones",
		"Ley 26790 — Ley de Modernización de la Seguridad Social en Salud (EsSalud 9%)",
		"PCGE — Plan Contable General Empresarial (Cuentas 62 y 41)",
	],
	["payroll-contracts", "worked-period", "attendance-records", "scope"],
	["social-benefit-provisions", "pcge-payroll-entries", "plame-import-draft"],
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
	LEGACY_INGEST,
	TAX_SHIELD,
	SIRE_ADVERSARIAL,
	ITF_JUSTIFICATION,
	BANCARIZACION_GATE,
	SBS_EXCHANGE_RATES,
	PLE_EXPORT,
	PLAME_PROVISION,
];
