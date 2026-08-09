/**
 * Public API of the tenant-core authority module: fail-closed validation and
 * deterministic canonical identity. Read isolation ships in tenant-isolation.
 */

export * from "./types.js";
export {
	sameTenantScope,
	tenantScopeKey,
	validateTenantScope,
} from "./scope.js";
