/**
 * Tenant read-isolation domain types — the fail-closed boundary for fiscal
 * artifact reads.
 *
 * A fiscal read bound to scope S fails closed when the requested artifact
 * belongs to a different scope T, and the outcome is identical whether the
 * artifact exists in scope T or does not exist at all: no existence signal
 * leaks.
 */

/** Scoped-read result vocabulary. */
export const SCOPED_READ_KIND = {
	FOUND: "found",
	NOT_FOUND_OR_OUT_OF_SCOPE: "not-found-or-out-of-scope",
} as const;

export type ScopedReadKind =
	(typeof SCOPED_READ_KIND)[keyof typeof SCOPED_READ_KIND];

/** Public detail on every non-disclosing read failure. */
export const SCOPED_READ_DETAIL = {
	NOT_FOUND_OR_OUT_OF_SCOPE: "artifact-not-found-or-out-of-scope",
} as const;

export type ScopedReadDetail =
	(typeof SCOPED_READ_DETAIL)[keyof typeof SCOPED_READ_DETAIL];

/** A scoped read that found the artifact in scope. */
export interface ScopedReadFound<T> {
	kind: typeof SCOPED_READ_KIND.FOUND;
	artifact: T;
}

/** A scoped read that failed closed, identically for absent and foreign. */
export interface ScopedReadNotDisclosing {
	kind: typeof SCOPED_READ_KIND.NOT_FOUND_OR_OUT_OF_SCOPE;
	detail: typeof SCOPED_READ_DETAIL.NOT_FOUND_OR_OUT_OF_SCOPE;
}

export type ScopedReadResult<T> = ScopedReadFound<T> | ScopedReadNotDisclosing;

/**
 * Narrow scoped-store seam. Only a single-scope select is exposed; the store
 * shape prevents probing other scopes after the scoped lookup fails.
 */
export interface TenantScopedStore<T> {
	select(scopeKey: string, artifactId: string): T | undefined;
}
