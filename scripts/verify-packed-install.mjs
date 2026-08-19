/**
 * drenyra-ai packed-install verification.
 *
 * Proves the PUBLISHED artifact works, not just the source tree:
 *   1. bun pack → produces the .tgz exactly as npm would publish it
 *   2. npm installs the .tgz into a clean temp dir
 *   3. the installed bin runs under plain Node (no Bun, no loader) and exits 0
 *   4. the installed library entry resolves under Node
 *
 * This is the test that catches "source works, packaged artifact broken"
 * regressions (missing files, wrong shebang, unresolved imports).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; exit codes are JSON integers, never floats.
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let pkg;
try {
  pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch (error) {
  console.error(
    `verify-packed-install: unreadable package.json (${error instanceof Error ? error.message : String(error)})`,
  );
  process.exit(1);
}

const tgzName = `drenyra-ai-${pkg.version}.tgz`;
// Nested npm commands must not inherit the outer npm's config. In
// particular, `npm publish --dry-run` injects npm_config_dry_run=true into
// the prepublishOnly/prepack lifecycle, which would silently turn the inner
// `npm pack` into a no-op and make the packed-install probe fail on a
// missing tarball. Scrub the inherited npm_config_* surface so the probe
// reflects a real top-level npm invocation, not a masked one.
const npmEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("npm_config_")),
);
const work = mkdtempSync(join(tmpdir(), "drenyra-ai-pack-"));
const failures = [];

try {
  console.log("pack: npm pack");
  execSync(`npm pack --pack-destination ${work}`, { cwd: root, stdio: "inherit", env: npmEnv });

  console.log("install: npm install --no-save the tgz into a clean dir");
  const installDir = mkdtempSync(join(tmpdir(), "drenyra-ai-install-"));
  execSync(`npm install --no-save --no-package-lock --prefix ${installDir} ${join(work, tgzName)}`, {
    cwd: root,
    stdio: "pipe",
    env: npmEnv,
  });

  const binPath = join(installDir, "node_modules", ".bin", "drenyra-ai");
  try {
    console.log("run: node node_modules/.bin/drenyra-ai --help");
    execSync(`node ${binPath} --help`, { cwd: installDir, stdio: "inherit" });
    console.log("packed-install: bin runs under Node — OK");
  } catch {
    failures.push("packed bin did not run under plain Node");
  }

  const libPath = join(installDir, "node_modules", "drenyra-ai", "dist", "index.js");
  try {
    console.log("resolve: library entry under Node");
    const probe = `node -e "import('file://${libPath}').then(m => { if (!m.verifySignedReceipt) process.exit(1); console.log('packed-install: library entry resolves — OK'); }).catch(e => { console.error(e); process.exit(1); })"`;
    execSync(probe, { cwd: installDir, stdio: "inherit" });
  } catch {
    failures.push("packed library entry did not resolve under Node");
  }

  const manifestPath = join(
    installDir,
    "node_modules",
    "drenyra-ai",
    "dist",
    "promoted-composition.json",
  );
  try {
    console.log("manifest: installed dist/promoted-composition.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const keys = Object.keys(manifest).sort().join(",");
    if (keys !== "attestationTag,hostArtifactSha256,setSha256,verifiedRevision,version") {
      failures.push("installed promoted-composition.json is not the five-key manifest");
    } else {
      console.log("packed-install: promoted-composition.json present and five-key — OK");
    }
  } catch {
    failures.push("installed dist/promoted-composition.json is missing or invalid");
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("verify-packed-install: FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("verify-packed-install: OK");
