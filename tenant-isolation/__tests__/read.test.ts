/**
 * Cross-tenant read isolation tests — non-disclosing scoped reads.
 *
 * A read bound to scope S for an artifact present only in scope T returns the
 * same non-disclosing result as a read for an artifact absent everywhere; no
 * existence signal leaks. Deterministic retry and forged-scope rejection are
 * covered here.
 */

import { describe, expect, it } from "vitest";
import {
	TENANT_SCOPE_BRAND,
	tenantScopeKey,
	validateTenantScope,
	type ValidatedTenantScope,
} from "../../tenant-core/index.js";
import {
	SCOPED_READ_DETAIL,
	SCOPED_READ_KIND,
	assertTenantReadScope,
	readArtifact,
	type TenantScopedStore,
} from "../index.js";

/** Builds an in-memory store keyed by scope key + artifact id. */
function scopedStore(
	entries: ReadonlyArray<{
		scopeKey: string;
		artifactId: string;
		payload: string;
	}>,
): TenantScopedStore<string> {
	const byKey = new Map<string, string>();
	for (const entry of entries) {
		byKey.set(`${entry.scopeKey}::${entry.artifactId}`, entry.payload);
	}
	return {
		select(scopeKey: string, artifactId: string): string | undefined {
			return byKey.get(`${scopeKey}::${artifactId}`);
		},
	};
}

describe("cross-tenant read isolation", () => {
	const scopeS = validateTenantScope({
		companyId: "ACME",
		ruc: "20123456789",
		period: "202603",
	});
	const scopeT = validateTenantScope({
		companyId: "OTRA",
		ruc: "20987654321",
		period: "202604",
	});

	it("returns an identical non-disclosing result for foreign and absent artifacts", () => {
		const store = scopedStore([
			{
				scopeKey: tenantScopeKey(scopeT),
				artifactId: "art-1",
				payload: "secret-of-T",
			},
		]);
		const foreign = readArtifact(store, scopeS, "art-1");
		const absent = readArtifact(store, scopeS, "art-missing");
		expect(foreign).toEqual(absent);
		expect(foreign).toMatchObject({
			kind: SCOPED_READ_KIND.NOT_FOUND_OR_OUT_OF_SCOPE,
			detail: SCOPED_READ_DETAIL.NOT_FOUND_OR_OUT_OF_SCOPE,
		});
	});

	it("returns the artifact only for a read within scope", () => {
		const store = scopedStore([
			{
				scopeKey: tenantScopeKey(scopeS),
				artifactId: "art-1",
				payload: "payload-S",
			},
		]);
		const result = readArtifact(store, scopeS, "art-1");
		expect(result.kind).toBe(SCOPED_READ_KIND.FOUND);
		if (result.kind === SCOPED_READ_KIND.FOUND) {
			expect(result.artifact).toBe("payload-S");
		}
	});

	it("is deterministic on retry with no side effect", () => {
		const store = scopedStore([
			{
				scopeKey: tenantScopeKey(scopeT),
				artifactId: "art-1",
				payload: "secret-of-T",
			},
		]);
		const first = readArtifact(store, scopeS, "art-1");
		const second = readArtifact(store, scopeS, "art-1");
		expect(second).toEqual(first);
		expect(second.kind).toBe(SCOPED_READ_KIND.NOT_FOUND_OR_OUT_OF_SCOPE);
	});

	it("never returns a foreign artifact from any scope", () => {
		const store = scopedStore([
			{
				scopeKey: tenantScopeKey(scopeT),
				artifactId: "art-1",
				payload: "secret-of-T",
			},
		]);
		const result = readArtifact(store, scopeS, "art-1");
		expect(result.kind).toBe(SCOPED_READ_KIND.NOT_FOUND_OR_OUT_OF_SCOPE);
		if (result.kind === SCOPED_READ_KIND.FOUND) {
			expect(result.artifact).not.toBe("secret-of-T");
		}
	});

	it("assertTenantReadScope fails closed on an invalid scope", () => {
		const forged = {
			brand: TENANT_SCOPE_BRAND,
			companyId: "ACME",
			ruc: "123",
			period: "202603",
		} as unknown as ValidatedTenantScope;
		expect(() => assertTenantReadScope(forged)).toThrow(Error);
		expect(() => assertTenantReadScope(scopeS)).not.toThrow();
	});
});
