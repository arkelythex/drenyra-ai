/**
 * Tenant-core domain types — fiscal scope identity. A fiscal scope is company
 * identifier + 11-digit RUC + YYYYMM period. Only `validateTenantScope` may
 * produce the branded `ValidatedTenantScope`; cross-tenant read isolation
 * ships separately in the tenant-isolation unit.
 */

/** Brand of a fully validated tenant scope; nominal validation authority. */
export const TENANT_SCOPE_BRAND = "drenyra:validated-tenant-scope:v1" as const;

/** The caller-supplied fiscal scope shape, before validation. */
export interface TenantScope {
	companyId: string;
	ruc: string;
	period: string;
}

/** A validated fiscal scope: brand-carrying, immutable, atomic. */
export interface ValidatedTenantScope extends TenantScope {
	readonly brand: typeof TENANT_SCOPE_BRAND;
}

/** Fail-closed validation failure vocabulary for scope components. */
export const TENANT_SCOPE_ERROR = {
	INVALID_COMPANY: "invalid-company",
	INVALID_RUC: "invalid-ruc",
	INVALID_PERIOD: "invalid-period",
} as const;

export type TenantScopeErrorCode =
	(typeof TENANT_SCOPE_ERROR)[keyof typeof TENANT_SCOPE_ERROR];

/** Thrown on validation failure; invalid input never yields a partial scope. */
export class TenantScopeError extends Error {
	readonly code: TenantScopeErrorCode;

	constructor(code: TenantScopeErrorCode, message: string) {
		super(message);
		this.name = "TenantScopeError";
		this.code = code;
	}
}
