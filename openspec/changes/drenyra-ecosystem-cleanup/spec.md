# Ecosystem Cleanup — Slice 1 Specification

> Change: `drenyra-ecosystem-cleanup` · Phase: spec · Store: openspec
> Scope: **Slice 1 only** (safe internal deduplication and hygiene).
> Slices 2 (checksummed RUC consolidation) and 3 (skills content migration) are
> **decision-gated** and are captured as explicit non-goals below; their specs
> will be written only after the pending decisions are resolved.

## Purpose

Slice 1 removes known low-risk duplication and hygiene defects across the
ecosystem without changing any released behavior, public export, or frozen
contract:

1. `drenyra-ai/flow/close.ts` consumes the RUC/period validators it already owns
   in `candidates/types.ts` instead of re-declaring private regexes.
2. `drenyra-ai/contracts/README.md` brand-system version note is corrected to
   agree with the canonical token version.
3. The vulnerable transitive `nanoid@3.3.16` resolution (CVE-2024-55565) is
   pinned to a fixed version through the package-manager override mechanism.
4. The in-scope `BRAND.md` scaffolds in `drenyra-pi`, `drenyra-skills`, and
   `drenyra-guardian-angel` stop embedding absolute machine paths.
5. `drenyra-pi` consolidates its duplicated fail-closed NDJSON/JSON parse
   behavior into one internal helper, restricted to the eight identified store
   and chain modules and never touching user-owned uncommitted files.

## Requirements

### Requirement: flow/close.ts consumes the candidates validators

The system MUST remove the private `RUC_RE` and `PERIOD_RE` regex declarations
from `drenyra-ai/flow/close.ts` and MUST instead import the exported functions
`isValidRuc` and `isValidPeriod` from `../candidates/types.js`, using them for
the close preflight checks. This MUST NOT change the regex semantics (both files
use `/^\d{11}$/` for RUC and `/^\d{6}$/` for period) or the observable preflight
behavior. `candidates/types.ts` MUST keep its regexes module-private and its
export surface unchanged (no export added, removed, or renamed; `guardian`
continues to import the same functions).

Note: the exploration's shorthand "import RUC_RE/PERIOD_RE from
`candidates/types.ts`" is not literally possible — those constants are
module-private; the exported validators `isValidRuc`/`isValidPeriod` are the
actual reuse mechanism, as `guardian/guardian.ts` already demonstrates.

#### Scenario: Malformed RUC still fails preflight

- GIVEN a `MonthlyCloseInput` with `scope.ruc = "123"`
- WHEN `runMonthlyClose` runs
- THEN the result is `status: "preflight-failed"` with a risk containing `invalid RUC`

#### Scenario: Malformed period still fails preflight

- GIVEN a `MonthlyCloseInput` with `scope.period = "2026"`
- WHEN `runMonthlyClose` runs
- THEN the result is `status: "preflight-failed"` with a risk containing `invalid fiscal period`

#### Scenario: No public export change

- GIVEN the `candidates/types.ts` export list before and after the change
- WHEN the diff is reviewed
- THEN no export is added, removed, or renamed, and the flow test suite
  (`flow/__tests__/close.test.ts`) still passes

#### Scenario: No duplicate regex declarations remain

- GIVEN `flow/close.ts`
- WHEN scanned for `RUC_RE`/`PERIOD_RE` declarations
- THEN no local regex constant declarations for RUC or period remain in the file

### Requirement: Brand-system version note agrees with tokens

The system MUST correct the non-normative brand-system note in
`drenyra-ai/contracts/README.md` so the prose agrees with the canonical token
version. Currently the first block states "`brand-system` is DRAFT at v0.1"
while `contracts/brand-system/tokens.json` declares `"version": "0.2"` and the
README's own contract table lists `brand-system` at `0.2` DRAFT. The note MUST
state `0.2` and MUST NOT change any normative contract content, version, or
frozen status in the table or in any contract file.

#### Scenario: Prose and tokens agree

- GIVEN `contracts/README.md` and `contracts/brand-system/tokens.json`
- WHEN the brand-system version is read from both files
- THEN both report `0.2`

#### Scenario: Normative surface unchanged

- GIVEN the six frozen contract rows and `contracts/brand-system.md`
- WHEN the change diff is reviewed
- THEN no normative contract content, version, or frozen status changes

### Requirement: nanoid vulnerability remediated without churn

The system MUST resolve the transitive `nanoid@3.3.16` (CVE-2024-55565) to a
non-vulnerable version (`>= 3.3.17`) in `drenyra-ai` using the least invasive
package-manager mechanism: a root-level `overrides` entry in `package.json`
(e.g. `"nanoid": ">=3.3.17"`) followed by lockfile regeneration via
`bun install`. The regenerated `bun.lock` MUST contain no `nanoid` resolution
below `3.3.17` (the current 3.x line resolves to `3.3.18`). The change MUST NOT
modify any direct dependency range, MUST NOT upgrade unrelated dependencies,
and MUST NOT alter observable behavior — `nanoid` is used only transitively by
`postcss` via `vite`/`vitest`.

#### Scenario: No vulnerable resolution remains

- GIVEN the regenerated `bun.lock`
- WHEN the lockfile is searched for `nanoid`
- THEN every resolution is `>= 3.3.17` and no `3.3.16` or lower remains

#### Scenario: Override is the only manifest change

- GIVEN `git diff` of `package.json`
- THEN the only change is the added `overrides` block (no dependency range edits)

#### Scenario: Lockfile churn is minimal

- GIVEN `git diff --stat bun.lock`
- WHEN the diff is reviewed
- THEN changed lines are limited to the `nanoid` resolution (and any resolution
  necessarily forced by it); unrelated dependency churn is absent or explicitly
  justified in the change record

#### Scenario: Behavior is unchanged

- GIVEN the modified dependency graph
- WHEN `bun run typecheck` and `bun run test` run in `drenyra-ai`
- THEN both pass

### Requirement: Brand scaffolds are repository-portable

The system MUST remove absolute host paths from the `BRAND.md` scaffolds in
`drenyra-pi/assets/branding/BRAND.md`, `drenyra-skills/assets/branding/BRAND.md`,
and `drenyra-guardian-angel/assets/branding/BRAND.md`. Each validation command
MUST use a repository-relative reference to the checker —
`node ../drenyra-ai/scripts/brand-conformance.mjs ...` run from that repository's
root — and MUST document the sibling-checkout convention (the same `../<repo>`
layout already assumed by `drenyra-ai/scripts/brand-ecosystem-status.mjs`).
The system MUST NOT modify any file under `drenyra-command-center`.

#### Scenario: No absolute host paths remain

- GIVEN the three in-scope `BRAND.md` files
- WHEN scanned for `/home/` and `/PROYECTOS/`
- THEN zero matches

#### Scenario: Documented command resolves from the sibling layout

- GIVEN sibling checkouts of `drenyra-ai` and the consuming repo
- WHEN the documented command runs from the consuming repo root
- THEN it resolves `../drenyra-ai/scripts/brand-conformance.mjs` without any
  host-specific path and without editing any file

#### Scenario: Command center is untouched

- GIVEN the change's commit set
- WHEN `git diff --name-only` is checked against `drenyra-command-center`
- THEN no path under `drenyra-command-center` appears

### Requirement: One internal fail-closed parse helper in drenyra-pi

The system MUST consolidate the duplicated fail-closed NDJSON/JSON parse
behavior in `drenyra-pi` into one internal shared helper module (for example
`lib/parse.ts` or `lib/ndjson.ts`), and MUST migrate the eight identified
modules: `lib/mission-store.ts`, `lib/authority-store.ts`, `lib/receipt-store.ts`,
`lib/evidence-graph.ts`, `chains/verify.ts`, `chains/evidence.ts`,
`chains/reconcile.ts`, and `chains/monthly-close.ts`.

Each migrated call site MUST preserve its observable fail-closed contract:
the same throw-vs-return-empty behavior, the same error message text (or an
equivalent that keeps the site's label, e.g. "authority log corrupt",
"evidence log corrupt", "verify:", "receipt store corrupt"), and the same
line-splitting semantics (`"\n"` vs `/\r?\n/`), unless the design deliberately
standardizes a difference and covers it with tests. The consolidation MUST NOT
change NDJSON formats, persistence schemas, or the fail-closed policy, and MUST
NOT touch the protected user-owned files `__tests__/agents.test.ts`,
`__tests__/extension.test.ts`, and `scripts/verify-package-files.mjs`.

Verified facts: all eight modules contain at least one duplicated parse site;
**none of the eight overlaps the protected file list** (all are under `lib/` or
`chains/`), so all eight are in scope for slice 1 and none needs to be excluded.

#### Scenario: Authority store still fails closed on corrupt lines

- GIVEN an authority NDJSON log with a malformed line
- WHEN `AuthorityStore.readRecords` runs through the shared helper
- THEN it throws an error containing `authority log corrupt` and
  `repair is explicit and never automatic`

#### Scenario: Monthly close keeps its unavailable fallback

- GIVEN an evidence graph NDJSON with a corrupt line
- WHEN the monthly-close graph read runs through the shared helper
- THEN it returns an empty node list (graph treated as unavailable) and does not
  throw

#### Scenario: Single-record parsers keep their messages

- GIVEN `chains/verify.ts`, `chains/evidence.ts`, and `chains/reconcile.ts`
  invoked with malformed JSON input
- WHEN their command-boundary parsers run through the shared helper
- THEN each throws with its existing site label (`verify:`, `evidence:`,
  `reconcile:`) and message shape

#### Scenario: Protected files are untouched

- GIVEN the `drenyra-pi` working tree before and after the change
- WHEN `git status --porcelain` and `git diff --name-only` are checked
- THEN `__tests__/agents.test.ts`, `__tests__/extension.test.ts`, and
  `scripts/verify-package-files.mjs` show no modification

#### Scenario: Duplication is gone

- GIVEN the eight migrated modules
- WHEN scanned for inline `JSON.parse(line)`-inside-`split` helper bodies
- THEN no duplicated parse-helper body remains outside the shared module

#### Scenario: Pi suite stays green

- GIVEN the consolidated helper
- WHEN `bun run typecheck` and `bun run test` run in `drenyra-pi`
- THEN both pass

### Requirement: Protected repositories and files stay untouched

The system MUST NOT modify any file in `drenyra-command-center` (excluded
entirely — concurrent agent session active) and MUST NOT modify the protected
`drenyra-pi` user-owned files (`__tests__/agents.test.ts`,
`__tests__/extension.test.ts`, `scripts/verify-package-files.mjs`). Integrity
MUST be evidenced by comparing `git status --porcelain` before and after the
change in every touched repository.

#### Scenario: Exclusion list verified per repo

- GIVEN the before and after working-tree states of `drenyra-pi` and
  `drenyra-ai`
- WHEN every changed path is checked against the exclusion list
- THEN no excluded path appears in any diff

## Acceptance criteria (per slice-1 item)

- **a (flow dedup):** `flow/close.ts` no longer declares its own RUC or period
  regex; it imports `isValidRuc`/`isValidPeriod` from `../candidates/types.js`;
  `flow/__tests__/close.test.ts` preflight assertions still pass; `candidates`
  export surface is byte-identical.
- **b (stale note):** the `contracts/README.md` prose states brand-system DRAFT
  at `0.2`, matching `tokens.json` and the README table; no normative contract
  content changes.
- **c (nanoid):** `package.json` gains an `overrides` entry pinning `nanoid`
  `>= 3.3.17`; `bun install` regenerated `bun.lock`; no `nanoid` resolution
  below `3.3.17` remains; `git diff --stat bun.lock` shows only
  nanoid-related churn; `bun run typecheck` and `bun run test` pass in
  `drenyra-ai`.
- **d (portable scaffolds):** the three in-scope `BRAND.md` files contain no
  `/home/` or `/PROYECTOS/` absolute path; each documents the `../<repo>`
  sibling convention and the relative checker command; `drenyra-command-center`
  untouched.
- **e (pi dedup):** one shared fail-closed parse helper exists; the eight
  modules consume it; per-site fail-closed semantics and error labels are
  preserved; the three protected pi files are untouched; `bun run typecheck`
  and `bun run test` pass in `drenyra-pi`.

## Non-goals (explicitly out of scope for this spec)

- **Slice 2 — checksummed RUC consolidation policy.** Decision-gated: it
  requires resolving whether canonical `isValidRuc` remains shape-only or
  becomes checksummed, a caller-impact inventory, and a major-version migration
  path. The spec for slice 2 MUST be written after that decision and MUST NOT be
  implemented as an in-place public behavior change.
- **Slice 3 — skills content migration.** Decision-gated: it requires choosing
  the `drenyra-skills` distribution boundary (separately versioned package vs
  deployment-time content source) and a compatibility/migration design. The
  spec for slice 3 MUST be written after that decision.
- No access to or modification of `drenyra-command-center` (any file).
- No modification of the protected user-owned `drenyra-pi` files.
- No public API or export change; frozen v0.1 contracts remain frozen.
- No RUC checksum semantics change; no invented tax/fiscal rules or content.
- No redesign of NDJSON formats, persistence schemas, or fail-closed behavior.
- No broad dependency upgrade beyond the `nanoid` fix; no new branding assets.
- No change to `brand-ecosystem-status.mjs` behavior (it already assumes the
  sibling layout; this spec only documents that convention in the scaffolds).

## Verification commands

```bash
# drenyra-ai — flow dedup, README note, nanoid
cd drenyra-ai
bun run typecheck
bun run test
git diff --stat package.json bun.lock        # override + nanoid-only churn
grep -n "nanoid" bun.lock                    # every resolution >= 3.3.17
grep -rn "RUC_RE\|PERIOD_RE" flow/close.ts   # expect: no local declarations
grep -n "brand-system is DRAFT" contracts/README.md   # expect: "at v0.2"
cat contracts/brand-system/tokens.json | grep '"version"'  # expect: "0.2"

# drenyra-pi — parse-helper dedup + protected-file integrity
cd drenyra-pi
git status --porcelain                       # before/after: capture for evidence
bun run typecheck
bun run test
git diff --name-only                         # no __tests__/agents.test.ts,
                                            # no __tests__/extension.test.ts,
                                            # no scripts/verify-package-files.mjs

# brand scaffolds — portability scan (all three repos)
grep -rn "/home/\|/PROYECTOS/" drenyra-pi/assets/branding/BRAND.md \
  drenyra-skills/assets/branding/BRAND.md \
  drenyra-guardian-angel/assets/branding/BRAND.md   # expect: zero matches

# drenyra-command-center — integrity (must remain untouched by this change)
cd drenyra-command-center && git status --porcelain  # no paths from this change
```

## Risks

- The pi parse consolidation touches behavioral edges (throw vs empty, `\n` vs
  `/\r?\n/`); the helper must parameterize per-site semantics or the design must
  explicitly standardize with tests. Mitigated by the per-site preservation
  requirement and the pi test suite.
- `bun install` may resolve `nanoid` beyond the override if upstream ranges
  change later; the override is the narrowest current fix and should be removed
  when upstream resolution is safe (proposal risk, retained).
- Portable `BRAND.md` references retain the sibling-checkout assumption already
  baked into `brand-ecosystem-status.mjs`; this is a documented convention, not
  a host-specific path, and may need revisiting if the layout changes.
- Archive: no canonical `openspec/specs/{domain}/spec.md` exists for these
  domains; this is a single change-level full spec per the orchestrator's
  requested path. Archive must map/copy it into the canonical store; consider
  splitting by domain (`drenyra-ai`, `drenyra-pi`, `brand-scaffolds`) at
  archive time if the store requires domain granularity.
- Protected-file integrity depends on git state; the before/after
  `git status --porcelain` evidence is mandatory and must be captured in the
  apply phase.
