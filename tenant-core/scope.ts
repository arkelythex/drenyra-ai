/**
 * Tenant scope validation and deterministic canonical identity. Validation is
 * atomic and fail-closed; key/equality are canonical over normalized parts.
 */

import {
	TENANT_SCOPE_BRAND,
	TENANT_SCOPE_ERROR,
	TenantScopeError,
	type TenantScope,
	type ValidatedTenantScope,
} from "./types.js";

/** Exactly eleven ASCII digits (RUC). */
const RUC_PATTERN = /^[0-9]{11}$/;

/** Six digits YYYYMM with month 01 through 12. */
const PERIOD_PATTERN = /^[0-9]{4}(0[1-9]|1[0-2])$/;

function isRecord(input: unknown): input is Record<string, unknown> {
	return typeof input === "object" && input !== null;
}

/** Trimmed company id, or null when empty/whitespace-only. */
function normalizeCompanyId(companyId: unknown): string | null {
	if (typeof companyId !== "string") return null;
	const trimmed = companyId.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/** RUC when exactly eleven ASCII digits, else null. */
function normalizeRuc(ruc: unknown): string | null {
	return typeof ruc === "string" && RUC_PATTERN.test(ruc) ? ruc : null;
}

/** Period when YYYYMM with month 01-12, else null. */
function normalizePeriod(period: unknown): string | null {
	return typeof period === "string" && PERIOD_PATTERN.test(period)
		? period
		: null;
}

/**
 * Validates the three components atomically and returns the branded scope, or
 * throws `TenantScopeError` for the first failing component.
 */
export function validateTenantScope(input: unknown): ValidatedTenantScope {
	if (!isRecord(input)) {
		throw new TenantScopeError(
			TENANT_SCOPE_ERROR.INVALID_COMPANY,
			"tenant scope must be an object",
		);
	}

	const companyId = normalizeCompanyId(input.companyId);
	if (companyId === null) {
		throw new TenantScopeError(
			TENANT_SCOPE_ERROR.INVALID_COMPANY,
			"companyId must be a non-empty string",
		);
	}

	const ruc = normalizeRuc(input.ruc);
	if (ruc === null) {
		throw new TenantScopeError(
			TENANT_SCOPE_ERROR.INVALID_RUC,
			"ruc must be exactly eleven ASCII digits",
		);
	}

	const period = normalizePeriod(input.period);
	if (period === null) {
		throw new TenantScopeError(
			TENANT_SCOPE_ERROR.INVALID_PERIOD,
			"period must be YYYYMM with month 01 through 12",
		);
	}

	return {
		brand: TENANT_SCOPE_BRAND,
		companyId,
		ruc,
		period,
	};
}

/**
 * Canonical, length-delimited scope key: each component is prefixed by its
 * character length so adjacent components can never re-segment ambiguously.
 */
export function tenantScopeKey(scope: TenantScope): string {
	const companyId = scope.companyId.trim();
	return `${companyId.length}:${companyId};${scope.ruc.length}:${scope.ruc};${scope.period.length}:${scope.period}`;
}

/** True when both scopes share the same canonical key. */
export function sameTenantScope(a: TenantScope, b: TenantScope): boolean {
	return tenantScopeKey(a) === tenantScopeKey(b);
}
