/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/** Public API of the MCP module — JSON-RPC 2.0 server and core tools. */

export * from "./protocol.js";
export * from "./server.js";
export * from "./tools.js";
export { bankReconcileTool } from "./tools.js";
export * from "./stdio.js";
