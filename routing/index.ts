/**
 * Public API of the routing module (SDD-030, slice A+B).
 *
 * Advisory WorkUnit/WorkResult type surface with deterministic construction
 * and validation helpers. Type-only toward missions/ and candidates/;
 * node:crypto is the only runtime dependency.
 */
export * from "./types.js";
export * from "./helpers.js";
export * from "./router.js";
