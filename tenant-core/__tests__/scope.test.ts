/** Tenant-core unit tests: fail-closed validation + deterministic scope identity. */

import { describe, expect, it } from "vitest";
import {
	TENANT_SCOPE_BRAND,
	sameTenantScope,
	tenantScopeKey,
	validateTenantScope,
	type TenantScopeErrorCode,
} from "../index.js";

const VALID_SCOPE = {
	companyId: "ACME",
	ruc: "20123456789",
	period: "202603",
} as const;

function expectInvalidScope(input: unknown, code: TenantScopeErrorCode): void {
	let thrown: unknown;
	try {
		validateTenantScope(input);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ code });
}

describe("validateTenantScope", () => {
	it("accepts a valid company identifier, 11-digit RUC, and YYYYMM period", () => {
		const scope = validateTenantScope(VALID_SCOPE);
		expect(scope.companyId).toBe("ACME");
		expect(scope.ruc).toBe("20123456789");
		expect(scope.period).toBe("202603");
		expect(scope.brand).toBe(TENANT_SCOPE_BRAND);
	});

	it("rejects a non-numeric RUC with no partial scope", () => {
		expectInvalidScope(
			{ companyId: "ACME", ruc: "2012345678X", period: "202603" },
			"invalid-ruc",
		);
	});

	it.each([
		"201234567", // 9 digits
		"2012345678", // 10 digits
		"201234567890", // 12 digits
	])("rejects RUC %s outside exactly eleven digits", (ruc) => {
		expectInvalidScope(
			{ companyId: "ACME", ruc, period: "202603" },
			"invalid-ruc",
		);
	});

	it.each([
		"202613",
		"20261",
		"2026a3",
	])("rejects period %s that is not YYYYMM with month 01-12", (period) => {
		expectInvalidScope(
			{ companyId: "ACME", ruc: "20123456789", period },
			"invalid-period",
		);
	});

	it.each([
		"",
		"   ",
		"\t",
	])("rejects empty or whitespace-only company %j", (companyId) => {
		expectInvalidScope(
			{ companyId, ruc: "20123456789", period: "202603" },
			"invalid-company",
		);
	});

	it("trims and retains a padded company identifier", () => {
		const scope = validateTenantScope({
			companyId: "  ACME  ",
			ruc: "20123456789",
			period: "202603",
		});
		expect(scope.companyId).toBe("ACME");
	});

	it("rejects non-object input without producing any scope", () => {
		expectInvalidScope(null, "invalid-company");
		expectInvalidScope(undefined, "invalid-company");
		expectInvalidScope("ACME", "invalid-company");
	});
});

describe("tenantScopeKey and sameTenantScope", () => {
	it("produces equal canonical keys and equal scopes for identical components", () => {
		const a = validateTenantScope(VALID_SCOPE);
		const b = validateTenantScope({
			companyId: "ACME",
			ruc: "20123456789",
			period: "202603",
		});
		expect(tenantScopeKey(a)).toBe(tenantScopeKey(b));
		expect(sameTenantScope(a, b)).toBe(true);
	});

	it("is deterministic across repeated evaluations", () => {
		const a = validateTenantScope(VALID_SCOPE);
		expect(tenantScopeKey(a)).toBe(tenantScopeKey(a));
		expect(tenantScopeKey(a)).toBe("4:ACME;11:20123456789;6:202603");
		expect(sameTenantScope(a, a)).toBe(true);
	});

	it("distinguishes scopes that differ only in period", () => {
		const a = validateTenantScope(VALID_SCOPE);
		const b = validateTenantScope({
			companyId: "ACME",
			ruc: "20123456789",
			period: "202604",
		});
		expect(sameTenantScope(a, b)).toBe(false);
		expect(tenantScopeKey(a)).not.toBe(tenantScopeKey(b));
	});

	it("distinguishes scopes that differ in company", () => {
		const a = validateTenantScope(VALID_SCOPE);
		const b = validateTenantScope({
			companyId: "ACME2",
			ruc: "20123456789",
			period: "202603",
		});
		expect(sameTenantScope(a, b)).toBe(false);
		expect(tenantScopeKey(a)).not.toBe(tenantScopeKey(b));
	});

	it("distinguishes scopes that differ in RUC", () => {
		const a = validateTenantScope(VALID_SCOPE);
		const b = validateTenantScope({
			companyId: "ACME",
			ruc: "20987654321",
			period: "202603",
		});
		expect(sameTenantScope(a, b)).toBe(false);
		expect(tenantScopeKey(a)).not.toBe(tenantScopeKey(b));
	});
});
