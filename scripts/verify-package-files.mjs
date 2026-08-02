/**
 * drenyra-ai package verification — checks the built dist/ tree and the
 * packaged manifest BEFORE the artifact is published. Fails (exit 1) on any
 * missing file or wrong shebang, so a broken package never reaches npm.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit codes are JSON integers, never floats.
 */

import { accessSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];

function check(relativePath, predicate, message) {
  const full = join(root, relativePath);
  try {
    accessSync(full);
  } catch {
    errors.push(`missing: ${relativePath}`);
    return;
  }
  if (predicate && !predicate(full)) {
    errors.push(message ?? `invalid: ${relativePath}`);
  }
}

check("dist/cmd/cli.js", (p) => {
  const first = readFileSync(p, "utf8").split("\n")[0];
  return first.startsWith("#!/usr/bin/env node");
}, "dist/cmd/cli.js must start with #!/usr/bin/env node");

for (const entry of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/receipts/index.js",
  "dist/ledger/index.js",
  "dist/missions/index.js",
  "dist/candidates/index.js",
  "dist/review/index.js",
  "dist/cmd/commands/mission-apply.js",
]) {
  check(entry, undefined, undefined);
}

// Declarations exist for library consumers.
for (const entry of ["dist/receipts/index.d.ts", "dist/missions/index.d.ts"]) {
  check(entry, undefined, undefined);
}

// Contracts + conformance fixtures ship in the package.
check("contracts/receipt-schema/fixtures/conformance-vectors.v1.json", undefined, undefined);
check("contracts/receipt-schema/schemas/signed-receipt.schema.json", undefined, undefined);
check("contracts/ledger.md", undefined, undefined);

if (errors.length > 0) {
  console.error("verify-package-files: FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("verify-package-files: OK (dist tree + packaged files complete)");
