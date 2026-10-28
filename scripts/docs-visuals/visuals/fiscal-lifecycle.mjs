import { band, canvas, card, footer, header, route, svgRoot } from "../kit.mjs";

const WIDTH = 1240;
const HEIGHT = 520;

const PHASES = [
	[
		"01 \u00b7 CAPTURE",
		"Capture",
		"Evidence enters inside one RUC scope.",
	],
	[
		"02 \u00b7 CLASSIFICATION",
		"Classification",
		"Candidates are proposed, never run.",
	],
	[
		"03 \u00b7 RECONCILIATION",
		"Reconciliation",
		"Entries are matched to the evidence.",
	],
	["04 \u00b7 CLOSE", "Close", "The period closes behind a gate."],
	["05 \u00b7 DECLARATION", "Declaration", "Staged for professional decision."],
	["06 \u00b7 AUDIT", "Audit", "Every step is backed by a receipt."],
];

const CARD_W = 292;
const CARD_X = [224, 554, 884];

/** Pilot feature diagram: the six-phase fiscal lifecycle with phase gates. */
export const fiscalLifecycle = {
	name: "fiscal-lifecycle",
	dir: "docs/assets/diagrams",
	render(p) {
		const base = canvas(p, { id: "life", width: WIDTH, height: HEIGHT });
		const parts = [
			base.body,
			header(p, {
				width: WIDTH,
				title: "Fiscal lifecycle \u2014 one order, every phase gated",
				subtitle:
					"From capture to audit, always inside a RUC and a period.",
				tag: "fiscal lifecycle",
			}),
			band(p, {
				y: 126,
				height: 150,
				width: 1160,
				index: "01",
				label: "PREPARE",
			}),
			band(p, {
				y: 300,
				height: 150,
				width: 1160,
				index: "02",
				label: "CONCLUDE",
			}),
		];
		PHASES.forEach(([eyebrow, title, caption], i) => {
			const row = i < 3 ? 0 : 1;
			const x = CARD_X[i % 3];
			const y = row === 0 ? 160 : 334;
			parts.push(
				card(p, {
					x,
					y,
					width: CARD_W,
					eyebrow,
					title,
					caption,
					tone: "main",
				}),
			);
			if (i % 3 < 2) {
				parts.push(
					route(
						p,
						[
							[x + CARD_W, y + 45],
							[x + CARD_W + 38, y + 45],
						],
						{ accent: "primary" },
					),
				);
			}
		});
		parts.push(
			route(
				p,
				[
					[CARD_X[2] + CARD_W / 2, 250],
					[CARD_X[2] + CARD_W / 2, 288],
					[CARD_X[0] + CARD_W / 2, 288],
					[CARD_X[0] + CARD_W / 2, 332],
				],
				{ accent: "primary" },
			),
			footer(p, {
				width: WIDTH,
				y: 480,
				motto:
					"Phase transitions pass a gate. No receipt, no mutation.",
			}),
		);
		return svgRoot({
			id: "life",
			width: WIDTH,
			height: HEIGHT,
			title: "The Drenyra fiscal lifecycle",
			desc: "The fiscal lifecycle runs in one fixed order: capture, classification and reconciliation prepare the work, then close, declaration and audit conclude it. Every phase transition passes a gate, work stays inside a RUC and period, and nothing material happens without a receipt.",
			defs: base.defs,
			body: `  ${parts.join("\n  ")}`,
		});
	},
};
