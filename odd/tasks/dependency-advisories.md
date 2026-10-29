# Feature: dependency-advisories

**Objective:** close the 13 open Dependabot alerts on `main` by updating the vulnerable resolutions in `bun.lock`, which CI installs, and by refreshing `package-lock.json`, the alert mirror. No dependency range is widened beyond what the fix needs, and no runtime source changes.
**Branch:** `chore/dependency-advisories`
**Gates:** `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`.

## Specs

- **S1** — Owner: "perfect te autorizo todo y continua de forma autonoma", after being told "Si querés, lo arranco como feature propia" about "13 vulnerabilidades de dependencias en `main` de drenyra-ai (2 altas)".
- **S2** — Every open alert's package resolves at or above its first patched version in both `bun.lock` and `package-lock.json`: `fast-uri` ≥ 3.1.9 (alerts 19–22), `source-map-js` ≥ 1.2.2 (10), `vite` outside `>= 8.3.0, <= 8.3.2` (11–16), and `@vitest/mocker` ≥ 5.0.3 (17–18).
- **S3** — `vitest` and `@vitest/coverage-v8` move together, as a lockstep pair (`35fa981`), superseding Dependabot #119 and #121.
- **S4** — `package-lock.json` is refreshed with the documented command `npm install --package-lock-only --ignore-scripts` (`.github/dependabot.yml`).
- **S5** — The published package's dependency ranges stay unchanged. CHANGELOG records the change, and its effect on consumers is stated.
- **S6** — Gates green; one PR; the alerts are observed closed after merge.

## Tasks

- [x] **T1** — Update the vulnerable resolutions in `bun.lock` (vitest pair plus the transitive packages). *(S2, S3)*
- [x] **T2** — Refresh the `package-lock.json` mirror; verify both lockfiles against S2. *(S2, S4)*
- [ ] **T3** — CHANGELOG, gates, PR, merge, observe the alerts closed. *(S5, S6)*

## Log

### L1 — 2026-10-28 — request (verbatim)

> perfect te autorizo todo y continua de forma autonoma

### L2 — 2026-10-28 — diagnosis

- 13 open alerts across 4 packages, all `transitive`. Runtime: `fast-uri` through `ajv` (the CLI's schema validator). Development: `vite`, `source-map-js`, `@vitest/mocker` (the vitest chain).
- Dependabot uses the `bun` ecosystem (`.github/dependabot.yml`), and its PRs #119/#121 edit only `bun.lock`. Alerts come from `package-lock.json`, the mirror kept because GitHub's dependency graph does not read bun. That mirror was last refreshed in `792bc46` (2026-09-18); `7fe19f0` changed only its root version.
- Resolutions before the change. In `bun.lock`: `fast-uri` 3.1.8, `source-map-js` 1.2.1, `@vitest/mocker` 5.0.1, `vite` 8.2.1. In `package-lock.json`: the same, except `vite` 8.3.0. So `bun.lock`, the installed tree, is also vulnerable for three packages; for `vite`, only the mirror is in the vulnerable range.
- Consumers of the published package resolve `ajv`'s `fast-uri ^3.0.1` themselves, so a fresh install already gets ≥ 3.1.9. The fix is in this repository's resolutions, not in a published range.

### L3 — 2026-10-28 — T1/T2 evidence

- T1: `bun add -d vitest@^5.0.5 @vitest/coverage-v8@^5.0.5` and `bun update fast-uri source-map-js` (bun 1.4.0). In `bun.lock`, only the vitest dev chain and `fast-uri` moved. The vitest chain includes two majors that vitest 5.0.5 requires: `obug` 2→3 and `why-is-node-running` 2→3. Resolved: `fast-uri` 3.1.9, `source-map-js` 1.2.2, `@vitest/mocker` 5.0.5, `vite` 8.2.1 (unchanged, outside the range).
- T2: `npm install --package-lock-only --ignore-scripts` kept the locked `fast-uri` 3.1.8, because a lock-only install does not move an existing resolution. `npm update fast-uri --package-lock-only --ignore-scripts` then moved it to 3.1.9. The mirror resolves `fast-uri` 3.1.9, `vite` 8.3.5, `source-map-js` 1.2.2, `@vitest/mocker` 5.0.5. `npm audit --package-lock-only` reports `found 0 vulnerabilities`. The mirror diff is large (+198/−216) because it carries the drift since `792bc46`.

### L4 — 2026-10-28 — gates

One `set -euo pipefail` run exited 0. `bun install --frozen-lockfile`: no changes. Typecheck: clean. Lint: 188 files. `verify:package`: 113 files and 1510 tests passed under vitest 5.0.5, package files OK, release integrity OK (checksums and SBOM). `verify-packed-install`: OK. `git diff --check`: clean.
