import { band, canvas, card, footer, header, svgRoot } from "../kit.mjs";

// These are concept illustrations, not replacement state-transition maps.
// Normative prose in contracts/ remains authoritative.
const concepts = [
	{
		name: "rda-proof",
		title: "RDA — a proposal is not proof",
		subtitle: "Bind the work to exact bytes, explicit decisions, and signed evidence.",
		tag: "receipt-driven accounting",
		motto: "Agents propose. Professionals decide. Evidence remains.",
		rows: [
			["01", "PROPOSE", "primary", [
				["AGENT", "Stage the work", "A proposal never claims ERP, bank, or SUNAT execution."],
				["CANDIDATE", "Identify the exact subject", "Content-derived identity binds the reviewed bytes and scope."],
			]],
			["02", "CONTROL", "human", [
				["MATERIALITY", "Derive the review depth", "BigInt cents, reversibility, and jurisdiction determine R0–R3."],
				["AUTHORITY", "Check the required approval", "R2 needs one approver; R3 needs two distinct approvers."],
			]],
			["03", "PROVE", "success", [
				["RECEIPT", "Verify the signed result", "Hash, Ed25519 signature, and trusted signer must agree."],
				["AUDIT LEDGER", "Keep the evidence chain", "Append-only records expose the first integrity divergence."],
			]],
		],
	},
	{
		name: "materiality-review",
		title: "Review — proportional, never optional by claim",
		subtitle: "The tier comes from the candidate, not the confidence of the agent.",
		tag: "deterministic materiality",
		motto: "One scoped correction per candidate. Different bytes require re-inspection.",
		rows: [
			["01", "DERIVE", "primary", [
				["INPUT", "Value, reversibility, jurisdiction", "Money is BigInt cents; policy rules run in a fixed order."],
				["FAIL CLOSED", "Unknown jurisdiction escalates", "Increase one tier; R3 remains the ceiling."],
			]],
			["02", "REVIEW", "info", [
				["R0 · NON-MATERIAL", "Controlled autonomy", "Read-only queries and non-material drafts."],
				["R1 · WITHIN LIMITS", "Focused review", "Standard entries remain subject to the applicable gates."],
			]],
			["03", "APPROVE", "human", [
				["R2 · MATERIAL", "One explicit approval", "Review and approval are recorded, never inferred."],
				["R3 · CRITICAL", "Two distinct approvers", "Irreversible operations require explicit dual approval."],
			]],
		],
	},
	{
		name: "mission-recovery",
		title: "Recovery — resume from evidence, not a story",
		subtitle: "A restart cannot turn an interrupted operation into an assumed success.",
		tag: "persisted event log",
		motto: "Re-running recovery is idempotent. Human-wait states stay paused.",
		rows: [
			["01", "REPLAY", "primary", [
				["SOURCE OF TRUTH", "Read the last persisted event", "Snapshots in event order reconstruct the mission state."],
				["NOT AUTHORITY", "Ignore the agent transcript", "Narration and process memory do not prove external effects."],
			]],
			["02", "RESOLVE", "info", [
				["IN FLIGHT", "Mark uncertainty explicitly", "The recovery contract maps RUNNING / RETRYING to UNKNOWN."],
				["UNKNOWN", "Decide by persisted evidence", "The CLI sweep and evidence reconciliation are separate steps."],
			]],
			["03", "PRESERVE", "human", [
				["HUMAN WAIT", "Do not bypass a pending gate", "Evidence and approval waits require their own resolution."],
				["TERMINAL", "Leave completed work alone", "COMPLETED and FAILED are not recovered again."],
			]],
		],
	},
	{
		name: "authority-boundary",
		title: "Authority — context is not permission",
		subtitle: "Keep advice, deterministic enforcement, and professional decisions separate.",
		tag: "RUC · company · period",
		motto: "An audit ledger is execution proof, not the accounting journal of record.",
		rows: [
			["01", "INFORM", "info", [
				["AGENTS + SKILLS", "Propose and stage", "Domain knowledge guides work; it cannot approve itself."],
				["ENGRAM", "Remember the context", "Institutional memory informs; it never authorizes."],
			]],
			["02", "ENFORCE", "primary", [
				["TENANT BOUNDARY", "Carry the exact scope", "RUC, company, and fiscal period isolate every operation."],
				["DETERMINISTIC CORE", "Validate policy and evidence", "Gates fail closed when required authority is missing."],
			]],
			["03", "DECIDE", "human", [
				["PROFESSIONAL", "Retain fiscal authority", "Business and legal judgment stays with the human."],
				["EXTERNAL SYSTEMS", "Require external evidence", "ERP, bank, and SUNAT effects are not proved by a narrative."],
			]],
		],
	},
];

export const features = concepts.map((concept) => ({
	name: concept.name,
	dir: "docs/assets/diagrams",
	render(p) {
		const width = 1240;
		const height = 680;
		const base = canvas(p, { id: concept.name, width, height });
		const parts = [base.body, header(p, { width, ...concept, tagWidth: 230 })];
		concept.rows.forEach(([index, label, accent, cards], row) => {
			const y = 126 + row * 166;
			parts.push(band(p, { y, width: 1160, height: 146, index, label }));
			cards.forEach(([eyebrow, title, caption], column) => {
				parts.push(card(p, {
					x: 224 + column * 476, y: y + 26, width: 452,
					eyebrow, title, caption, accent, tone: "main",
				}));
			});
		});
		parts.push(footer(p, { width, y: 638, motto: concept.motto }));
		return svgRoot({
			id: concept.name, width, height, title: concept.title,
			desc: `${concept.subtitle} ${concept.rows.flatMap((row) => row[3].map((c) => `${c[1]}. ${c[2]}`)).join(" ")}`,
			defs: base.defs, body: parts.join("\n"),
		});
	},
}));
