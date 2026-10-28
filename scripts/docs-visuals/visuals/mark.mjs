import { checkPath, esc, n, svgRoot } from "../kit.mjs";

/**
 * 56x56 section-divider mark: a receipt sheet with a verified seal.
 * Transparent background so it sits on either GitHub page color; strokes are
 * heavy enough to stay readable at 28px.
 */
export const mark = {
	name: "drenyra-mark",
	dir: "docs/assets/brand",
	render(p) {
		// Receipt sheet: flat top, zigzag torn bottom edge.
		const sheet = `M13 6 H37 Q40 6 40 9 V47 L36.5 44 L33 47 L29.5 44 L26 47 L22.5 44 L19 47 L16 44.5 L13 47 Z`;
		const lines = [18, 25, 32]
			.map(
				(y, i) =>
					`<path d="M18 ${n(y)} H${i === 2 ? 26 : 32}" fill="none" stroke="${p.muted}" stroke-width="2.4" stroke-linecap="round"/>`,
			)
			.join("\n  ");
		const body = `  <path d="${sheet}" fill="${p.card}" stroke="${p.primary}" stroke-width="3" stroke-linejoin="round"/>
  ${lines}
  <circle cx="40" cy="38" r="14" fill="${p.canvas}"/>
  <circle cx="40" cy="38" r="11" fill="${p.card}" stroke="${p.success}" stroke-width="3"/>
  <path d="${checkPath(40, 38.5, 11)}" fill="none" stroke="${p.success}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
		return svgRoot({
			id: "mark",
			width: 56,
			height: 56,
			title: "Drenyra receipt mark",
			desc: esc(
				"A receipt sheet with a verified seal: the Drenyra section divider.",
			),
			body,
		});
	},
};
