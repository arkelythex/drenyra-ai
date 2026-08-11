/**
 * Canonical serialization — the byte contract shared by every runtime.
 *
 * Ported verbatim from arkelythex/drenyra-command-center `packages/mission-domain/src/mission-receipt.ts`.
 * Mirrored by Go `sortedStringify` and Python `json.dumps(obj, sort_keys=True,
 * separators=(",", ":"))`; MUST NOT change.
 */

/**
 * Serialize an object with keys sorted alphabetically.
 * Shallow: only the top-level key order is canonicalized; nested arrays and
 * objects keep their original serialization order.
 */
export function sortedStringify(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}
