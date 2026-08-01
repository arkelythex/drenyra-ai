/**
 * Public API of the receipt module.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai.
 */

export * from "./types.js";
export { sortedStringify } from "./canonical.js";
export {
  buildSignedReceipt,
  generateReceiptKeyPair,
  signReceipt,
} from "./sign.js";
export {
  computeEvidenceHash,
  generateReceiptHash,
  verifyReceiptIntegrity,
  verifyReceiptSignature,
  verifySignedReceipt,
  verifySignedReceiptTrusted,
} from "./verify.js";
