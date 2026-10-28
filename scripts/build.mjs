/**
 * drenyra-ai build script.
 *
 * 1. With `--clean`, removes dist/ first, so a release build starts from an
 *    empty output tree: `npm pack` ships whatever dist/ holds, and a stale
 *    file there is published (#126). `verify:package` (run by `prepack`)
 *    passes `--clean`. The plain build used by `prepare` stays additive on
 *    purpose: npm runs `prepare` AFTER `prepack`, and cleaning there would
 *    delete the `release:generate` outputs `prepack` just wrote to dist/.
 * 2. Compiles the TypeScript sources to dist/ (ESM, NodeNext) with declarations.
 * 3. Patches the emitted CLI shebang from `bun` (dev) to `node` (distributed
 *    artifact), so the packaged bin runs on Node >= 22 without a loader.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit/status codes are JSON integers, never
 * floats.
 */

import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distPath = join(root, "dist");
const cliPath = join(distPath, "cmd", "cli.js");

if (process.argv.includes("--clean")) {
  rmSync(distPath, { recursive: true, force: true });
  console.log("build: removed dist/ (--clean)");
}

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
