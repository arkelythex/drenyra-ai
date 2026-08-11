# Tasks — drenyra-ecosystem-cleanup (Slice 1)

> Phase: tasks · Store: openspec · Scope: Slice 1 only (drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel)
> EXCLUDED: drenyra-command-center (any file). Protected (do not touch): drenyra-pi `__tests__/agents.test.ts`, `__tests__/extension.test.ts`, `scripts/verify-package-files.mjs`.
> Design phase: not needed — spec records no open architectural decisions. The helper API below is the concrete target contract; apply implements to it.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–350 (of which drenyra-pi parse consolidation ≈ 200–280) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | One independent PR per repo (4 PRs): drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium
```

Notes:

- The repos are independent and each carries its own commits; **no stacked chain** applies. `Chain strategy: pending` only because a stack is not applicable to parallel independent repos.
- `Decision needed before apply: No` — estimated changed lines are under 400 and the risk is Medium (driven by pi parse behavior edges, which are covered by the pi suite and the per-site preservation contract, not by size). Auto-apply may proceed.
- Each atomic commit unit is one logical change per repo. drenyra-pi produces **two** commits (parse consolidation + BRAND.md). Each repo PR is independent and merges to its own main.

## Task ownership

`implementation` = authoring code/tests/docs + running verification. `parent` = post-apply bounded review and lifecycle gates. Parent items are grouped separately after all implementation work.

---

## Phase 0 — Preflight evidence capture (all repos)

**Atomic unit: none (no commit — evidence only)**

- [x] Capture `git status --porcelain` and `git diff --name-only` for each touched repo (drenyra-ai, drenyra-pi, drenyra-skills, drenyra-guardian-angel) BEFORE any edit, to serve as the integrity baseline. Verify the three protected drenyra-pi files are clean at baseline. <!-- sdd-owner: implementation -->
- [x] Confirm `bun` is available and that `drenyra-ai/package.json` and `drenyra-pi/package.json` both run `bun run typecheck` and `bun run test`. <!-- sdd-owner: implementation -->

---

## Repo 1 — drenyra-ai (3 atomic commit units)

### UNIT-A — flow/close.ts consumes the candidates validators

**Commit message:** `refactor(flow): reuse candidates RUC/period validators in close preflight`

**Files:** `drenyra-ai/flow/close.ts`, `drenyra-ai/candidates/types.ts` (reference only — must NOT change), `drenyra-ai/flow/__tests__/close.test.ts` (must pass unchanged).

- [x] In `flow/close.ts`, add `isValidRuc` and `isValidPeriod` to the existing `import ... from "../candidates/types.js"` line (the same module already imports `Candidate`, `MaterialityInput`, `Reversibility` as types). Keep `guardian/guardian.ts`'s import surface identical. <!-- sdd-owner: implementation -->
- [x] Remove the local `const RUC_RE = /^\d{11}$/;` and `const PERIOD_RE = /^\d{6}$/;` declarations (currently `flow/close.ts:78-79`). Replace `RUC_RE.test(scope.ruc)` with `isValidRuc(scope.ruc)` and `PERIOD_RE.test(scope.period)` with `isValidPeriod(scope.period)` inside `runMonthlyClose` preflight. Keep the exact `fail(...)` messages `invalid RUC "…" (must be 11 digits)` and `invalid fiscal period "…" (must be YYYYMM)`. <!-- sdd-owner: implementation -->
- [x] VERIFY: `grep -rn "RUC_RE\|PERIOD_RE" flow/close.ts` returns zero matches; `git diff candidates/types.ts` is empty (export surface byte-identical); `bun run typecheck` and `bun run test` pass in `drenyra-ai` (specifically `flow/__tests__/close.test.ts` still asserts `preflight-failed` with `invalid RUC` / `invalid fiscal period`). <!-- sdd-owner: implementation -->

### UNIT-B — contracts/README.md brand-system version note

**Commit message:** `docs(contracts): correct brand-system DRAFT version note to 0.2`

**Files:** `drenyra-ai/contracts/README.md` only.

- [x] In the first `[!IMPORTANT]` block of `contracts/README.md`, change `` `brand-system` is DRAFT at v0.1 `` → `` `brand-system` is DRAFT at v0.2 ``. Do NOT touch the contract table, any other prose, `contracts/brand-system.md`, or any contract file. <!-- sdd-owner: implementation -->
- [x] VERIFY: `grep -n "brand-system is DRAFT" contracts/README.md` shows `v0.2`; `cat contracts/brand-system/tokens.json` reports `"version": "0.2"`; `git diff --stat` touches only `contracts/README.md`. <!-- sdd-owner: implementation -->

### UNIT-C — nanoid override remediation

**Commit message:** `fix(deps): override nanoid to >=3.3.17 (CVE-2024-55565)`

**Files:** `drenyra-ai/package.json`, `drenyra-ai/bun.lock`.

- [x] Add a root-level `"overrides": { "nanoid": ">=3.3.17" }` block to `drenyra-ai/package.json`. Do NOT change any direct dependency range. Then run `bun install` in `drenyra-ai` to regenerate `bun.lock`. <!-- sdd-owner: implementation -->
- [x] VERIFY: `git diff package.json` shows ONLY the added `overrides` block; `git diff --stat bun.lock` is minimal (only the `nanoid` resolution change, current 3.x resolves to `3.3.18`, plus any resolution necessarily forced by it); `grep -n "nanoid" bun.lock` shows every resolution `>= 3.3.17` and no `3.3.16`/lower; `bun run typecheck` and `bun run test` pass. Record the lockfile churn justification in the change record if any unexpected line changed. <!-- sdd-owner: implementation -->

---

## Repo 2 — drenyra-pi (2 atomic commit units: UNIT-E then UNIT-D-pi)

### UNIT-E — Shared fail-closed parse helper + migrate 8 modules

**Commit message:** `refactor(lib): consolidate fail-closed NDJSON/JSON parse into shared helper`

**Files (new):** `drenyra-pi/lib/parse.ts`
**Files (migrated):** `drenyra-pi/lib/mission-store.ts`, `drenyra-pi/lib/authority-store.ts`, `drenyra-pi/lib/receipt-store.ts`, `drenyra-pi/lib/evidence-graph.ts`, `drenyra-pi/chains/verify.ts`, `drenyra-pi/chains/evidence.ts`, `drenyra-pi/chains/reconcile.ts`, `drenyra-pi/chains/monthly-close.ts`
**Protected (do NOT touch):** `drenyra-pi/__tests__/agents.test.ts`, `drenyra-pi/__tests__/extension.test.ts`, `drenyra-pi/scripts/verify-package-files.mjs`

**Helper contract — `lib/parse.ts` (new module):**

```ts
/** Parse a single JSON value; on failure throws Error(label [— rawMessage]). */
export function parseJsonOrThrow<T>(input: string, label: string, opts?: { includeMessage?: boolean }): T;

/** Iterate non-empty NDJSON lines, calling onLine for each. Default split = "\n". */
export function eachNdjsonLine(raw: string, onLine: (line: string) => void, split: string | RegExp = "\n"): void;
```

Preserves every per-site difference through parameters/labels — the helper does NOT standardize away split, throw-vs-empty, or message text.

- [x] Create `drenyra-pi/lib/parse.ts` implementing `parseJsonOrThrow` (throws `Error(label)` when `includeMessage` is false; `Error(`${label} — ${e.message}`)` when true) and `eachNdjsonLine` (skips blank/whitespace lines). <!-- sdd-owner: implementation -->

#### Per-site migration mapping (each `implementation` task runs the pi suite after editing its files)

| Site (file) | Parse shape | Split | On invalid | Error text (preserved exactly) |
| --- | --- | --- | --- | --- |
| `lib/mission-store.ts` (`parseJsonFile`) | single doc | n/a | throw | `mission store corrupt: ${label} at ${path} is not valid JSON — repair is explicit and never automatic` (also preserves the unreadable-file throw) |
| `lib/mission-store.ts` (`readEventLine` + `list`) | NDJSON line | `"\n"` | throw | `mission event log corrupt: ${path} contains a malformed line — repair is explicit and never automatic` |
| `lib/authority-store.ts` (`readRecords`) | NDJSON line | `"\n"` | throw | `authority log corrupt: ${path} contains a malformed line — repair is explicit and never automatic` |
| `lib/receipt-store.ts` (`parseRecordFile`) | single doc | n/a | throw | `receipt store corrupt: ${path} is not valid JSON — repair is explicit and never automatic` (preserves unreadable-file throw) |
| `lib/evidence-graph.ts` (`load`) | NDJSON line | `"\n"` | throw | `evidence log corrupt: ${path} contains a malformed or truncated line — repair is explicit and never automatic` |
| `chains/verify.ts` (`parseVerifyInput`) | single JSON string | n/a | throw | `verify: the source manifest is not valid JSON — ${e.message}` (includeMessage=true) |
| `chains/evidence.ts` (op envelope) | single JSON string | n/a | throw | `evidence: the op envelope is not valid JSON — ${e.message}` (includeMessage=true) |
| `chains/reconcile.ts` (`parseReconcileManifest`) | single JSON string | n/a | throw | `reconcile: the source manifest is not valid JSON — ${e.message}` (includeMessage=true) |
| `chains/monthly-close.ts` (evidence graph read) | NDJSON line | `/\r?\n/` | return empty (`[]`) | no throw — graph treated as unavailable |

- [x] Migrate `lib/mission-store.ts` to use the helper for both its single-doc parse (`parseJsonFile`) and its NDJSON line sites (`readEventLine` and `list`). Preserve the unreadable-file throw and the `mission store corrupt`/`mission event log corrupt` labels and the `\n` split. <!-- sdd-owner: implementation -->
- [x] Migrate `lib/authority-store.ts` `readRecords` to use the helper with `\n` split and the `authority log corrupt` label. Preserve the separate non-object/truncated-record throw. <!-- sdd-owner: implementation -->
- [x] Migrate `lib/receipt-store.ts` `parseRecordFile` to use the helper (single doc, `receipt store corrupt` label, no raw message appended). Preserve the unreadable-file throw and the validation throw. <!-- sdd-owner: implementation -->
- [x] Migrate `lib/evidence-graph.ts` `load` to use the helper with `\n` split and the `evidence log corrupt` label. Preserve the non-object and cross-mission throws. <!-- sdd-owner: implementation -->
- [x] Migrate `chains/verify.ts` `parseVerifyInput` to use the helper with `includeMessage: true` and label `verify: the source manifest is not valid JSON`. <!-- sdd-owner: implementation -->
- [x] Migrate `chains/evidence.ts` op-envelope parse to use the helper with `includeMessage: true` and label `evidence: the op envelope is not valid JSON`. <!-- sdd-owner: implementation -->
- [x] Migrate `chains/reconcile.ts` `parseReconcileManifest` to use the helper with `includeMessage: true` and label `reconcile: the source manifest is not valid JSON`. <!-- sdd-owner: implementation -->
- [x] Migrate `chains/monthly-close.ts` evidence-graph read to use `eachNdjsonLine` with `/\r?\n/` split, keeping the try/catch that returns `[]` (empty node list) on any corrupt line (graph unavailable). <!-- sdd-owner: implementation -->

- [x] VERIFY (UNIT-E): `bun run typecheck` and `bun run test` pass in `drenyra-pi`; `grep -rn "JSON.parse" lib/ chains/` shows no duplicated inline parse-helper body outside `lib/parse.ts`; the three protected files show zero modification in `git status --porcelain` and `git diff --name-only` vs the Phase 0 baseline. *Caveat: `lib/trusted-key-registry.ts` retains one duplicated single-doc parse body (same pattern) but is outside the enumerated 8-module scope — surfaced for parent decision.* <!-- sdd-owner: implementation -->

### UNIT-D-pi — Portable BRAND.md

**Commit message:** `docs(branding): use sibling-relative brand-conformance path in BRAND.md`

**Files:** `drenyra-pi/assets/branding/BRAND.md`

- [x] In the `## Validate` block, replace the absolute path

  ```
  node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs \
  ```

  with the sibling-relative

  ```
  node ../drenyra-ai/scripts/brand-conformance.mjs \
  ```

  Keep the rest of the command (`assets/branding/drenyra-pi-banner.png`) unchanged. Optionally document the sibling-checkout convention in the same file if not already present. <!-- sdd-owner: implementation -->
- [x] VERIFY: `grep -n "/home/\|/PROYECTOS/" assets/branding/BRAND.md` returns zero matches in drenyra-pi. <!-- sdd-owner: implementation -->

---

## Repo 3 — drenyra-skills (1 atomic commit unit: UNIT-D-skills)

**Commit message:** `docs(branding): use sibling-relative brand-conformance path in BRAND.md`

- [x] In `drenyra-skills/assets/branding/BRAND.md`, replace the absolute path `node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs \` with `node ../drenyra-ai/scripts/brand-conformance.mjs \` (target stays `assets/branding/drenyra-skills-banner.png`). <!-- sdd-owner: implementation -->
- [x] VERIFY: `grep -n "/home/\|/PROYECTOS/" assets/branding/BRAND.md` returns zero matches in drenyra-skills. <!-- sdd-owner: implementation -->

---

## Repo 4 — drenyra-guardian-angel (1 atomic commit unit: UNIT-D-guardian)

**Commit message:** `docs(branding): use sibling-relative brand-conformance path in BRAND.md`

- [x] In `drenyra-guardian-angel/assets/branding/BRAND.md`, replace the absolute path `node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs \` with `node ../drenyra-ai/scripts/brand-conformance.mjs \` (target stays `assets/branding/drenyra-guardian-angel-banner.png`). <!-- sdd-owner: implementation -->
- [x] VERIFY: `grep -n "/home/\|/PROYECTOS/" assets/branding/BRAND.md` returns zero matches in drenyra-guardian-angel. <!-- sdd-owner: implementation -->

---

## Phase Z — Final integrity sweep (all repos)

**Atomic unit: none (no commit — evidence only)**

- [x] In every touched repo, run `git status --porcelain` and `git diff --name-only` again and compare against the Phase 0 baseline. Confirm: no path under `drenyra-command-center` appears in any commit set; the three protected drenyra-pi files remain untouched; the only diffs are the intended UNIT-A…UNIT-D changes. <!-- sdd-owner: implementation -->

---

## Commit plan (one logical change per commit, repo by repo)

| Repo | Commit unit | Conventional-commit message |
| --- | --- | --- |
| drenyra-ai | UNIT-A | `refactor(flow): reuse candidates RUC/period validators in close preflight` |
| drenyra-ai | UNIT-B | `docs(contracts): correct brand-system DRAFT version note to 0.2` |
| drenyra-ai | UNIT-C | `fix(deps): override nanoid to >=3.3.17 (CVE-2024-55565)` |
| drenyra-pi | UNIT-E | `refactor(lib): consolidate fail-closed NDJSON/JSON parse into shared helper` |
| drenyra-pi | UNIT-D-pi | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` |
| drenyra-skills | UNIT-D-skills | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` |
| drenyra-guardian-angel | UNIT-D-guardian | `docs(branding): use sibling-relative brand-conformance path in BRAND.md` |

Delivery: 4 independent PRs (one per repo). Each repo PR is self-contained and merges to its own main; no cross-repo dependency at merge time (the sibling `../drenyra-ai` reference is a documented convention already assumed by `brand-ecosystem-status.mjs`, not a runtime import).

---

## Parent-owned lifecycle gates (post-apply)

- [ ] Run bounded review on the combined 4-repo PR set against the spec acceptance criteria (a–e), the protected/excluded file integrity, and the helper-contract conformance, then gate apply/verify per the lifecycle. <!-- sdd-owner: parent -->
- [ ] Run `sdd-verify` for the change and confirm CRITICAL/WARNING state before archive. <!-- sdd-owner: parent -->

## Risks

- **pi parse behavior edges (Medium):** throw-vs-empty and `\n` vs `/\r?\n/` differ across the 9 sites; the helper must parameterize them, not standardize. Mitigated by the per-site mapping table above and the pi suite. The single highest-risk site is `chains/monthly-close.ts` (must keep returning `[]`).
- **bun.lock churn:** `bun install` may resolve beyond the override if upstream ranges shift later; verify `git diff --stat bun.lock` is nanoid-only before committing UNIT-C.
- **Protected-file integrity:** the before/after `git status --porcelain` baseline (Phase 0) is mandatory evidence; do not commit Phase 0/Phase Z sweeps.
