/**
 * Drawing kit shared by every visual. Pure functions: (palette, options) ->
 * SVG fragment string. No I/O, no randomness, so output is deterministic.
 */

export const SANS =
	"'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const MONO = "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace";

/** Round to 2 decimals and drop trailing zeros so coordinates stay stable. */
export const n = (value) => String(Math.round(value * 100) / 100);

/** Escape XML and turn non-ASCII into numeric references (ASCII-only files). */
export function esc(text) {
	let out = "";
	for (const ch of String(text)) {
		const code = ch.codePointAt(0);
		if (ch === "&") out += "&amp;";
		else if (ch === "<") out += "&lt;";
		else if (ch === ">") out += "&gt;";
		else if (code > 126) out += `&#${code};`;
		else out += ch;
	}
	return out;
}

/** Attribute map -> ` key="value"` string, skipping undefined values. */
function attrs(map) {
	return Object.entries(map)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => ` ${k}="${typeof v === "number" ? n(v) : v}"`)
		.join("");
}

/** A <text> element. `content` is already-escaped markup (may hold tspans). */
export function text(x, y, content, opts = {}) {
	const {
		size = 14,
		weight,
		fill,
		anchor,
		spacing,
		opacity,
		family,
		extra,
	} = opts;
	return `<text${attrs({
		x,
		y,
		"font-size": size,
		"font-weight": weight,
		"letter-spacing": spacing,
		"text-anchor": anchor,
		"font-family": family,
		fill,
		opacity,
		...extra,
	})}>${content}</text>`;
}

/** Document root with accessible title/description and the shared font stack. */
export function svgRoot({ id, width, height, title, desc, defs = "", body }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${id}Title ${id}Desc" font-family="${SANS}">
  <title id="${id}Title">${esc(title)}</title>
  <desc id="${id}Desc">${esc(desc)}</desc>
${defs}
${body}
</svg>
`;
}

/** Rounded canvas with a soft radial ambient glow in the primary accent. */
export function canvas(p, { id, width, height, glow = "primary", cx = "12%" }) {
	const stop = p[glow];
	return {
		defs: `  <defs>
    <radialGradient id="${id}Ambient" cx="${cx}" cy="0%" r="70%">
      <stop offset="0%" stop-color="${stop}" stop-opacity="${p.ambientOpacity}"/>
      <stop offset="100%" stop-color="${stop}" stop-opacity="0"/>
    </radialGradient>
  </defs>`,
		body: `  <rect width="${width}" height="${height}" rx="24" fill="${p.canvas}"/>
  <rect width="${width}" height="${height}" rx="24" fill="url(#${id}Ambient)"/>`,
	};
}

/** Header: bold title, subtitle, and a mono pill tag at the top right. */
export function header(p, { width, title, subtitle, tag, tagWidth = 220 }) {
	const tagX = width - 40 - tagWidth;
	return [
		text(40, 58, esc(title), { size: 27, weight: 700, fill: p.heading }),
		text(41, 88, esc(subtitle), { size: 14.5, fill: p.muted }),
		`<rect x="${n(tagX)}" y="38" width="${n(tagWidth)}" height="34" rx="17" fill="${p.pill}" fill-opacity="0.6" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>`,
		text(tagX + tagWidth / 2, 60, esc(tag), {
			size: 12.5,
			anchor: "middle",
			fill: p.primary,
			family: MONO,
		}),
	].join("\n  ");
}

/** Numbered band: faint large numeral, spaced label, vertical hairline. */
export function band(p, { x = 40, y, width, height, index, label }) {
	const mid = y + height / 2;
	return [
		`<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="20" fill="${p.band}" fill-opacity="${p.bandOpacity}" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>`,
		text(x + 28, mid + 8, esc(index), {
			size: 34,
			weight: 700,
			fill: p.primary,
			opacity: 0.22,
		}),
		text(x + 28, mid + 34, esc(label), {
			size: 13,
			weight: 700,
			spacing: 2,
			fill: p.text,
		}),
		`<line x1="${n(x + 160)}" y1="${n(y + 28)}" x2="${n(x + 160)}" y2="${n(y + height - 28)}" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>`,
	].join("\n  ");
}

/**
 * Card with eyebrow, title and one-line caption.
 * tone: "main" (accent-outlined main path), "plain", or "side" (dashed,
 * read-only route). `accent` picks the semantic color of the eyebrow/outline.
 */
export function card(
	p,
	{ x, y, width, height = 90, eyebrow, title, caption, tone = "plain", accent },
) {
	const color = accent ? p[accent] : p.primary;
	const stroke =
		tone === "main"
			? `stroke="${color}" stroke-opacity="0.55"`
			: tone === "side"
				? `stroke="${p.route}" stroke-dasharray="5 4"`
				: `stroke="${p.cardStroke}" stroke-opacity="${p.cardStrokeOpacity}"`;
	const parts = [
		`<rect x="${n(x)}" y="${n(y + 3)}" width="${n(width)}" height="${n(height)}" rx="14" fill="${p.shadow}" fill-opacity="${p.shadowOpacity}"/>`,
		`<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="14" fill="${p.card}" ${stroke}/>`,
	];
	if (tone === "main") {
		parts.push(
			`<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="14" fill="${color}" fill-opacity="0.07"/>`,
		);
	}
	parts.push(
		text(x + 20, y + 33, esc(eyebrow), {
			size: 10.5,
			weight: 700,
			spacing: 1.2,
			fill: color,
			opacity: 0.85,
		}),
		text(x + 20, y + 58, esc(title), {
			size: 17,
			weight: 600,
			fill: p.heading,
		}),
		text(x + 20, y + 78, esc(caption), { size: 11.5, fill: p.muted }),
	);
	return parts.join("\n  ");
}

/**
 * Route through points [[x, y], ...] with a round-capped arrowhead at the
 * last point. dashed marks side / read-only routes.
 */
export function route(p, points, { accent, dashed = false } = {}) {
	const color = accent ? p[accent] : p.route;
	const width = accent ? 2 : 1.75;
	const d = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`)
		.join(" ");
	const [px, py] = points[points.length - 2];
	const [x, y] = points[points.length - 1];
	const len = Math.hypot(x - px, y - py);
	const ux = (x - px) / len;
	const uy = (y - py) / len;
	const bx = x - ux * 8;
	const by = y - uy * 8;
	const head = `M${n(bx - uy * 6)} ${n(by + ux * 6)} L${n(x)} ${n(y)} L${n(bx + uy * 6)} ${n(by - ux * 6)}`;
	const common = `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
	return [
		`<path d="${d}" ${common}${dashed ? ' stroke-dasharray="4 4"' : ""}/>`,
		`<path d="${head}" ${common}/>`,
	].join("\n  ");
}

/** Footer hairline with a centered one-line motto. */
export function footer(p, { width, y, motto }) {
	return [
		`<line x1="40" y1="${n(y)}" x2="${n(width - 40)}" y2="${n(y)}" stroke="${p.line}" stroke-opacity="${p.lineOpacity}"/>`,
		text(width / 2, y + 20, esc(motto), {
			size: 12,
			anchor: "middle",
			fill: p.muted,
		}),
	].join("\n  ");
}

/** Check mark path centered on (cx, cy) with the given half-size. */
export function checkPath(cx, cy, k) {
	return `M${n(cx - k * 0.55)} ${n(cy)} L${n(cx - k * 0.15)} ${n(cy + k * 0.4)} L${n(cx + k * 0.7)} ${n(cy - k * 0.55)}`;
}

/** Ring of short radial ticks (the seal's guilloche edge). */
export function ticks(cx, cy, inner, outer, count) {
	const out = [];
	for (let i = 0; i < count; i++) {
		const a = (i / count) * Math.PI * 2;
		const c = Math.cos(a);
		const s = Math.sin(a);
		out.push(
			`M${n(cx + c * inner)} ${n(cy + s * inner)} L${n(cx + c * outer)} ${n(cy + s * outer)}`,
		);
	}
	return out.join(" ");
}
