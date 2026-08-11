# receipt-schema / v1

> **Source: arkelythex/drenyra-app-web `contracts/receipt-schema/v1`** — copied verbatim.
> These schemas and fixtures are the **frozen conformance source of truth** for
> the `drenyra-ai` receipt surface.

<!-- -->

> [!IMPORTANT]
> **FROZEN conformance source of truth** — the schemas and fixtures in this directory are normative; any drift fails CI. See the [Contracts index](../README.md).

Canonical JSON schema contract for **SignedReceipt** (hash + Ed25519 + security
metadata), shared across the TypeScript, Go, and Python surfaces of Drenyra.
Mirrors the `contracts/<contract>/v1/schemas/ + fixtures/` layout used by
`contracts/data-engine/v1`.

Last updated: 2026-08-01

## Field ownership

| Field | Type / constraint | Required | Owner |
| --- | --- | --- | --- |
| `protocolVersion` | string, `"1.0"` | yes | TS `SignedReceipt` |
| `receiptType` | `APPROVAL` \| `EXECUTION` \| `COMPLETION` \| `EXTERNAL_SUBMISSION` | yes | `ReceiptType` (mission-protocol) |
| `algorithm` | `"Ed25519"` | yes | TS `SignedReceipt` |
| `content` | object (`ReceiptContent`) | yes | TS `ReceiptContent` |
| `receiptHash` | `^[0-9a-f]{64}$` | yes | SHA-256 hex of canonical content |
| `signerKeyId` | string | yes | stable key id |
| `signerPublicKey` | base64 DER SPKI | yes | Ed25519 public key |
| `signature` | base64 raw Ed25519 (64 bytes) | yes | signature over canonical content |
| `issuedAt` | RFC 3339 | yes | issuance timestamp |

The TypeScript `SignedReceipt` interface in
`packages/mission-domain/src/mission-receipt.ts` and the `ReceiptType` enum in
`packages/mission-protocol/src/types.ts` are the authoritative sources. The
schemas in `schemas/` validate exactly those shapes — field-for-field, no
additional properties.

## Canonicalization rules (frozen)

1. **Canonical serialization** (`sortedStringify`): object keys sorted
   alphabetically, compact JSON, arrays serialized in order, `proposalVersion`
   serialized as a JSON integer (never a float). Mirrored by Go
   `sortedStringify` and Python `json.dumps(obj, sort_keys=True,
   separators=(",", ":"))`.
2. **`receiptHash`** = lowercase hex SHA-256 over the canonical serialization of
   `content` **only**. `protocolVersion`, `receiptType`, `algorithm`,
   `signerKeyId`, `signerPublicKey`, `signature`, `issuedAt`, and `receiptHash`
   itself never enter the hash.
3. **Signature payload** = the exact canonical serialization bytes (UTF-8) of
   `content` — identical to the string that is hashed. This is what makes
   signatures cross-language stable.
4. **Key formats**: public key = base64 DER SPKI (Ed25519 OID 1.3.101.112);
   private key = base64 DER PKCS8; signature = base64 raw Ed25519 (64 bytes).

These rules MUST NOT change. Every existing `receiptHash` and `signature` in
the repository is frozen.

## Key formats

- Public key: base64 DER SPKI — `serialization.load_der_public_key` (Python),
  `createPublicKey({ format: "der", type: "spki" })` (Node), Go DER parser.
- Signature: base64 raw Ed25519 (64 bytes → 88 base64 chars).

## Verification status vocabulary

| Status | Meaning | Local mapping |
| --- | --- | --- |
| `SIGNER_TRUSTED` | full trusted pass | `valid=true` |
| `VALID` | local-only pass (hash + signature) | `valid=true` |
| `UNKNOWN_SIGNER` | hash+sig valid, key not recognized | `valid=true` |
| `KEY_EXPIRED` | hash+sig valid, key not current | `valid=true` |
| `KEY_REVOKED` | hash+sig valid, key revoked | `valid=true` |
| `CONTENT_VALID` | hash valid, signature invalid | `valid=false`, `hashValid=true` |
| `PAYLOAD_TAMPERED` | hash invalid | `valid=false`, `hashValid=false` |

Local-only surfaces (Go, Python) assert the booleans and the local equivalence
mapping. Trusted-only statuses are asserted by surfaces implementing
`verifySignedReceiptTrusted` (TS).

## Fixtures

- `fixtures/conformance-vectors.v1.json` — canonical vector suite (generated
  once, committed static; regeneration is a maintenance operation and any
  drift MUST fail CI review).
- `fixtures/dev-keys.test-only.json` — fixed dev key pairs.

> [!WARNING]
> **TEST-ONLY material.** Dev keys under `fixtures/` are committed
> test fixtures. They are NOT operational credentials. Never load them in
> production code and never use them to sign real receipts.

## Regeneration command (maintenance only)

```bash
bun run scripts/conformance/generate-receipt-vectors.ts
```

The generator requires the dev-keys file to carry `classification:
"TEST-ONLY"`, uses fixed timestamps, and writes atomically only when explicitly
invoked. Running it MUST reproduce the committed bytes exactly (Ed25519 signing
is deterministic).

---

**Read next:** [Contracts index](../README.md) · [Drenyra AI README](../../README.md)
