# Exploration — reproducible-lint-gate

> **Change:** `reproducible-lint-gate` · **Phase:** explore · **Scope:** read-only investigation; no product code, tests, docs, config, CI, package files, generated artifacts, active change paths, or WIP were modified.
>
> **Goal:** identify the smallest evidence-based way to add a reproducible lint/format quality gate (G5 in the quality-parity audit) without broad formatting churn, while preserving strict TypeScript and the existing package/CI conventions. Propose a first slice under 300 authored changed lines.
>
> **Store:** OpenSpec · Engram unavailable (per orchestrator). This change is independent of the blocked `gentle-ai-quality-parity` Slice A and the completed/blocked `release-integrity-evidence` slice; it shares only G5's root-cause evidence.

## Lead

**The decisive fact for this slice is indentation: the tree is already mixed between tabs and 4-space across shipped modules.** That makes a whole-tree *format* gate high-churn and disqualifies "format the world" as a first slice. But a *lint* gate (no auto-format, no indent enforcement) is small, deterministic, and does not reformat a single file. The smallest reproducible gate is therefore **lint-only, pinned-tool, CI-wired, green-at-baseline** — with format enforcement deliberately deferred until indentation is normalized in its own separate slice.

Everything below is mapped to file evidence. Baseline and pre-existing state are distinguished from attributable gaps.

## Baseline and pre-existing state (distinguished — NOT attributable gaps)

| Item | Evidence | Disposition |
| --- | --- | --- |
| **3 failing tests** in `cmd/__tests__/cli.test.ts` | Baseline `bun run test` has 3 failures in the CLI command suite (per orchestrator). | **Baseline failure, pre-existing.** Out of scope for this change's acceptance evidence. |
| **WIP: `missions/__tests__/postgres.integration.test.ts`** | Real-PostgreSQL suite, silently returns when DB unreachable. | **Pre-existing WIP.** Leave untouched. |
| **WIP: `skills/__tests__/pe-skills.test.ts`** | Pins `BASE_PE_SKILLS` length/checksum/jurisdiction/IDs. | **Pre-existing WIP.** Leave untouched. |
| **WIP: `openspec/changes/fiscal-authority-kernel/apply-progress.md`** | Documents tenant-core/isolation split, PAUSED decision. | **Pre-existing WIP.** Leave untouched. |
| **WIP: `openspec/programs/drenyra-dominion/capability-matrix.yaml`** | Program-wide capability matrix. | **Pre-existing WIP.** Leave untouched. |
| Blocked `gentle-ai-quality-parity` Slice A | Declared-surface integrity (MCP/CLI version parity, `doctor` cwd). | **Blocked; separate change.** This gate must not touch or unblock it. |
| `release-integrity-evidence` slice | G4 checksum/SBOM CI wiring. | **Separate change.** Completed/blocked; not this change's scope. |

## Current-state gap — attributable evidence

### G5. No reproducible lint / format gate, despite Design 05 listing "Typecheck and lint"

| Evidence | File |
| --- | --- |
| `package.json` has no `lint` or `format` script; no biome/eslint/prettier config file exists in the repo root; `@biomejs/biome` is not a devDependency. | `package.json`, repo-wide grep |
| CI (`ci.yml`) runs `typecheck`, `test`, `brand-conformance`, `skills-conformance`, `package` — **no lint step**. | `.github/workflows/ci.yml` |
| Design 05 release pipeline lists "Typecheck and lint". | `docs/design/design-05-testing-releases-v1.md:51` |
| A single historical commit applied biome formatting once (`style(brand-system): apply biome formatting to conformance script and gitleaks config`), but no biome config/script was committed. | `.git/logs/HEAD` |
| PR template already names "markdownlint + link check" as a docs checkbox; CHANGELOG carries `<!-- markdownlint-disable MD024 -->`, but no markdownlint config or gate exists. | `.github/PULL_REQUEST_TEMPLATE.md`, `CHANGELOG.md` |

**Why it matters (Gentle AI standard):** the repo already enforces strict `tsc` flags — `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — a genuine strength that covers many "lint"-class issues at the type level. But there is no repeatable, version-pinned lint command that runs in CI, so unused imports, `console` usage in shipped modules, and style drift are only caught by convention. Design 05's "lint" step is named but not runnable.

### The feasibility constraint: indentation is already mixed tree-wide

| Evidence | File |
| --- | --- |
| Tabs used in shipped modules. | `review/lenses.ts:27`, `missions/versioning.ts:43`, `security/__tests__/keys.test.ts:6`, `cmd/declared-surface.ts:17`, `evidence/identity/errors.ts:16` |
| 4-space used in other shipped/test modules. | `missions/transitions.ts:36`, `receipts/__tests__/conformance-vectors.test.ts:366` |
| `.mjs` scripts mix 2-space (e.g. `verify-packed-install.mjs`) and tabs (`checksums.mjs`, `verify-release-integrity.mjs`). | `scripts/*.mjs` |

A whole-tree `format` gate (e.g. `biome check` with the formatter on) would fail on every mixed-indent file and require reformatting the tree — the exact churn G5's audit flagged as exceeding the 300-line budget. **This is why the first slice is lint-only, and format enforcement is a separate, later slice after indentation normalization.**

## Scope inspected for the gate

- **Source/test TS:** `tsconfig.json` `include` dirs (`receipts`, `ledger`, `missions`, `candidates`, `review`, `gates`, `recovery`, `tenant-core`, `tenant-isolation`, `agents`, `cmd`, `contracts/__tests__`, `evidence`, `skills`, `security`, `guardian`, `adapters`, `flow`) plus `vitest.config.ts`. Strict tsc already covers type-level lint here.
- **Scripts:** `scripts/*.mjs` (`build`, `brand-conformance`, `sbom`, `checksums`, `verify-*`, `skills-conformance`).
- **Markdown:** `docs/`, `README.md`, `CHANGELOG.md`, `contracts/*.md`. PR template already references markdownlint.
- **YAML:** `.github/workflows/*.yml`, `openspec/programs/**/*.yaml`. Some are WIP/generated.

## Tool-selection tradeoff (no new runner preference — smallest surface)

| Option | Churn | Reproducibility | Fit |
| --- | --- | --- | --- |
| **A. Biome lint (pinned), no formatter** | Zero auto-format; only explicit lint findings | `@biomejs/biome` pinned exact version in `devDependencies` + `bun.lock` frozen install | **Best for the "no formatting churn" constraint** — biome lint does not rewrite; it only reports. |
| B. Biome lint + format check | Whole-tree reformat to normalize indent | Pinned | **Rejected for first slice** — mixed indent makes it high-churn; defer to a later slice. |
| C. ESLint + Prettier | Config + baseline; Prettier would still flag indent | Pin both | **No advantage over A**; two tools, more surface, and Prettier's indent model is exactly the churn vector we avoid. |
| D. Zero-dependency: extend `tsc` script only | None | Already strict | **Insufficient** — `noUnusedLocals`/`noUnusedParameters` already ship; it cannot catch `console`/style drift, and Design 05 wants a named lint step. A tsc-only "gate" would be a rename of `typecheck`, not a new gate. |

**Selection: Option A — a pinned `@biomejs/biome` devDependency running **lint only** (`biome lint`), formatter disabled in `biome.json`, exposed as `bun run lint`, wired into a CI step, green at baseline.** This satisfies "reproducible" (exact pinned version in `devDependencies` + frozen `bun.lock`) and "without broad formatting churn" (no formatter, no indent enforcement). It preserves strict TypeScript (the tsc flags stay authoritative and untouched).

## First slice recommendation (bounded, < 300 changed lines)

**Slice A — Reproducible biome lint gate (TS source/test/script scope), CI-wired, green at baseline.**

### Work units

| Unit | Change | Approx. lines | Test/validation evidence |
| --- | --- | --- | --- |
| **A1 — pin the linter** | Add `"@biomejs/biome": "<exact-pinned>"` to `devDependencies`; `bun install --frozen-lockfile` updates `bun.lock`. | ~3 (JSON) + lockfile | `bun run lint` resolves a deterministic binary; `bun install --frozen-lockfile` stays green (lockfile committed). |
| **A2 — lint-only config** | Add `biome.json` with the **formatter disabled**, an explicit `linter` ruleset (start minimal: `correctness`, `suspicious`, `noUnusedImports`, `noConsole` scoped to shipped modules, `style` restricted), and `files.include` restricted to the `tsconfig.json` source/test dirs + `scripts/*.mjs`. | ~25 | Strict-TDD RED first: run `bun run lint` and capture the exact baseline findings list before tuning the ruleset so the baseline is green. |
| **A3 — npm script** | Add `"lint": "biome lint"` (and a `lint:fix` convenience) to `package.json` scripts. | ~2 | `bun run lint` runs and reports the baseline. |
| **A4 — CI wiring** | Add one `lint` job to `.github/workflows/ci.yml` (`bun install --frozen-lockfile` + `bun run lint`), mirroring the `typecheck` job shape. | ~12 | CI runs the gate on every push/PR. |
| **A5 — Markdown optional (deferred)** | markdownlint config + gate. | N/A | **Non-goal for first slice**; PR template already references it, but adding a second tool and a markdown baseline is out of the 300-line budget and should be a separate slice. |

**Estimated authored changed lines: ~40–60** (biome.json + package.json + ci.yml + any baseline-fix hunks), comfortably under 300. No source file is reformatted; the strict `tsc` flags are untouched; no `dist/`, lockfile-destructive, generated, WIP, or blocked-path change is made beyond the additive devDependency + committed `bun.lock`.

### Why this slice first

- **Reproducible by construction:** exact pinned biome version in `devDependencies` + frozen-lockfile CI install; no ambient global tool.
- **No formatting churn:** biome **lint** does not rewrite files; mixed indentation is preserved untouched.
- **Preserves strict TS:** the existing strict `tsc` flags remain the type-level gate, unchanged; biome lint adds the style/`console`/unused-import layer Design 05 names.
- **Green at baseline:** matches the systemic-triage rule "a gate that ships without the change that satisfies it is the worst class." The slice captures the RED baseline first, then tunes the ruleset so `bun run lint` passes the current tree — the gate is never red on `main`.
- **Small, reversible, no external/sibling-repo dependency.**

## Non-goals (explicit, for this change / first slice)

- **No whole-tree format gate / indentation normalization.** Mixed tabs/4-space across shipped modules means format enforcement is high-churn and exceeds the budget. It is a **separate later slice**, after indentation is normalized (itself its own slice).
- **No ESLint + Prettier adoption.** Option A (biome lint) is strictly smaller surface; Prettier's indent model is exactly the churn vector we avoid.
- **No markdownlint / YAML lint in the first slice.** PR template references markdownlint but adding a second tool + a markdown baseline is out of budget; defer to a later slice.
- **No touching blocked `gentle-ai-quality-parity` Slice A, `release-integrity-evidence`, or any WIP path.**
- **No weakening the strict `tsc` flags.** The lint gate is additive, not a relaxation.
- **No fixing the 3 baseline-failing `cmd/__tests__/cli.test.ts` tests** (pre-existing, out of scope).
- **No new module/state/flag/parallel truth beyond the pinned lint tool + config.** `biome.json` is the single lint declaration.

## Migration / rollout strategy

1. Land the pinned devDependency + committed `bun.lock` so the gate is reproducible for every clone (A1).
2. Land `biome.json` (formatter off, minimal ruleset) and `bun run lint` (A2, A3) in the same commit so the repo is never in a "lint script exists but is red" state.
3. Wire the CI `lint` job (A4) only after `bun run lint` is green locally at the recorded baseline.
4. Strict-TDD evidence: the baseline findings list captured in RED is the "failing test"; the tuned ruleset that makes it green is the "passing test". The gate's value is that a future added `console.log` or unused import fails `bun run lint` in CI.

## Test / validation evidence

1. `bun run lint` exits 0 on the current tree at the recorded baseline (exact baseline findings list captured in apply-progress).
2. `bun run typecheck` still passes (strict tsc flags untouched).
3. A RED proof: introducing a temporary unused import / `console.log` in a shipped module makes `bun run lint` exit non-zero, then is reverted (this is the differential proof that the gate is meaningful, recorded as the failing-then-passing evidence).
4. `bun install --frozen-lockfile` succeeds in CI (lockfile is committed and consistent).
5. CI `lint` job is green on push/PR.
6. Full `bun run test` result recorded; the 3 baseline CLI failures remain unchanged and are explicitly not part of this slice's success.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| The lint baseline is unexpectedly large once biome runs (more findings than budgeted). | Medium | Slice already scopes to TS source/test/scripts and starts minimal; if the baseline exceeds the budget, narrow `files.include` and defer the rest to a follow-up — never reformat to force green. |
| `@biomejs/biome` adds a native/install surface to the lockfile. | Low | Pinned exact version + frozen-lockfile CI; it is a normal devDependency, not a runtime dependency. |
| A lint rule flags legitimate `console` usage (CLI `cmd/` output). | Low | Scope `noConsole` to shipped library modules, not `cmd/`/`scripts`; the CLI is the adapter layer that legitimately logs. |
| Scope creep into format enforcement or markdownlint. | Medium | Explicit non-goals above; the tasks slice keeps the boundary to lint-only over the TS source/test/script scope. |

## Rollback strategy

Slice A is fully reversible with one bounded work unit: remove the `biome.json`, the `lint`/`lint:fix` `package.json` scripts, the `@biomejs/biome` devDependency (+ lockfile diff), and the CI `lint` job. No source file is reformatted, no strict `tsc` flag changes, and no WIP/blocked path is affected, so rollback is independent of any other active change.

## Next recommended phase

`proposal` → `spec` → `design` → `tasks` for **Slice A (lint-only gate)** only. A separate follow-on slice should later tackle **format enforcement** (after a dedicated indentation-normalization slice) and **markdownlint** independently, each under its own 300-line budget.
