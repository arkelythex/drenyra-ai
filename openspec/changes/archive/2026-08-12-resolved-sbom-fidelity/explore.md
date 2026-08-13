# Exploration — resolved-sbom-fidelity

> **Change:** `resolved-sbom-fidelity` · **Phase:** explore · **Scope:** read-only investigation. No source, test, CI, artifact, lock, or WIP file was modified.
>
> **Store:** OpenSpec. **Goal:** find the smallest safe way for the generated CycloneDX SBOM to represent the runtime dependencies **actually resolved by the Bun lockfile** — exact resolved versions and the real installed runtime set — instead of `package.json` declared ranges. This is the **explicit follow-up** to the `release-integrity-evidence` change, whose spec intentionally verified against declared ranges only and explicitly stated it "MUST NOT claim lockfile-resolved fidelity". This change flips that claim; it is independent and does **not** correct or retract the prior change's evidence.
>
> **CodeGraph:** no local `.codegraph` index was available; this exploration used targeted reads of the SBOM generator, verifier, checksum writer, Bun lockfile, package manifest, build script, CI workflow, and the prior change's OpenSpec artifacts rather than broad repository mapping. Full files were read, not partial hunks, so this is a faithful, evidence-backed mapping.

## Lead (what the SBOM ships today)

`scripts/sbom.mjs` reads `package.json` and emits `dist/sbom.json` (CycloneDX 1.5) whose `components` are the **declared runtime dependencies with their declared range strings as the `version`** (e.g. `ajv` → `"^8.17.1"`), `scope: "required"`. It is deterministic (no timestamp) and fail-closed on a malformed manifest. `scripts/verify-release-integrity.mjs` verifies only that the SBOM is parseable CycloneDX and that every declared runtime dependency appears as a component whose `version` **equals the declared range string**; it never reads `bun.lock`. So the SBOM's version field is a *declared range*, not the *resolved version* actually installed, and it lists only the 3 direct runtime deps — **none of the ~16 transitively installed runtime packages**. For a supply-chain consumer mapping installed packages to advisories, this is a fidelity gap: `^8.17.1` says nothing about which `ajv` was really installed (`8.20.0`), and a vulnerable transitive runtime dep would not appear at all.

## Evidence (root cause — fidelity gap)

| Evidence | File |
| --- | --- |
| SBOM derives name/version + declared runtime deps, emits declared range as component `version`. | `scripts/sbom.mjs` |
| Verifier asserts component `version` **equals the declared range** and never reads the lockfile. | `scripts/verify-release-integrity.mjs` |
| Prior spec pins "verification MUST NOT require lockfile-resolved versions and MUST NOT claim lockfile-resolved fidelity". | `openspec/changes/release-integrity-evidence/specs/release-integrity/spec.md` |
| Runtime deps resolved by lock: `ajv@8.20.0`, `ajv-formats@3.0.1`, `pg@8.23.0`; declared ranges are `^8.17.1`, `^3.0.1`, `^8.13.1`. | `bun.lock` (`packages`) vs `package.json` (`dependencies`) |
| Lockfile is text JSON (`lockfileVersion: 1`); `packages` is `name → [record]` with each record `["name@version", path, {dependencies, optionalDependencies, peerDependencies, …}, integrityHash]`. | `bun.lock` |
| Runtime transitive closure is resolvable and every runtime-reachable name has exactly one lock record (Bun dedupes). | `bun.lock` |

## Concrete findings that shape the smallest slice

### 1. The declared-range SBOM is a real fidelity defect, and the verifier enshrines it

- The current SBOM's `components[].version` is the declared range string; `verify-release-integrity.mjs` **asserts** `component.version === manifest.dependencies[name]`, i.e. it actively pins the range-as-version. Flipping to resolved fidelity therefore changes **both** the generator **and** the verifier, or verification would fail the new SBOM.
- Concrete mismatch example: `package.json` declares `"ajv": "^8.17.1"`; `bun.lock` resolves `ajv@8.20.0`. A consumer's advisory lookup against `^8.17.1` is not the version installed.

### 2. Bun lockfile structure supports a deterministic, fail-closed resolver

- `bun.lock` is a JSON text lock (`lockfileVersion: 1`), already sorted. Root workspace (`workspaces[""]`) mirrors declared `dependencies`/`devDependencies`; `packages` is `name → array<record>`.
- Each package record is `["name@version", path, {dependencies?, optionalDependencies?, peerDependencies?, optionalPeers?, os?, cpu?, bin?}, integrityHash?]`. Registry packages have `path === ""`.
- **Resolved version source of truth:** the `name@version` string in the record. A direct dep name (e.g. `ajv`) maps to a single record here (`ajv@8.20.0`).
- **Single-record-per-name invariant:** in this lock, every runtime-reachable name resolves to exactly one record (Bun dedupes). This makes a *unique-record-per-name* resolver deterministic with **no semver range engine required**. Fail closed if zero or more-than-one records exist for a runtime-reachable name (multi-version dedupe is an explicit non-goal; a future `bun.lock` with nested versions would need it).
- **Runtime closure = follow `dependencies` edges only.** `optionalDependencies` (e.g. `pg-cloudflare`), `peerDependencies`/`optionalPeers` (e.g. `pg-native`, not installed), and all `devDependencies` are excluded. Starting from the 3 direct runtime deps, this yields a closed, deterministic required-runtime set.

### 3. Concrete resolved runtime set (closure, required scope)

Direct (3): `ajv@8.20.0`, `ajv-formats@3.0.1`, `pg@8.23.0`.

Transitive via `dependencies` only (16): `fast-deep-equal@3.1.3`, `fast-uri@3.1.5`, `json-schema-traverse@1.0.0`, `require-from-string@2.0.2`, `pg-connection-string@2.14.0`, `pg-pool@3.14.0`, `pg-protocol@1.16.0`, `pg-types@2.2.0`, `pgpass@1.0.5`, `pg-int8@1.0.1`, `postgres-array@2.0.0`, `postgres-bytea@1.0.1`, `postgres-date@1.0.7`, `postgres-interval@1.2.0`, `split2@4.2.0`, `xtend@4.0.2`.

Total required runtime closure: **19 components**. Excluded as not-required: `pg-cloudflare@1.4.0` (optional dep of `pg`), `pg-native` (optional peer, not installed), and all dev-only packages (`@biomejs/*`, `typescript`, `vitest`, `vite`, `rolldown`, `postcss`, `lightningcss`, `nanoid`, …) which are unreachable from the runtime deps through `dependencies` edges.

### 4. Runtime-usage nuance (don't overclaim)

- `ajv` and `ajv-formats` are value-imported by the production CLI (`cmd/commands/receipt-verify.ts`). ✓ runtime.
- `pg` is declared a runtime dependency and resolved by `bun.lock`; its production adapter (`missions/store.postgres.ts`) imports `pg` **type-only** (`import type { Pool }`); the value is constructed by consumers. `pg` is still lockfile-resolved and shipped at runtime, so it belongs in the runtime SBOM — but this slice reports **lockfile-resolved** runtime deps, **not** static import-graph *usage* fidelity. A future import/bundle-graph slice is a different concern (non-goal).

### 5. Direct-vs-transitive separation

- Keep the CycloneDX `dependencies` root edge to the **direct** runtime deps (unchanged shape), and tag each component's resolution with a `properties` entry, e.g. `drenyra:resolution = direct | transitive`, `scope: "required"`. This cleanly separates direct from transitive without overclaiming that transitives are direct.
- Dev/optional/peer are **absent** from components — explicitly separated by exclusion, not lumped.

### 6. Determinism, fail-closed, ownership

- No wall-clock input: `bun.lock` + `package.json` are deterministic inputs; sort components by name and dependency edges. Reuse the existing `dirname(fileURLToPath(import.meta.url))` root convention.
- Fail closed (exit 1, clear message) on: missing/unreadable `bun.lock`, zero or >1 records for a runtime-reachable name, and (defensive) a direct dep whose resolved version does not satisfy the declared range — a minimal satisfier (exact/caret/tilde/`*`) is a hardening guard, **trimmable if the budget binds**.
- `dist/sbom.json` stays a generated, uncommitted artifact shipped via `files: ["dist"]`; regenerated at release. No committed SBOM, so migration is a regenerate, and old declared-range SBOMs fail the new verifier (acceptable: dist is never committed).

### 7. Lockfile↔manifest consistency guard

- The current invariant is `bun install --frozen-lockfile` in CI (`ci.yml`), so `package.json` and `bun.lock` are always consistent. The resolver MUST additionally assert that the lock's root `workspaces[""].dependencies` names match `package.json` `dependencies` names, failing closed on drift. This prevents a wrong resolved version if the two ever diverge.

## First slice recommendation (bounded, ≤300 authored lines, strict TDD)

**Slice — "Lockfile-resolved runtime SBOM (exact versions + transitive runtime closure)."**

Represent the runtime dependencies actually resolved by `bun.lock`: exact resolved versions for direct runtime deps, plus the resolved transitive runtime-only closure, tagged `direct | transitive` and `scope: required`; verifier recomputes the same closure from `bun.lock` and asserts exact-version fidelity and coverage. Dev/optional/peer remain excluded. All behind strict TDD.

### Work units (proposed shape for the tasks phase)

| Unit | Change | Est. lines | Test evidence |
| --- | --- | --- | --- |
| **S1 — lockfile resolver** | New `scripts/lib/bun-lockfile.mjs`: parse `bun.lock`; resolve each runtime-reachable name to its unique locked version (fail closed on zero/>1 records); compute runtime-only transitive closure following `dependencies` edges; assert root `dependencies` names match `package.json`; optional compact satisfier guard for direct deps. | ~120 | RED: fixture `bun.lock` + `package.json`; resolve direct → exact version; closure excludes optional/dev; fail closed on missing/multi-record. |
| **S2 — generator** | `sbom.mjs`: emit resolved-exact components (`scope: required`, `properties.drenyra:resolution = direct|transitive`), root→direct dependency edge, determinism (sorted, no clock). | ~30 | RED: `sbom.json` components carry resolved versions, transitive present, optional/dev absent, byte-identical across runs. |
| **S3 — verifier** | `verify-release-integrity.mjs`: import the resolver, recompute expected resolved closure from `bun.lock`, assert exact-version + coverage + direct/transitive separation; fail closed on any drift. | ~35 | RED: mismatch a resolved version or omit a transitive → verify fails naming it. |
| **S4 — tests + TRIANGULATE + evidence** | Extend `scripts/__tests__/release-integrity.test.ts` with a fixture lockfile and the new cases; run focused + full suite, typecheck, `verify:package`; record exact results; confirm authored diff <300 and no non-goal path touched. | ~90 | All green; budget counted; rollback boundary recorded. |

**Est. authored changed lines: ~250–275** (under 300). If the satisfier guard pushes over, drop it (documented as hardening follow-up) — it is defensive only.

### Why this slice first

- Directly fixes the fidelity defect (range-as-version → resolved version) **and** adds the actual installed runtime set (transitive closure), which is the core supply-chain value.
- Deterministic and fail-closed with no new machinery beyond one small shared resolver module; no domain logic, no frozen contracts, no lockfile/package/CI edits.
- Stays entirely in the release/package layer the prior slice already owns, so it is independently reviewable and rollback-safe.

## Non-goals (explicit for this change / first slice)

- **No static import-graph / bundle-graph *usage* fidelity** (which packages are actually `import`ed at runtime). This slice reports lockfile-resolved runtime deps, not usage.
- **No optional/platform/peer component representation** (`pg-cloudflare`, `pg-native`, `@biomejs/*` platform binaries, `fsevents`, …). Optional and peer deps are excluded; representing them with `scope: optional` is a follow-up.
- **No dev-dependency SBOM surface.** Dev deps are excluded entirely; a separate dev SBOM (or `scope: excluded` dev listing) is a follow-up.
- **No full per-package transitive edge graph.** The `dependencies` root→direct edge is kept; enumerating every transitive edge is a follow-up to avoid budget creep.
- **No multi-version dedupe** (a name resolving to >1 lock record): fail closed in slice 1; a semver-resolution pass is a follow-up if the lock ever nests versions.
- **No CI/workflow, package.json, package/lock, or signed-artifact change.** No new runner/job. Signing remains out of scope.
- **No edit of prior `release-integrity-evidence` artifacts** or any blocked/WIP path. This is additive and independent.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Budget approaches 300 with the satisfier guard + transitive closure | Medium | Keep `scripts/lib/bun-lockfile.mjs` tight; drop the satisfier guard (defensive only) if it binds; per-package edges already deferred. |
| `bun.lock` later nests multiple versions of one runtime name (dedupe breaks single-record assumption) | Medium | Fail closed on >1 records in slice 1 and name multi-version resolution as a follow-up; CI uses frozen install so package↔lock consistency keeps single-record valid today. |
| Old declared-range `dist/sbom.json` fails the new verifier | Low | `dist/` is generated and never committed; regenerated at release. Document as a regenerate, not a migration. |
| Runtime closure drift if `package.json` deps change | Low | Root `dependencies`-name match guard + recompute-in-verifier keep generator and verifier in lockstep. |
| Scope creep into usage-graph or optional/dev SBOM | Medium | Explicit non-goals above; tasks keep the boundary to lockfile-resolved required runtime closure. |

## Rollback strategy

Fully reversible, one bounded work unit: delete `scripts/lib/bun-lockfile.mjs`, revert `scripts/sbom.mjs` and `scripts/verify-release-integrity.mjs` to their pre-slice bytes, and revert the test additions. No `package.json`, `bun.lock`, CI, or committed artifact changes, so rollback touches only the three script files + tests. `dist/` is gitignored; the regenerated SBOM is not a rollback surface. No coordination with another active change is required.

## Next recommended phase

`proposal` → `spec` → `design` → `tasks` for **this first slice** (lockfile-resolved runtime SBOM with exact versions + transitive runtime closure), keeping usage-graph fidelity, optional/platform/dev representation, per-package edge graphs, and multi-version dedupe as explicit later slices. Do **not** route this into `release-integrity-evidence` or `gentle-ai-quality-parity` — this is an independent change that flips the prior declared-ranges-only claim.
