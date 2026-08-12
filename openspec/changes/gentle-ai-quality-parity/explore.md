# Exploration — gentle-ai-quality-parity

> **Change:** `gentle-ai-quality-parity` · **Phase:** explore · **Scope:** read-only investigation; no product code, tests, docs, or worktree slice were modified.
>
> **Goal:** identify concrete quality gaps that move drenyra-ai toward the engineering standard demonstrated by Gentle AI — without cloning Gentle AI's domain-specific features. Evidence-led audit of architecture, test strategy/reliability, contract rigor, CLI/MCP/operational resilience, security/fail-closed behavior, package/release integrity, developer workflow, and quality gates.
>
> **Store:** OpenSpec · Engram unavailable (per orchestrator). Baseline failures and pre-existing WIP are distinguished from attributable gaps below.

## Lead

**drenyra-ai is already an unusually disciplined codebase for its pre-alpha stage: six frozen contracts with conformance suites that fail CI on drift, a strict-TDD convention, an atomic file store, fail-closed gates, adversarial security tests, packed-install verification, and a deliberate layered architecture with an import-boundary scanner.** It is NOT a quality-deficient repository. The gaps this program should close are concentrated in **declared-surface consistency, single-source-of-truth for runtime facts, and release-gate completeness** — the "operational honesty" layer where Gentle AI is strongest — not in the fiscal domain logic, which is already contract-pinned.

Everything below is mapped to concrete file/symbol evidence. No recommendation copies Gentle AI machinery; each closes a real, reproducible drift or resilience hole in this repo.

## Baseline and pre-existing state (distinguished — NOT attributable gaps)

| Item | Evidence | Disposition |
| --- | --- | --- |
| **3 failing tests** in `cmd/__tests__/cli.test.ts` | Baseline `bun run test` has 3 failures in the CLI command suite (per orchestrator). | **Baseline failure, pre-existing.** Out of scope: not attributable to a new quality gap; do not fold into this change's acceptance evidence. |
| **WIP: `missions/__tests__/postgres.integration.test.ts`** | Real-PostgreSQL suite that connects via `DATABASE_URL` or `localhost:54329` and silently returns when DB unreachable (`if (!available) return;`). | **Pre-existing WIP.** Leave untouched. |
| **WIP: `skills/__tests__/pe-skills.test.ts`** | Pins `BASE_PE_SKILLS` length/checksum/jurisdiction/IDs. | **Pre-existing WIP.** Leave untouched. |
| **WIP: `openspec/changes/fiscal-authority-kernel/apply-progress.md`** | Documents tenant-core/isolation split, 488-test baseline, PAUSED decision. | **Pre-existing WIP.** Leave untouched. |
| **WIP: `openspec/programs/drenyra-dominion/capability-matrix.yaml`** | Program-wide capability matrix, `tests: 640`. | **Pre-existing WIP.** Leave untouched. |
| Version-literal test expectations | `mcp/__tests__/server.test.ts`, `stdio.test.ts` construct `new McpServer({ version: "0.2.0" })`. | **Baseline convention**, but the hardcoding is the *symptom* of the attributable version-drift gap below; tests must be updated WITH the fix in the same work unit. |

## Current-state gap — attributable quality gaps (evidence)

### G1. Runtime version is not single-sourced; MCP reports a stale/hardcoded version

| Evidence | File |
| --- | --- |
| MCP server tools hardcode `version: "0.2.0"` in the tool handler result. | `mcp/tools.ts:31` (`capabilitiesTool` returns `version: "0.2.0"`) |
| MCP server info hardcodes `version: "0.2.0"`. | `cmd/commands/mcp-serve.ts:24`, `mcp/__tests__/server.test.ts:5`, `mcp/__tests__/stdio.test.ts:11` |
| In contrast, the CLI reads the version from `package.json`. | `cmd/commands/capabilities.ts` (`runtimeVersion()` via `createRequire`), `cmd/commands/install.ts` (`version()`), `cmd/commands/doctor.ts` (`packageInfo()`) |

**Why it matters (Gentle AI standard):** the CLI (`capabilities`, `doctor`, `install`) and the MCP surface (`capabilities` tool, server info) report the runtime version through *two different mechanisms*. The next version bump will update `package.json` and the CLI surfaces automatically, but the MCP surface and its tests will silently keep reporting the previous version. An agent host that negotiates `serverInfo.version` over MCP will bind to a stale version. This is a single-source-of-truth failure of the exact kind Gentle AI's version-pinned runtime discipline prevents.

### G2. Declared capability surface is duplicated and can drift between CLI and MCP

| Evidence | File |
| --- | --- |
| The six frozen contracts are declared as literal arrays in **two** places with no shared source. | `cmd/commands/capabilities.ts` (contracts array) and `mcp/tools.ts` (`capabilitiesTool`) |
| Jurisdictions `["PE"]` and `adapters: []` are duplicated in both surfaces. | `capabilities.ts`, `mcp/tools.ts` |
| The two surfaces already disagree on version sourcing (G1) and on shape: CLI exposes `skills` + `integrations`; MCP tool exposes neither. | `capabilities.ts` vs `mcp/tools.ts` |

**Why it matters:** two parallel declarations of the same "what do I declare" truth means a contract rename, a new frozen contract, or an adapter becoming available updates one surface and not the other, and nothing fails. There is currently no test asserting the CLI capabilities and MCP capabilities agree. A single declared-surface module consumed by both, plus a drift-guard test, closes this.

### G3. `doctor` validates contracts against `process.cwd()`, so it falsely reports missing contracts from a non-root directory

| Evidence | File |
| --- | --- |
| `resolve(process.cwd(), "contracts")` resolves the frozen contract files relative to the current working directory, not the package root. | `cmd/commands/doctor.ts:68` |

**Why it matters:** `drenyra-ai doctor` is a read-only health check that is expected to be robust from any directory (Gentle AI's `doctor` is cwd-independent). Run from a subdirectory of the project, it reports the six frozen contracts as missing and exits 1 — a false negative. The test suite only exercises it from the repo root (`cmd/__tests__/capabilities-doctor.test.ts`), so the bug is latent. Contracts should resolve relative to the installed package, matching how `capabilities.ts`/`install.ts` resolve `package.json`.

### G4. Release-integrity scripts (checksums, SBOM) are not wired into CI or the package pipeline

| Evidence | File |
| --- | --- |
| `scripts/checksums.mjs` (SHA-256 manifest) and `scripts/sbom.mjs` (CycloneDX) exist and are documented by Design 05 ("artifact signing and checksums"). | `scripts/checksums.mjs`, `scripts/sbom.mjs`, `docs/design/design-05-testing-releases-v1.md` |
| CI runs `typecheck`, `test`, `brand-conformance`, `skills-conformance`, `verify:package`, `verify-packed-install` — **no checksums, no SBOM** step. | `.github/workflows/ci.yml` |
| `package.json` scripts have no `checksums`/`sbom` npm script and they are not in `prepack`/`prepublishOnly`. | `package.json` |

**Why it matters (Gentle AI standard):** Design 05 mandates "Artifact signing and checksums" in the release pipeline, and the tools to do it are written, but they are never invoked by CI or by the packaging hooks. The checksum/SBOM claim is therefore aspirational — nothing generates or verifies a release checksum today. This is a release-gate completeness gap, and it is **attributable** (the scripts are written but unplugged, not missing machinery to build).

### G5. No lint / format gate, despite Design 05 listing "Typecheck and lint" in the release pipeline

| Evidence | File |
| --- | --- |
| `package.json` has no `lint` or `format` script; no biome/eslint/prettier config file exists in the repo root. | `package.json`, repo-wide grep |
| CI runs typecheck + test + conformance + package, but no lint job. | `.github/workflows/ci.yml` |
| Design 05 release pipeline lists "Typecheck and lint". | `docs/design/design-05-testing-releases-v1.md` |
| A single commit applied biome formatting once (`style(brand-system): apply biome formatting …` in `.git/logs/HEAD`), but no biome config/script was committed. | git log |

**Why it matters:** the repo already enforces strict `tsc` flags (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `strict`, `noFallthroughCasesInSwitch`) — a genuine strength. But there is no repeatable lint/format gate, so style and unused-import drift are only caught by convention, and the "lint" step Design 05 names is not runnable. **This is the largest and highest-churn gap; it is deliberately a NON-GOAL for the first slice** (adding a linter touches many files and would blow the 300-line budget) and is listed here so a later slice can pick it up deliberately.

### G6. Ecosystem dashboard scripts depend on sibling repos not present locally

| Evidence | File |
| --- | --- |
| `scripts/brand-ecosystem-status.mjs` reads six sibling repo directories under `join(ROOT, "..", …)` and `process.exit(1)` on the first missing/invalid banner. | `scripts/brand-ecosystem-status.mjs` (`REPOS`, `statusFor`) |
| `scripts/skills-conformance.mjs` reads `../drenyra-skills/skills/registry.json` by default and exits 1 if the sibling is absent. | `scripts/skills-conformance.mjs` |
| CI only checks out `drenyra-skills` for `skills-conformance`; `brand-ecosystem-status` has no CI job and locally fails without five siblings. | `.github/workflows/ci.yml` |

**Why it matters:** these are legitimate cross-repo gate scripts, but locally `bun run brand:ecosystem` and `bun run skills:conformance` fail unless every sibling repo is checked out beside drenyra-ai. The failure is a hard exit with no clear "install the sibling first" guidance. This is a developer-workflow/resilience gap — **secondary to G1–G4**, and a candidate for a later slice rather than the first.

## Comparison to locally available Gentle AI harness/skill contracts (directly applicable only)

Applied from the injected `gentle-ai/SKILL.md` and the `systemic-issue-triage` skill, mapped to *where they are already honored* and *where they are not*:

| Gentle AI discipline (contract) | drenyra-ai status | Evidence |
| --- | --- | --- |
| Single source of truth / no parallel representations of truth | **GAP (G1, G2)** — version and declared surface are represented twice. | `capabilities.ts` vs `mcp/tools.ts`; hardcoded `0.2.0` |
| Fail-closed on missing/ambiguous authority | **Honored** — `NullSecretResolver` default, `GateRunner` fail-closed, `validateSignedReceipt` strict. | `security/keys.ts`, `gates/runner.ts`, `receipt-verify.ts` |
| Shrink-the-system, not grow-it | **Honored** — G1–G4 fixes are small and DELETE duplication; no new machinery. | see slices |
| A gate that ships without the change that satisfies it | **GAP (G4)** — Design 05 claims checksums/SBOM; no CI/package invocation exists. | `ci.yml`, `package.json` |
| Release integrity as an immutable artifact | **GAP (G4)** — `verify-packed-install.mjs` proves the packed artifact runs, but nothing signs/checksums it. | `verify-packed-install.mjs`, `checksums.mjs` unused |
| Doctor/operational resilience is cwd-independent | **GAP (G3)** — contracts resolve against `process.cwd()`. | `doctor.ts:68` |

The systemic-triage rule "does this add a state, verb, flag, gate, or parallel representation of existing truth?" is the correct test for G1/G2: the fix **deletes** the duplicated version literals and contract arrays in favor of one shared module. Nothing new is added.

## First slice recommendation (bounded, ≤300 changed lines)

**Slice A — Declared-surface integrity (G1 + G2 + G3, with regression tests).**

Single source of truth for the runtime version and the declared capability surface, shared by the CLI and MCP; make `doctor` cwd-independent. This is the highest-value, lowest-churn, fully attributable slice. It touches only `cmd/` and `mcp/` plus their tests; no domain logic, no WIP paths, no frozen contracts.

### Work units

| Unit | Change | Approx. lines | Test evidence |
| --- | --- | --- | --- |
| **A1 — shared runtime version** | Add a small `runtimeVersion()` helper in a single location (e.g. `cmd/commands/version.ts` or extend an existing `cmd/` output helper) that reads `package.json` via `createRequire`; use it in `mcp/tools.ts`, `cmd/commands/mcp-serve.ts`. | ~25 | `mcp/__tests__/server.test.ts`, `stdio.test.ts`: assert `serverInfo.version === runtimeVersion()` and tool `version` equals `package.json` version (drift-guard). |
| **A2 — shared declared surface** | Extract the frozen-contract + jurisdiction + adapter declaration into one module consumed by both `capabilitiesCommand()` and `capabilitiesTool()`; remove the duplicated literal arrays. | ~45 | New drift-guard test: CLI `capabilities show` output and MCP `capabilities` tool result agree on contracts, jurisdictions, adapters, and version. |
| **A3 — cwd-independent doctor** | Resolve the `contracts/` directory relative to the package root (same mechanism as `capabilities.ts` version resolution), not `process.cwd()`. | ~10 | Extend `cmd/__tests__/capabilities-doctor.test.ts`: invoke `doctorCommand` with a mocked non-root `process.cwd()` and assert it still reports the six contracts present and exits 0. |
| **A4 — CI wiring for the drift-guard** | Ensure the new/updated tests run under the existing `test` job (no new infra). No CI change beyond what the tests already cover. | ~0 (tests) | Full `bun run test` green for the touched suites + `bun run typecheck` clean. |

**Estimated authored changed lines: ~85–110** (well under the 300 budget), all in `cmd/` + `mcp/` and their tests.

### Why this slice first

- It closes the three gaps that are **single-source-of-truth failures** — the highest-signal quality issue a disciplined harness prevents (G1, G2) plus a latent operational false-negative (G3).
- It is **small, reversible, and has no external or sibling-repo dependency** (unlike G6) and no large churn (unlike G5).
- It is **testable deterministically** with drift-guard assertions, matching the repo's existing conformance/testing discipline.
- It does **not** modify any pre-existing WIP path or the 3 baseline-failing CLI tests.

## Non-goals (explicit, for this change / first slice)

- **No lint/format gate adoption (G5).** Adding biome/eslint and formatting the tree is high-churn and would exceed the 300-line budget; it is a deliberate later slice, not a first-slice item. (The strict `tsc` flags already provide a partial gate today.)
- **No release checksum/SBOM CI wiring (G4) in the first slice.** It is attributable and valuable but is a release-pipeline change with its own review surface; recommended as **Slice B** (separate bounded slice) rather than mixed into A.
- **No fixing the 3 baseline-failing `cmd/__tests__/cli.test.ts` tests.** They are pre-existing baseline failures, out of scope for attribution and for this change's acceptance evidence.
- **No changes to pre-existing WIP paths:** `missions/__tests__/postgres.integration.test.ts`, `skills/__tests__/pe-skills.test.ts`, `openspec/changes/fiscal-authority-kernel/apply-progress.md`, `openspec/programs/drenyra-dominion/capability-matrix.yaml`.
- **No frozen-contract, domain-logic, agent, or ledger changes.** G1–G3 live entirely in the `cmd/`/`mcp/` declared-surface layer.
- **No sibling-repo ecosystem scripting rework (G6)** in the first slice.
- **No new module/state/flag/gate/parallel truth.** Every fix in Slice A *deletes* duplication; nothing grows the system.

## Acceptance evidence (Slice A)

1. `grep -n "0\.2\.0" mcp/ cmd/` (excluding `package.json` and docs) returns **zero** hardcoded version literals that drive a runtime value; the MCP server/tool version comes from `runtimeVersion()`.
2. A drift-guard test asserts `serverInfo.version` and the MCP `capabilities` tool `version` both equal `package.json.version`.
3. A drift-guard test asserts CLI `capabilities show` and MCP `capabilities` tool agree on the six contracts, `["PE"]` jurisdiction, adapters, and version (single shared declaration).
4. `doctorCommand` invoked with a non-root `process.cwd()` still reports all six frozen contracts present and exits 0.
5. `bun run test` (full suite) and `bun run typecheck` pass. The 3 baseline CLI failures remain unchanged and are explicitly not part of this slice's success.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Shared-surface module drifts from either consumer after the slice | Low | The drift-guard test (A2) pins CLI-vs-MCP agreement in CI; adding a contract or adapter without updating the shared module fails the test. |
| `runtimeVersion()` resolves `package.json` differently in `dist/` vs `src/` | Low | Reuse the exact `createRequire(import.meta.url)` pattern already proven in `capabilities.ts`/`install.ts`/`doctor.ts`; the packed-install verification job already proves dist resolution. |
| Changing `doctor` contract resolution breaks the existing root-cwd test | Low | Update the test to assert both root and non-root cwd pass; behavior at root is unchanged. |
| Scope creep into lint (G5) or release pipeline (G4) | Medium | Explicit non-goals above; the tasks slice keeps the boundary to `cmd/`+`mcp/` declared-surface only. |

## Rollback strategy

Slice A is fully reversible: revert the `cmd/`/`mcp/` edits and their test updates; the shared-surface module is additive and its removal leaves `capabilities.ts`/`mcp/tools.ts` to declare literals again. No contract, domain, or WIP surface is affected, so rollback is independent of any other active change.

## Next recommended phase

`proposal` → `spec` → `design` → `tasks` for **Slice A only**, with G4 (release checksums/SBOM CI) teed up as an explicit second bounded change and G5 (lint gate) as a third, deliberately separated. This keeps each review surface focused and under the 400-line chain budget.
