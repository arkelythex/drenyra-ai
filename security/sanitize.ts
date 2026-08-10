/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Document sanitization — Design 04 "Evidence" and "Security controls".
 *
 * Documents are UNTRUSTED input: a PDF, XML, spreadsheet, or description can
 * never introduce instructions to the agent, modify permissions, or request
 * additional tools. This module detects prompt-injection patterns and
 * neutralizes them so the agent receives quoted content, not directives.
 */

/** A detected injection pattern. */
export interface InjectionRisk {
	/** Machine-readable risk kind. */
	kind:
		| "ignore-prior-instructions"
		| "system-prompt-redefinition"
		| "role-redefinition"
		| "xml-instruction-block"
		| "tool-or-permission-request"
		| "authority-escalation";
	/** Snippet (bounded) that triggered detection. */
	snippet: string;
}

/** Result of sanitizing a document's text. */
export interface SanitizationResult {
	/** Text with detected instructions neutralized (quoted, not directives). */
	safeText: string;
	/** Detected risks. Empty when the input was clean. */
	risks: readonly InjectionRisk[];
	/** True when at least one directive was neutralized. */
	neutralized: boolean;
}

/** Bounded snippet length to avoid leaking document content into logs. */
const SNIPPET_LIMIT = 80;

function snippetOf(match: string): string {
	const trimmed = match.trim();
	return trimmed.length > SNIPPET_LIMIT ? `${trimmed.slice(0, SNIPPET_LIMIT)}…` : trimmed;
}

/** Detection patterns: regex -> risk kind. */
const PATTERNS: ReadonlyArray<{ kind: InjectionRisk["kind"]; re: RegExp }> = [
	{ kind: "ignore-prior-instructions", re: /\bignore (all |any )?(previous|prior|earlier) (instructions?|directives?|prompts?)\b/i },
	{ kind: "ignore-prior-instructions", re: /\bforget (everything|all previous|your instructions)\b/i },
	{ kind: "system-prompt-redefinition", re: /\b(system prompt|system message)\s*[=:]\s*.{0,40}/i },
	{ kind: "system-prompt-redefinition", re: /\byou are now\b/i },
	{ kind: "role-redefinition", re: /\b(disregard|ignore) (your )?(role|instructions|config(uration)?)\b/i },
	{ kind: "role-redefinition", re: /\bact as (an? )?(administrator|root|system|unrestricted|omniscient)\b/i },
	{ kind: "xml-instruction-block", re: /<\s*(instructions?|system|config|tool|permission|prompt)\b[^>]*>[\s\S]{0,200}/i },
	{ kind: "tool-or-permission-request", re: /\b(grant|give|allow) (me|the agent|yourself) (access|permissions?|tools?|the ability)\b/i },
	{ kind: "authority-escalation", re: /\b(skip|bypass|override) (the )?(gates?|approvals?|controls?|review)\b/i },
	{ kind: "authority-escalation", re: /\b(mark|treat|report) (this |it )?as (approved|verified|accepted)\b/i },
];

/** Detect injection risks in document text. */
export function detectInjectionRisks(text: string): readonly InjectionRisk[] {
	const risks: InjectionRisk[] = [];
	for (const { kind, re } of PATTERNS) {
		re.lastIndex = 0;
		const match = re.exec(text);
		if (match !== null) {
			risks.push({ kind, snippet: snippetOf(match[0]) });
		}
	}
	return risks;
}

/** Neutralize directives: wrap matched instructions as quoted, inert content. */
export function neutralizeInstructions(text: string): { text: string; neutralized: boolean } {
	let out = text;
	let neutralized = false;
	for (const { re } of PATTERNS) {
		re.lastIndex = 0;
		out = out.replace(re, (match) => {
			neutralized = true;
			// Escape delimiters so the quoted content stays inert (cannot be
			// re-activated if the model unwraps the marker).
			const inert = match.trim().replace(/</g, "[").replace(/>/g, "]");
			return `[UNTRUSTED: ${inert}]`;
		});
	}
	return { text: out, neutralized };
}

/** Sanitize a document's text: detect risks and neutralize directives. */
export function sanitizeDocumentText(text: string): SanitizationResult {
	const risks = detectInjectionRisks(text);
	const { text: safeText, neutralized } = neutralizeInstructions(text);
	return { safeText, risks, neutralized };
}
