/**
 * Receipt signing — Ed25519 key generation, canonical-payload signing, and
 * signed bundle construction.
 *
 * Ported verbatim from arkelythex/Drenyra `packages/mission-domain/src/mission-receipt.ts`.
 * The signature covers the exact canonical payload bytes, stable across
 * languages. Fiscal convention: money is BigInt cents; no float here.
 */

import {
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { sortedStringify } from "./canonical.js";
import { generateReceiptHash } from "./verify.js";
import {
  ReceiptType,
  type ReceiptContent,
  type ReceiptKeyPair,
  type SignedReceipt,
} from "./types.js";

/**
 * Generate an Ed25519 key pair for receipt signing.
 */
export function generateReceiptKeyPair(keyId?: string): ReceiptKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64"),
    privateKey: privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    keyId: keyId ?? "key_" + randomBytes(4).toString("hex"),
  };
}

/**
 * Sign a receipt content with an Ed25519 private key.
 * The signature covers the canonical payload bytes, stable across languages.
 */
export function signReceipt(
  content: ReceiptContent,
  privateKeyBase64: string,
  keyId: string,
): { signature: string; canonicalPayload: string } {
  void keyId;
  const canonicalPayload = sortedStringify(
    content as unknown as Record<string, unknown>,
  );
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });

  const signature = sign(
    null,
    Buffer.from(canonicalPayload, "utf-8"),
    privateKey,
  );

  return {
    signature: signature.toString("base64"),
    canonicalPayload,
  };
}

/**
 * Build a complete signed receipt bundle.
 */
export function buildSignedReceipt(
  content: ReceiptContent,
  keyPair: ReceiptKeyPair,
  protocolVersion = "1.0",
  receiptType: ReceiptType = ReceiptType.APPROVAL,
): SignedReceipt {
  const receiptHash = generateReceiptHash(content);
  const { signature } = signReceipt(content, keyPair.privateKey, keyPair.keyId);

  return {
    protocolVersion,
    receiptType,
    algorithm: "Ed25519",
    content,
    receiptHash,
    signerKeyId: keyPair.keyId,
    signerPublicKey: keyPair.publicKey,
    signature,
    issuedAt: new Date().toISOString(),
  };
}
