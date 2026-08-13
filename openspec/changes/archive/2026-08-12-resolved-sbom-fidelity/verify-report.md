```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0c80a1f853bdbf59dd27625758d78b5b2858f0f03513260c7ea102bf18e29875
verdict: pass
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 41/41
test_command: bunx vitest run scripts/__tests__/release-integrity.test.ts
test_exit_code: 0
test_output_hash: sha256:4b3e0967c592fb0a49ed0ba20f4439de2caf78f55ec03c7579bc3b09ee882e2f
build_command: bun run typecheck
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verify Report — Resolved SBOM Fidelity, Slice A

## Verdict

**PASS** — ready to archive. All 10 spec requirements verified against the committed implementation (HEAD `293523d`), all 27/27 task rows checked, strict TDD evidence present and corroborated, budget 274/300 within caps, path audit confined to the four allowlisted files, no scope creep, no blockers.

## Structured status and actionContext

- Artifact store: `openspec` (change artifacts under `openspec/changes/resolved-sbom-fidelity/`). Native status (`gentle-ai sdd-status resolved-sbom-fidelity --cwd . --json` per parent) marks `verify: ready`; all tasks complete. Engram HTTP server was unreachable in earlier runs (`http://127.0.0.1:7437`); file store authoritative and complete (attempted again this run — see Engram section).
- `actionContext`: no workspace-planning mode, no edit-root constraints; edits confined to the change's four-file allowlist. No warnings.
- Lifecycle: RDD is clone-locally disabled by explicit user authorization (Pi cannot provide immutable review transport); **no review lifecycle was invoked** this run, per instruction. Delivery proceeds under ordinary repository policy, which passed. No source file, task, commit, or archive state was modified by this verify run.

## Spec coverage (per requirement, spec `specs/release-integrity/spec.md`)

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Bun Lockfile v1 Parse and Validation | **PASS** | Resolver (`scripts/lib/bun-lockfile.mjs`) validates `lockfileVersion: 1`, record tuple shape, string-map fields, `optionalPeers: string[]`; table-driven tests cover missing/unreadable/invalid lock, unsupported version, malformed tuple/maps. Real lock parsed cleanly (19-node closure). |
| 2 | Root Dependency Consistency Guard | **PASS** | Exact name-set comparison between `workspaces[""].dependencies` and `package.json` `dependencies`; drift test (`nope` added) fails naming drift. |
| 3 | Unique Record Resolution | **PASS** | Name-prefix version extraction (`${name}@` removal, no `@`-split); zero/>1 record fail-closed (`missing record`, `ambiguous records` cases). |
| 4 | Required-Runtime Closure over Dependencies Edges | **PASS** | `dependencies`-only traversal; real repo closure = 19 components exactly as spec asserts; optional/peer/optional-peer/dev excluded (`pg-cloudflare`, `pg-native`, dev-only absent); branched+cyclic dedup test green. |
| 5 | Exact Resolved Component Emission | **PASS** | Components carry exact locked versions; SBOM spot-check: `bomFormat: CycloneDX`, `specVersion: 1.5`, 19 components, all `type: library` + `scope: required`, **no range strings** (`^`/`~`/`>=` absent); root `bom-ref: drenyra-ai`, `version: 0.2.0`. |
| 6 | Direct/Transitive Classification | **PASS** | Exactly one `drenyra:resolution` per component, values `direct` (ajv, ajv-formats, pg) / `transitive`; exclusive and deterministic (byte-identical across generations). |
| 7 | Deterministic Closed Dependency Graph | **PASS** | 20 entries (root + 19 nodes) including leaves; root entry `dependsOn: ["ajv","ajv-formats","pg"]` sorted; sorted refs/lists; zero dangling refs; verifier rejects missing/extra/duplicate edges and duplicate entries. |
| 8 | Deterministic Output | **PASS** | Two generations from identical inputs byte-identical: SHA-256 `657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce` both runs; no wall-clock data. |
| 9 | Verifier Parity by Independent Recompute | **PASS** | Verifier recomputes the contract via the shared resolver and rejects every drift class: missing/extra component, wrong version/scope/classification, missing/extra/duplicate edge, duplicate entry/component, dangling ref, malformed SBOM — all asserted by drift-class test. Runs before preserved checksum verification. |
| 10 | Fail-Closed Generation | **PASS** | Missing `dist/` fails naming the directory; atomic temp-write + rename, temp cleanup, no partial overwrite (existing no-partial-output tests active). |
| 11 | Optional Range-Satisfaction Hardening (MAY) | Omitted | Explicitly permitted to omit under the line budget; nothing else weakened. |
| 12 | TDD, Budget, Path-Audit, Rollback Boundaries | **PASS** | See TDD compliance, budget, and path-audit sections below. |

## Task completion status

All **27/27** task rows in `openspec/changes/resolved-sbom-fidelity/tasks.md` are `- [x]`. **No unchecked `- [ ]` implementation task markers remain.** The two Task 8 parent-owned rows (bounded review + delivery gate) were flipped post-apply by the parent and are consistent with the apply-progress "Lifecycle resolution" section; the only working-tree tasks.md diff is exactly those two flips.

## Test / validation commands (run this verify pass)

| Command | Result |
|---|---|
| `bunx vitest run scripts/__tests__/release-integrity.test.ts` | **12/12 passed** (1 file) |
| `node scripts/sbom.mjs && node scripts/checksums.mjs && node scripts/verify-release-integrity.mjs` (real repo) | 19 components; 425 checksummed files; `verify-release-integrity: checksums and SBOM verified`; **exit 0** |
| Two generations from identical inputs (`node scripts/sbom.mjs` ×2, 1s apart) | byte-identical, SHA-256 `657ea86f8d7b824e8a361e0a8cc8aa121ae41a74a098b6cbb4e9ac3583ed37ce` |
| `bun run typecheck` (tsc --noEmit) | **exit 0** |
| `bun run test` (full suite, vitest 4.1) | **668 passed / 3 failed** (671 tests, 54 files) — see baseline distinction |
| SBOM structural spot-check (node one-liner) | 19 components, CycloneDX 1.5, all `scope: required`, single `drenyra:resolution` each, no range strings, no dangling refs, direct = ajv, ajv-formats, pg |

## Known baseline distinction

The 3 full-suite failures are all in `cmd/__tests__/cli.test.ts` (mission apply/real-handler lifecycle tests). `openspec/config.yaml` documents "3 pre-existing failures in cmd/**tests**/cli.test.ts as of this init"; the apply-progress recorded a `git stash -u` differential at HEAD showing the identical 3 failures. The failing file does not import or exercise any of the four changed `scripts/` paths. **Unchanged, unrelated, documented as pre-existing — not fixed, not hidden, not caused by this change.**

## Strict TDD compliance (strict_tdd: true)

- **TDD Cycle Evidence table**: present in `apply-progress.md` (RED / GREEN / TRIANGULATE / REFACTOR), with RED authored before production changes, preserved and validated by the corrective run. ✅
- **RED confirmed (tests exist)**: `scripts/__tests__/release-integrity.test.ts` exists, extends the existing mini-repo harness; the four fidelity tests assert exact locked versions, complete deduplicated closure, exclusions, classification/scope, closed sorted graph, byte determinism, every verifier drift class, and every resolver fail-closed class — behaviors the pre-slice direct-only/declared-range generator could not satisfy. ✅
- **GREEN confirmed (tests pass on execution)**: 12/12 pass, verified by re-run this pass. ✅
- **TRIANGULATE adequate**: branched shared-transitive dedup, cyclic graph, malformed record/map, `optionalPeers` non-array rejection, missing/ambiguous records, root drift, unsupported version, missing lock — multi-case per behavior with differing expected values. ✅
- **Safety net**: 8 pre-existing suite cases (checksum, cwd-independence, no-partial-output, traversal/duplicate rejection) remain active and green; the file was extended, not replaced. ✅
- **REFACTOR**: documented (sbom.mjs 64→35, tests 125→109) with suite re-runs after each compression; behavior unchanged (this pass re-verified the final bytes). ✅

### Assertion quality audit

Scanned the changed test file against banned patterns: **no tautologies, no orphan empty-only assertions, no type-only-alone assertions, no ghost loops** (the `for` loops iterate hardcoded fixture arrays or are backed by exact `toEqual` pins of the same arrays), no smoke-only tests, no implementation-detail/CSS assertions, **zero `vi.mock`** (all tests spawn the real scripts). **✅ All assertions verify real behavior.**

### Test layer distribution

Unit/integration (script-level) across 1 file `scripts/__tests__/release-integrity.test.ts` (12 tests) — the project's configured layers for this slice; no integration/E2E tools configured (`layers.integration: true` is script-level here, no browser/HTTP tools needed). Coverage tool not configured (`coverage.available: false`) — coverage analysis skipped, not a failure.

## Review workload / PR boundary

- Forecast (tasks.md): ~250–290 estimated, `400-line budget risk: Low`, `Chained PRs recommended: No`, `Decision needed before apply: No`, delivery `single-pr`, chain `size-exception`.
- Actual: **274 changed lines (237+ / 37−)** in a single commit `293523d` — matches forecast, single PR, no chaining. Size exception not needed (274 ≤ 300).
- Scope creep: **none**. Commit diff confined to the four allowlisted `scripts/` paths plus the change's own `openspec/changes/resolved-sbom-fidelity/` artifacts. `package.json`, `bun.lock`, CI, `dist/` (gitignored), checksum/signature surfaces, and unrelated modules untouched.

## Scope / budget check

| File | Cap | Actual |
|---|---|---|
| `scripts/lib/bun-lockfile.mjs` (new) | 80 | 80 |
| `scripts/sbom.mjs` | 35 | 35 |
| `scripts/verify-release-integrity.mjs` | 65 | 50 |
| `scripts/__tests__/release-integrity.test.ts` | 110 | 109 |
| **Total** | **≤300** | **274** |

Per-file caps respected; total under the hard 300 ceiling; no size exception. Path audit (`git diff 293523d~1 293523d --name-only`): only the four allowlisted paths outside `openspec/`. Rollback boundary: revert/remove the four allowlisted paths as one unit; regenerated `dist/sbom.json` is not a rollback surface.

## Ordinary-policy lifecycle record

- Native attempt settle (exactly once, this run): token `sha256:f6661245d3abcb206c5a3bd58f159a06f02f4c8b2da5a9e6ecdb6fc87dd7b41d`, work unit `final-sbom-verification`, request id `settle-resolved-sbom-verify-20260812-1`, outcome `passed`, evidence revision `sha256:0c80a1f853bdbf59dd27625758d78b5b2858f0f03513260c7ea102bf18e29875` (sha256 over the four verified allowlisted files at HEAD), harness `reused`, cleanup: no temp artifacts. Settle result: **`state: complete`**.
- RDD: clone-locally disabled by explicit user authorization; review lifecycle not invoked, not re-enabled. Delivery under ordinary repository policy **passed**.
- No commit, push, source modification, task edit, or archive action performed by this verify run.

## Engram persistence

`mem_save` for topic `sdd/resolved-sbom-fidelity/verify-report` attempted; if the Engram HTTP server is unreachable (as in prior apply runs), the OpenSpec file store remains authoritative and complete.

## Exact blockers

None.
