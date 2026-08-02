/**
 * drenyra-ai build script.
 *
 * 1. Compiles the TypeScript sources to dist/ (ESM, NodeNext) with declarations.
 * 2. Patches the emitted CLI shebang from `bun` (dev) to `node` (distributed
 *    artifact), so the packaged bin runs on Node >= 22 without a loader.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit/status codes are JSON integers, never
 * floats.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(root, "dist", "cmd", "cli.js");

console.log("build: compiling with tsc -p tsconfig.build.json");
execSync("bunx tsc -p tsconfig.build.json", { cwd: root, stdio: "inherit" });

const cliSource = readFileSync(cliPath, "utf8");
const patched = cliSource.replace(/^#!.*$/m, "#!/usr/bin/env node");
if (patched === cliSource) {
  console.error("build: WARNING dist/cmd/cli.js has no shebang to patch");
} else {
  writeFileSync(cliPath, patched);
  console.log("build: dist/cmd/cli.js shebang -> #!/usr/bin/env node");
}

console.log("build: done");
