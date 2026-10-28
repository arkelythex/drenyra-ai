/**
 * Visual palettes for the docs-visuals renderer.
 *
 * Every hex below is a token from contracts/brand-system/tokens.json (v0.4):
 * themes.light, themes.dark, accents.cocoa, accents.terracotta, plus
 * #ffffff / #000000. render.mjs refuses to write anything if a hex drifts out
 * of that set. Opacity is the only free parameter.
 *
 * The two palettes expose the SAME role names, so one template function can
 * draw either theme.
 *
 *   primary    the main path / accent
 *   secondary  attention / second accent
 *   success    verified, signed, closed
 *   info       scope, diagnostics
 *   human      human authority (the professional decides)
 */

/** Dreamcoder Light — editorial "ink on paper". */
const light = {
	name: "light",
	canvas: "#F3EADC", // themes.light.canvas
	band: "#FFF7EA", // themes.light.surface
	bandOpacity: 0.6,
	card: "#FFF7EA", // themes.light.surface
	cardStroke: "#8A7358", // themes.light.border-default
	cardStrokeOpacity: 0.45,
	pill: "#DECBB1", // themes.light.surface-2
	line: "#8A7358", // themes.light.border-default
	lineOpacity: 0.35,
	route: "#8A7358", // themes.light.border-default
	heading: "#100C07", // themes.light.text-heading
	text: "#554638", // themes.light.text-secondary
	muted: "#725E4C", // themes.light.text-tertiary
	primary: "#824F16", // accents.cocoa.base
	secondary: "#A7471C", // accents.terracotta.base
	success: "#315B31", // themes.light.sage
	info: "#0D4A68", // themes.light.diagnostic
	human: "#57478B", // themes.light.lavender
	error: "#842F24", // themes.light.state-error
	ambientOpacity: 0.16,
	shadow: "#100C07", // themes.light.text-heading
	shadowOpacity: 0.1,
};

/** Dreamcoder Dark — OLED-aware; #000000 is the canvas only. */
const dark = {
	name: "dark",
	canvas: "#000000", // themes.dark.canvas
	band: "#0B0B0B", // themes.dark.surface
	bandOpacity: 1,
	card: "#1F1F1F", // themes.dark.surface-2
	cardStroke: "#2E2E2E", // themes.dark.surface-3
	cardStrokeOpacity: 1,
	pill: "#2E2E2E", // themes.dark.surface-3
	line: "#6B6B6B", // themes.dark.border-default
	lineOpacity: 0.4,
	route: "#6B6B6B", // themes.dark.border-default
	heading: "#F5F5F5", // themes.dark.text-heading
	text: "#C7C7C7", // themes.dark.text-secondary
	muted: "#A7A7A7", // themes.dark.text-tertiary
	primary: "#A5B4FC", // themes.dark.accent
	secondary: "#FBBF24", // themes.dark.state-warning
	success: "#34D399", // themes.dark.sage
	info: "#7DD3FC", // themes.dark.diagnostic
	human: "#D4B5FD", // themes.dark.lavender
	error: "#FB8585", // themes.dark.state-error
	ambientOpacity: 0.14,
	shadow: "#000000",
	shadowOpacity: 0.5,
};

export const palettes = { light, dark };

/** Semantic role -> palette key, in the order the standard documents it. */
export const PALETTE_ROLES = [
	["Canvas", "canvas"],
	["Band / surface", "band"],
	["Card", "card"],
	["Heading text", "heading"],
	["Body text", "text"],
	["Muted text", "muted"],
	["Primary path", "primary"],
	["Secondary / attention", "secondary"],
	["Verified / success", "success"],
	["Scope / info", "info"],
	["Human authority", "human"],
	["Error", "error"],
];
