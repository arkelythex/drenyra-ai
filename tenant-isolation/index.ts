/**
 * Public API of the tenant-isolation module.
 *
 * Exposes the fail-closed cross-tenant read boundary on top of tenant-core
 * scope identity. Not yet wired into the package exports; this unit ships
 * with its own staging PR after tenant-core review.
 */

export * from "./types.js";
export { assertTenantReadScope, readArtifact } from "./read.js";
