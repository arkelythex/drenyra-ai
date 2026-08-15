/**
 * Public API of the configurator module (SDD-020).
 *
 * Managed agent-host composition: deterministic package-level composition
 * rules BELOW `cmd/` — manifest classification, exact managed-asset
 * rendering and SHA-256 hashing, per-host pinned runtime/model/tool
 * (`PinnedComposition`), and read-only diagnostics. node:crypto is the only
 * runtime dependency.
 */
export * from "./managed-config.js";
