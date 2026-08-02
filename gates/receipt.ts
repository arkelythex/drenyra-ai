/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * ReceiptGate — authenticates the signed receipt before an action is allowed
 * (contract: contracts/gate.md, "## Authority").
 *
 * Verification (receipts/verify.ts):
 *   1. verifySignedReceipt — content hash integrity + Ed25519 signature.
 *   2. verifySignedReceiptTrusted — trusted signer lifecycle (recognized,
 *      current, not revoked).
 *
 * Only SIGNER_TRUSTED → allowed. PAYLOAD_TAMPERED, KEY_REVOKED, KEY_EXPIRED,
 * UNKNOWN_SIGNER, an invalid signature, or a missing receipt → blocked
 * (fail-closed). The blocked envelope carries the verification status and steps
 * so the caller can see exactly why trust failed.
 *
 * Trust resolution: ctx.trustedKeys is the explicit allow-list when provided
 * (the fail-closed choice). Without it the gate falls back to embedded-key
 * self-trust — the signer vouches for its own embedded public key. SELF-TRUST
 * IS WEAK: it proves the receipt was not tampered with and is internally
 * consistent, but a compromised signer could self-vouch for forged receipts.
 * Production deployments MUST pass trustedKeys (or a resolver) — never rely on
 * self-trust for fiscal decisions.
 */

import {
  verifySignedReceipt,
  verifySignedReceiptTrusted,
  type KeyTrustResolver,
  type SignedReceipt,
  type SigningKeyInfo,
} from "../receipts/index.js";
import type { Gate, GateContext, GateResult } from "./types.js";

/** Epoch issue date so an embedded-key self-trust root is always current. */
const EPOCH_ISSUED_AT = "1970-01-01T00:00:00.000Z";

/** Explicit allow-list resolver built from trustedKeys. */
function trustedKeysResolver(keys: SigningKeyInfo[]): KeyTrustResolver {
  return (keyId: string) => {
    const match = keys.find((key) => key.keyId === keyId);
    return match === undefined ? undefined : match;
  };
}

/**
 * Embedded-key self-trust: the signer's own key vouches for itself with an
 * epoch issue date so the lifecycle check is deterministic. Weak by design —
 * see the module doc for the tradeoff.
 */
function selfTrustResolver(receipt: SignedReceipt): KeyTrustResolver {
  return (keyId: string) =>
    keyId === receipt.signerKeyId
      ? {
          keyId,
          publicKey: receipt.signerPublicKey,
          issuedAt: EPOCH_ISSUED_AT,
        }
      : undefined;
}

/** Receipt authenticity gate. */
export class ReceiptGate implements Gate {
  public readonly name = "receipt" as const;

  async evaluate(ctx: GateContext): Promise<GateResult> {
    const receipt = ctx.receipt;
    if (receipt === undefined) {
      return {
        gate: this.name,
        verdict: "blocked",
        reason: "receipt required: no SignedReceipt in the gate context",
      };
    }

    const resolver =
      ctx.trustedKeys !== undefined && ctx.trustedKeys.length > 0
        ? trustedKeysResolver(ctx.trustedKeys)
        : selfTrustResolver(receipt);

    const local = verifySignedReceipt(receipt);
    const trusted = await verifySignedReceiptTrusted(receipt, resolver);

    if (local.valid && trusted.status === "SIGNER_TRUSTED") {
      return {
        gate: this.name,
        verdict: "allowed",
        reason: `receipt verified (signer ${receipt.signerKeyId} trusted)`,
      };
    }

    return {
      gate: this.name,
      verdict: "blocked",
      reason: `receipt verification failed: ${trusted.status}`,
      envelope: {
        status: trusted.status,
        steps: trusted.steps,
        keyId: receipt.signerKeyId,
        integrityValid: local.valid,
      },
    };
  }
}
