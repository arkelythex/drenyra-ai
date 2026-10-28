import { MONO, canvas, checkPath, esc, svgRoot, text, ticks } from "../kit.mjs";

const WIDTH = 1400;
const HEIGHT = 460;

/** Thesis clauses, each in its own semantic accent. */
const THESIS = [
	["AI proposes.", "primary"],
	["The system validates.", "info"],
	["The professional decides.", "human"],
	["Evidence remains.", "success"],
];

/** Capability ledger under the thesis: [label, value, accent]. */
const LEDGER = [
	["CANDIDATES", "reviewable", "primary"],
	["RECEIPTS", "Ed25519-signed", "success"],
	["LEDGER", "append-only", "info"],
	["SCOPE", "RUC + period", "secondary"],
];

function thesis(p) {
	const out = [
		`<line x1="72" y1="200" x2="600" y2="200" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>`,
	];
	THESIS.forEach(([clause, accent], i) => {
		const y = 236 + i * 30;
		out.push(
			`<circle cx="78" cy="${y - 7}" r="4.5" fill="${p[accent]}"/>`,
			text(98, y, esc(clause), { size: 22, weight: 700, fill: p[accent] }),
		);
	});
	return out.join("\n  ");
}

function ledger(p) {
	const out = [
		`<rect x="72" y="356" width="808" height="56" rx="12" fill="${p.card}" stroke="${p.cardStroke}" stroke-opacity="${p.cardStrokeOpacity}"/>`,
	];
	LEDGER.forEach(([label, value, accent], i) => {
		const x = 92 + i * 200;
		out.push(
			text(x, 377, esc(label), {
				size: 10.5,
				weight: 700,
				spacing: 1.7,
				fill: p.text,
			}),
			`<circle cx="${x + 5}" cy="394" r="4" fill="${p[accent]}"/>`,
			text(x + 17, 399, esc(value), {
				size: 13.5,
				weight: 500,
				fill: p.heading,
			}),
		);
	});
	return out.join("\n  ");
}

/** The hero object: a signed receipt card with a guilloche seal. */
function receipt(p) {
	const cardX = 960;
	const cardY = 44;
	const field = (x, y, label, value, valueOpts, sub) => {
		const out = [
			text(x, y, esc(label), {
				size: 11,
				weight: 700,
				spacing: 1.4,
				fill: p.text,
			}),
			text(x, y + 30, esc(value), valueOpts),
		];
		if (sub) {
			out.push(text(x, y + 50, esc(sub), { size: 11.5, fill: p.muted }));
		}
		return out.join("\n    ");
	};
	return `<g transform="translate(${cardX} ${cardY})">
    <rect x="14" y="16" width="368" height="368" rx="18" fill="none" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>
    <rect x="0" y="10" width="368" height="368" rx="18" fill="${p.shadow}" fill-opacity="${p.shadowOpacity}"/>
    <rect x="0" y="0" width="368" height="368" rx="18" fill="${p.card}" stroke="${p.line}" stroke-opacity="0.7" stroke-width="1.4"/>
    <rect x="16" y="16" width="336" height="336" rx="12" fill="none" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>
    ${text(40, 54, "RECEIPT / 0007", { size: 12, weight: 700, spacing: 1.8, fill: p.muted })}
    <circle cx="274" cy="50" r="4" fill="${p.success}"/>
    ${text(328, 54, "SIGNED", { size: 11, weight: 700, spacing: 1.5, anchor: "end", fill: p.success })}
    <line x1="40" y1="74" x2="328" y2="74" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>
    ${field(40, 106, "CANDIDATE", "C-7F3A", { size: 22, weight: 700, fill: p.heading, family: MONO })}
    ${field(196, 106, "MATERIALITY", "R2", { size: 22, weight: 700, fill: p.secondary })}
    ${field(40, 178, "APPROVAL", "explicit", { size: 18, weight: 700, fill: p.human }, "by the professional")}
    ${field(196, 178, "SIGNATURE", "verified", { size: 18, weight: 700, fill: p.success }, "Ed25519")}
    <line x1="40" y1="246" x2="328" y2="246" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>
    ${text(40, 272, "HASH", { size: 11, weight: 700, spacing: 1.4, fill: p.text })}
    ${text(40, 296, esc("sha256:9f2c\u2026e41a"), { size: 14, weight: 500, fill: p.heading, family: MONO })}
    ${text(40, 328, "immutable", { size: 14, weight: 700, fill: p.primary })}
    <g transform="translate(290 308)">
      <circle r="38" fill="${p.success}" fill-opacity="0.08"/>
      <path d="${ticks(0, 0, 33, 38, 36)}" fill="none" stroke="${p.success}" stroke-opacity="0.55" stroke-width="1.2" stroke-linecap="round"/>
      <circle r="29" fill="${p.card}" stroke="${p.success}" stroke-width="2"/>
      <circle r="23" fill="none" stroke="${p.success}" stroke-opacity="0.4"/>
      <path d="${checkPath(0, 1, 18)}" fill="none" stroke="${p.success}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>`;
}

export const banner = {
	name: "drenyra-ai-banner",
	dir: "docs/assets/brand",
	render(p) {
		const base = canvas(p, {
			id: "banner",
			width: WIDTH,
			height: HEIGHT,
			cx: "14%",
		});
		const body = [
			base.body,
			`<rect x="72" y="44" width="36" height="3" rx="1.5" fill="${p.primary}"/>`,
			text(72, 74, "ARKELYTHEX / DRENYRA", {
				size: 12,
				weight: 700,
				spacing: 2.2,
				fill: p.muted,
			}),
			text(
				72,
				134,
				`Drenyra <tspan fill="${p.primary}">AI</tspan>`,
				{ size: 60, weight: 700, spacing: -1, fill: p.heading },
			),
			text(72, 170, "Verifiable Accounting Agent Ecosystem", {
				size: 22,
				weight: 500,
				fill: p.text,
			}),
			thesis(p),
			ledger(p),
			receipt(p),
		].join("\n  ");
		return svgRoot({
			id: "banner",
			width: WIDTH,
			height: HEIGHT,
			title: "Drenyra AI — Verifiable Accounting Agent Ecosystem",
			desc: "Drenyra AI, by Arkelythex. AI proposes. The system validates. The professional decides. Evidence remains. A signed receipt card shows receipt 0007 for candidate C-7F3A, materiality R2, explicit approval, an Ed25519 signature that is verified, and a sha256 hash.",
			defs: base.defs,
			body: `  ${body}`,
		});
	},
};
