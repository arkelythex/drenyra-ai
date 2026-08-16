/**
 * drenyra-ai — public package entry.
 *
 * Re-exports the library modules. The library is zero-dependency
 * (node:crypto built-in only); the CLI additionally uses ajv for schema
 * validation of public contract files.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers,
 * never floats.
 */

export * from "./receipts/index.js";
export * from "./ledger/index.js";
export * from "./missions/index.js";
export * from "./candidates/index.js";
export * from "./evidence/index.js";
export * from "./journal/index.js";
export * from "./fiscal/index.js";
export * from "./policy/index.js";
export * from "./cdr/index.js";
export * from "./review/index.js";
export * from "./gates/index.js";
export * from "./recovery/index.js";
export * from "./tenant-core/index.js";
export * from "./skills/index.js";
export * from "./security/index.js";
export * from "./guardian/index.js";
export * from "./mcp/index.js";
export * from "./adapters/index.js";
export * from "./routing/index.js";
export * from "./configurator/index.js";
export * from "./flow/index.js";
export * from "./projection/index.js";
export * from "./authorization/index.js";
export * from "./close-calculations/index.js";
// bank-reconciliation is intentionally NOT star-exported here: its
// ReconciliationError would clash with missions/reconciliation.ts and its
// Scope with close-calculations. It stays reachable via the package subpath
// "./bank-reconciliation" (verified state; see archive 2026-08-16).
// Explicit re-export resolves the star-export name clash between
// skills/index.js and close-calculations (IsoDate is module-private there).
export type { IsoDate } from "./skills/index.js";
// Explicit re-export resolves the star-export name clash between the routing
// axis union and missions/reconciliation.ts (both named ExternalEvidence).
// Routing has no package subpath, so the routing surface must resolve here.
export type { ExternalEvidence } from "./routing/index.js";
export * from "./routing/index.js";
