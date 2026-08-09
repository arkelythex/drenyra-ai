/**
 * Cross-tenant read isolation — fail-closed, non-disclosing scoped reads.
 *
 * `readArtifact` selects by scope key and artifact id only and returns the
 * identical non-disclosing failure result for missing and foreign artifacts.
 * `assertTenantReadScope` revalidates the scope so a malformed or forged
 * scope can never issue a read.
 */

import {
	tenantScopeKey,
	validateTenantScope,
	type ValidatedTenantScope,
} from "../tenant-core/index.js";
import {
	SCOPED_READ_DETAIL,
	SCOPED_READ_KIND,
	type ScopedReadResult,
	type TenantScopedStore,
} from "./types.js";

/**
 * Fails closed when the read scope is not a structurally valid validated
 * scope. A malformed or forged scope can never issue a read.
 */
export function assertTenantReadScope(
	scope: ValidatedTenantScope,
): ValidatedTenantScope {
	validateTenantScope(scope);
	return scope;
}

/**
 * Selects by scope key and artifact id only. A missing artifact and an
 * artifact owned by another scope both yield the identical non-disclosing
 * failure result; the store seam exposes no cross-scope probe, so no
 * existence signal can leak. Retries are deterministic and side-effect free.
 */
export function readArtifact<T>(
	store: TenantScopedStore<T>,
	scope: ValidatedTenantScope,
	artifactId: string,
): ScopedReadResult<T> {
	assertTenantReadScope(scope);
	const artifact = store.select(tenantScopeKey(scope), artifactId);
	if (artifact === undefined) {
		return {
			kind: SCOPED_READ_KIND.NOT_FOUND_OR_OUT_OF_SCOPE,
			detail: SCOPED_READ_DETAIL.NOT_FOUND_OR_OUT_OF_SCOPE,
		};
	}
	return { kind: SCOPED_READ_KIND.FOUND, artifact };
}
