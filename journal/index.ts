/**
 * Public API of the journal authority module (slice 1C-3).
 *
 * Exposes the journal operations (record, post, supersede, revoke), the journal
 * domain types, the journal const objects, and the receipt-issuer port types.
 * No ledger-write API and no receipt-issuer implementation are exported: journal
 * actions return SignedReceipt values, and existing ledger callers record only
 * the receipt hash and receipt metadata under the frozen ledger contract.
 */

export * from "./types.js";
export { record, post, supersede, revoke } from "./journal.js";
