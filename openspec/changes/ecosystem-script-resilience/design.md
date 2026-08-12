# Technical Design — ecosystem-script-resilience (Slice A)

## Overview

Slice A makes two existing cross-repository scripts diagnose relocated or absent sibling repositories truthfully while preserving their fail-closed behavior. The implementation is deliberately local to each script: both scripts independently apply the same root-precedence contract, and one focused subprocess test file verifies the public CLI behavior.

The precedence is fixed and MUST remain exactly:

1. non-empty `DRENYRA_ECOSYSTEM_ROOT`;
2. `--root <dir>` only when the environment value is unset or whitespace-only;
3. the existing `..` sibling layout.

No shared module, package change, CI change, network operation, or integrity bypass is introduced.

## Design decisions

### 1. Duplicate the small root resolver in each script

Each script will define a private local resolver rather than importing a shared helper. The resolver:

- reads `process.env.DRENYRA_ECOSYSTEM_ROOT` and trims it;
- treats an empty or whitespace-only result as unset;
- reads the value immediately following `--root` when it is a non-empty, non-option token;
- resolves configured relative paths against the process working directory with `resolve(...)`;
- otherwise returns `resolve(ROOT, "..")`, which is path-equivalent to the current hardcoded sibling base.

This duplication is intentional. It keeps the change reversible and avoids creating a third runtime surface for two small scripts.

`skills-conformance --manifest <path>` remains a separate selection step. When present, it resolves exactly as today and directly selects the manifest regardless of environment or `--root`. Root resolution only supplies the default manifest base.

### 2. Keep the current repository outside the sibling-root override

In `brand-ecosystem-status`, `drenyra-ai` continues to resolve to the script's own repository root. Only the five sibling repository entries are joined to the resolved ecosystem root. This preserves the meaning of “sibling root” and prevents an override from redirecting checks for the current repository.

### 3. Add an early directory-existence branch for brand siblings

`statusFor(repo)` will first distinguish whether the expected repository directory exists. For an absent sibling directory it returns:

```json
{
  "state": "SIBLING_MISSING",
  "detail": "sibling repository not found at <absolute-path>; place <repo-name> there or rerun with --root <ecosystem-root>"
}
```

The detail is human-readable, contains the expected absolute path, and gives a local continuation without prescribing an external network or clone operation.

The current `drenyra-ai` entry is not reclassified as a missing sibling because its root is the active repository. Once a repository directory exists, the current banner lookup, branding-directory scan, checker invocation, and `MISSING` / `FAIL` / `PASS` decisions run unchanged.

The aggregate result remains fail-closed: only all-`PASS` produces `gate: "FREEZE-READY"`, `pass: true`, and exit 0. `SIBLING_MISSING`, like every existing non-pass state, produces `PENDING` and exit 1.

### 4. Emit one valid skills failure envelope per output mode

Manifest reading and parsing remain a single fail-closed operation. On failure, the script builds an actionable hint that names the expected sibling location and the existing direct manifest override:

```text
place drenyra-skills under <resolved-root>, or run bun run scripts/skills-conformance.mjs --manifest <readable-registry.json>
```

Human mode writes the existing `cannot read <attempted-path>: <reason>` diagnostic plus the hint to stderr, then exits 1.

JSON mode writes only one valid JSON document to stdout and exits 1:

```json
{
  "contract": "skills-registry",
  "manifest": "<attempted-absolute-path>",
  "pass": false,
  "problems": ["cannot read manifest: <reason>"],
  "hint": "<actionable continuation>"
}
```

This uses the existing success-envelope field names and adds only `hint`. Successful JSON remains byte-shape compatible: `{ contract, manifest, pass, problems }` with no `hint` field. Existing conformance comparison and success behavior are not changed.

## Data flow

### `brand-ecosystem-status`

1. Parse arguments and environment.
2. Resolve sibling root with environment > flag > existing default.
3. Build repository descriptors: local `drenyra-ai` at `ROOT`; siblings beneath the resolved root.
4. For each sibling, check repository-directory existence before content checks.
5. Return `SIBLING_MISSING` early when absent; otherwise run the existing content/checker flow.
6. Aggregate results into the unchanged top-level `{ gate, pass, repos }` JSON shape or human table.
7. Exit 0 only if every repository state is `PASS`; otherwise exit 1.

### `skills-conformance`

1. Parse arguments and environment.
2. Resolve sibling root with environment > flag > existing default.
3. Select `--manifest` directly when supplied; otherwise derive `<root>/drenyra-skills/skills/registry.json`.
4. Read and parse the manifest.
5. On failure, emit the mode-specific diagnostic envelope and exit 1.
6. On success, run the existing field comparison and existing human/JSON rendering unchanged.

## File changes and exact allowlist

Implementation MUST modify only these paths:

1. `scripts/brand-ecosystem-status.mjs`
   - document `DRENYRA_ECOSYSTEM_ROOT` and `--root` usage;
   - add the local root resolver;
   - build sibling paths from the resolved root;
   - add the early `SIBLING_MISSING` result.
2. `scripts/skills-conformance.mjs`
   - document root override usage;
   - add the local root resolver;
   - derive only the default manifest from that root;
   - emit actionable human and JSON failure diagnostics.
3. `scripts/__tests__/ecosystem-resilience.test.ts` (new)
   - isolated subprocess fixtures and assertions for the accepted specification.

Everything else is denied, including `package.json`, lockfiles, shared helpers, configuration, contracts, workflows, generated files, sibling repositories, and active change directories. The OpenSpec artifacts are planning records, not implementation allowlist entries.

## CLI and output contracts

### Root options

Both scripts accept:

```text
DRENYRA_ECOSYSTEM_ROOT=<dir> <existing command>
<existing command> --root <dir>
```

Configured relative roots resolve from the caller's current working directory. Whitespace-only environment input is unset. If both sources contain usable values, the environment value wins. No filesystem scanning, implicit discovery, config file, or alternate environment variable is consulted.

### Brand JSON

The top-level and repository object field sets remain unchanged:

```ts
{
  gate: "FREEZE-READY" | "PENDING";
  pass: boolean;
  repos: Array<{
    name: string;
    state: "PASS" | "FAIL" | "MISSING" | "SIBLING_MISSING";
    detail: string;
  }>;
}
```

`SIBLING_MISSING` is additive. `MISSING` retains its current meaning for a present repository without qualifying content. No error text is written outside the JSON document for an ordinary missing-sibling result.

### Skills JSON

Successful output is unchanged. Manifest read/parse failure in JSON mode uses the same core fields with `pass: false`, a non-empty `problems` entry, and additive `hint`. The attempted manifest path is absolute. JSON-mode stdout contains exactly one parseable JSON document; the process still exits 1.

## Strict TDD and test architecture

Implementation follows RED → GREEN → TRIANGULATE → REFACTOR. The test is written first and must fail for the missing behavior before either script is edited.

Focused command:

```bash
bun run test -- scripts/__tests__/ecosystem-resilience.test.ts
```

The test invokes the real CLIs as isolated child processes:

- Node runner: `process.execPath scripts/brand-ecosystem-status.mjs ...`;
- Bun runner: `bun run scripts/skills-conformance.mjs ...`;
- `spawnSync` captures `status`, `stdout`, and `stderr` without shell interpolation;
- every invocation receives an explicit environment copied from the test process and then deliberately sets or deletes `DRENYRA_ECOSYSTEM_ROOT`;
- temporary roots are created with `mkdtempSync` and removed in `afterEach`/`afterAll` using recursive forced cleanup;
- fixtures never read a real sibling checkout and never access the network.

Required scenarios:

1. **Brand root precedence:** different environment and flag fixture roots prove environment wins; whitespace-only environment proves the flag wins.
2. **Brand absent siblings:** an empty explicit root yields `SIBLING_MISSING` for all five expected sibling entries, includes each absolute path, remains valid JSON, and exits 1.
3. **Brand present content paths:** a created sibling directory without branding yields `MISSING`; a generated in-test palette-conformant PNG at one canonical banner path yields `PASS`; an off-palette PNG yields the existing `FAIL`. Aggregate exit remains non-zero unless every required repository passes.
4. **Skills root precedence:** missing-manifest JSON exposes the attempted absolute path, proving environment > flag and whitespace-only environment fallback.
5. **Skills diagnostics:** missing default/selected manifest produces exit 1, parseable JSON with `pass: false` and `hint`, while human mode names the attempted path and `--manifest` continuation.
6. **Manifest independence:** a temporary manifest serialized from `BASE_PE_SKILLS` passes through explicit `--manifest` even when environment and `--root` point elsewhere; successful JSON has no added `hint`.
7. **Default `..` without ambient dependencies:** copy each target script into a temporary miniature repository layout. For brand, leave banner paths absent so its checker is never invoked. For skills, provide a minimal local `skills/pe.ts` stub exporting `BASE_PE_SKILLS = []`. Run with neither root source and assert attempted sibling paths resolve beside the temporary repository. This proves the default without consulting any real sibling checkout.

The PNG helper may reuse the repository's existing minimal in-test encoder pattern, but it remains private to the new test file and generates only temporary fixture bytes.

After GREEN, triangulate environment, flag, default, human, and JSON paths before small local refactoring. No production export is added solely for tests.

Final verification commands:

```bash
bun run test -- scripts/__tests__/ecosystem-resilience.test.ts
bun run test
bun run typecheck
bun run lint
```

Record exact command results during apply/verify. The runtime harness evidence is the focused subprocess suite; it is not `N/A`.

## Work unit and review forecast

Treat Slice A as one reviewable work unit because the shared precedence contract, two CLI implementations, and subprocess regression test must remain coherent. Tests ship with the behavior. Rollback removes the new test and reverts both scripts without touching unrelated work.

Conservative authored-change forecast:

| Surface | Additions + deletions |
| --- | ---: |
| `brand-ecosystem-status.mjs` | 30–45 |
| `skills-conformance.mjs` | 35–50 |
| `ecosystem-resilience.test.ts` | 150–175 |
| **Total** | **215–270** |

The implementation must stop and re-scope before exceeding 300 authored additions plus deletions. Generated temporary fixture bytes do not create repository files and therefore add no authored lines. The forecast is below both the Slice A 300-line cap and the 400-line chained-PR threshold; chained PRs are not recommended.

## Rollout and rollback

No migration or staged rollout is required. Defaults remain the current sibling layout, explicit `--manifest` remains compatible with CI, and all new behavior is additive diagnostics/configurability. CI configuration is intentionally untouched.

Rollback is a single bounded revert of the two script edits plus deletion of the focused test. It restores the previous hardcoded `..` behavior and diagnostics; no stored data, dependency, package interface, workflow, or sibling repository is affected.

## Risks and mitigations

- **Precedence regression:** table-driven subprocess assertions pin environment > flag > default for both scripts.
- **Ambient environment leakage:** every child environment explicitly sets or deletes `DRENYRA_ECOSYSTEM_ROOT`.
- **Default-path test accidentally uses real siblings:** miniature copied-script layouts isolate the default and prevent ambient sibling discovery.
- **Present repositories get misclassified:** directory existence is a narrow early branch; existing content logic remains intact and gets MISSING/PASS/FAIL regression coverage.
- **JSON consumers break:** success envelopes remain unchanged; failure changes are additive and every JSON failure is parsed in tests.
- **Hint becomes stale or unsafe:** it references only the existing local flag/manifest mechanisms and contains no remote URL or external network instruction.
- **Scope/budget creep:** the three-path allowlist and 300-line hard stop are explicit.
