# Proposal — Drenyra Ecosystem Cleanup

> Change: `drenyra-ecosystem-cleanup`  
> Store: OpenSpec  
> Status: Proposed

## Why

The ecosystem currently has several small but compounding ownership failures:

- RUC validation is split between a shape-only validator in the released `drenyra-ai` package and a checksummed Módulo 11 implementation in `drenyra-pi`; `drenyra-ai/flow/close.ts` also duplicates RUC and period patterns instead of using its own candidate module.
- `drenyra-pi` repeats the same fail-closed NDJSON parsing behavior across approximately eight internal modules, increasing the chance that error handling diverges.
- `drenyra-skills` claims ownership of the content layer while the actual `BASE_PE_SKILLS` content remains under `drenyra-ai/skills`, leaving package and operational ownership ambiguous.
- A stale contract note, a vulnerable transitive `nanoid` version, and absolute machine paths in brand scaffolds create avoidable maintenance, security, and portability risk.

This cleanup is worth doing now because the inconsistencies sit at package and repository boundaries. Leaving them unresolved makes later SUNAT-facing and Peru v1 work harder to explain, version, audit, and release safely.

## Intent

Establish clear ownership for reusable validation, parsing, and skills content without changing frozen public contracts in the first slice. The change is organized into three independently reviewable slices:

1. **Safe internal deduplication and hygiene:** remove internal duplication, correct stale metadata, remediate the vulnerable transitive dependency, and make in-scope brand scaffolds portable without changing public exports or contract behavior.
2. **Checksummed RUC consolidation policy:** define and then implement, under an explicit versioned migration, one authoritative RUC-validation policy rather than preserving competing semantics.
3. **Skills content migration:** move existing Peru skills content to the repository that claims content ownership while keeping runtime registry/orchestration mechanics in `drenyra-ai`.

## Architecture and roadmap alignment

This change supports the 16-program Peru v1 roadmap as enabling infrastructure rather than adding a new program or integration. It improves the consistency of SUNAT-facing identifier validation and makes the content/runtime ownership boundary explicit before further Peru-specific capabilities are added.

The proposal preserves the approved architecture:

- Deterministic validation and fail-closed parsing remain library concerns; AI orchestration does not acquire accounting authority.
- `drenyra-ai` remains independent of `drenyra-pi`, `drenyra-skills`, and Drenyra Core. No reverse dependency is introduced.
- Audit-ledger, accounting-journal, evidence, and memory responsibilities remain unchanged.
- Frozen v0.1 contracts remain unchanged in slice 1.

## What changes

### Slice 1 — Safe internal deduplication and hygiene

- In `drenyra-ai`, make `flow/close.ts` consume the existing internal RUC and period patterns from `candidates/types.ts` instead of redeclaring them.
- In `drenyra-pi`, extract the repeated fail-closed NDJSON/JSON parsing behavior into one internal helper and migrate only the known duplicate call sites that do not overlap user-owned uncommitted files.
- Correct the stale `contracts/README.md` brand-system version note so it agrees with the current token version, without changing normative contract contents or versions.
- Resolve the vulnerable transitive `nanoid@3.3.16` dependency to a non-vulnerable compatible version (`>=3.3.17`) through the least invasive lockfile/package-manager mechanism.
- Replace absolute machine-specific paths in the in-scope `BRAND.md` scaffolds with repository-portable references, excluding all files in `drenyra-command-center`.

### Slice 2 — Checksummed RUC consolidation policy

- Adopt one documented semantic distinction between “11-digit RUC-shaped input” and “valid RUC under the existing Módulo 11 checksum implementation.”
- Make the checksummed implementation authoritative in `drenyra-ai`, so downstream runtimes consume released canonical behavior rather than maintaining a copied implementation.
- Remove the stale source attribution in `drenyra-pi` only when that repository can consume the released canonical implementation safely.
- Treat any public export addition, removal, rename, or behavior strengthening as a breaking release requiring a major version and an explicit migration path.

### Slice 3 — Skills content migration

- Move the existing `BASE_PE_SKILLS` content, unchanged in fiscal meaning, from `drenyra-ai/skills` to `drenyra-skills`.
- Keep registry mechanics, orchestration, and runtime loading responsibilities in `drenyra-ai`.
- Replace content ownership references with an explicit package/repository boundary selected in design.
- Preserve provenance and verify that the migrated content is byte-equivalent or structurally equivalent apart from required packaging metadata.

## Scope and affected areas

| Area | Intended effect |
| --- | --- |
| `drenyra-ai/candidates` and `flow` | Internal reuse now; authoritative RUC semantics only in a later versioned slice |
| `drenyra-ai/contracts/README.md` | Correct non-normative version documentation |
| `drenyra-ai` dependency resolution | Remove the known vulnerable `nanoid` resolution without broad dependency churn |
| `drenyra-pi` internal stores/chains | Consolidate duplicated fail-closed parse handling without changing external behavior |
| `drenyra-skills` and `drenyra-ai/skills` | Establish content ownership and runtime/content separation |
| In-scope brand scaffolds | Remove host-specific absolute paths |

## Non-goals

- **No access to or modification of `drenyra-command-center`.** It is excluded entirely because another agent session is active and concurrent edits are a corruption hazard.
- **No modification of user-owned uncommitted files in `drenyra-pi`.** In particular, `__tests__/agents.test.ts`, `__tests__/extension.test.ts`, and `scripts/verify-package-files.mjs` must not be touched. Pi work is limited to safe internal deduplication outside those files.
- **No public API or export change in slice 1.** `drenyra-ai` is released and its v0.1 contracts are frozen. Public export or behavioral-contract changes require a major version and a documented migration path.
- **No authored or fabricated fiscal/tax content.** The skills migration is structural: move existing files/content and update registry references only.
- No new SUNAT integration, tax-policy interpretation, accounting authority, journal behavior, evidence model, or memory behavior.
- No creation of missing banner artwork and no broader branding redesign.
- No broad dependency upgrade unrelated to resolving the identified `nanoid` vulnerability.
- No redesign of NDJSON formats, persistence schemas, or fail-closed behavior.

## Decision gaps and recommendations

### RUC single-source-of-truth policy

**Decision required:** Keep canonical `isValidRuc` shape-only, or promote checksummed validation to the canonical meaning.

**Recommendation:** Promote checksummed validation as the canonical validity policy, while explicitly preserving “shape check” as a separately named concept during the migration. A function named `isValidRuc` should not accept an invalid checksum merely because the value has 11 digits. This provides the strongest deterministic boundary for later SUNAT-facing flows and eliminates the misleading split between packages.

This recommendation must not be implemented as an in-place public behavior change. Design must define a major-version migration that identifies affected callers, offers an explicit shape-only replacement where required, publishes the checksummed implementation from `drenyra-ai`, and moves `drenyra-pi` only after the released dependency is available.

### Skills migration boundary

**Decision required:** Choose how `drenyra-ai` references content owned by `drenyra-skills` without introducing a reverse dependency or silently changing package behavior.

**Recommendation:** `drenyra-skills` should own and package the existing static content; `drenyra-ai` should retain only registry interfaces and runtime loading/orchestration mechanics. Design must select an explicit dependency or deployment boundary and define compatibility during migration. Content must not be duplicated as two writable sources of truth.

### Proposal question round — assumptions requiring review

The following product questions are recorded for review because this proposal is being produced in automatic delegated mode rather than pausing for an interactive round:

1. Are existing consumers known to rely on 11-digit shape-only acceptance as business-valid RUC acceptance? Assumption: this is unknown, so slice 2 requires caller inventory and a major-version migration.
2. Should invalid-checksum RUC values be rejected at candidate creation, close validation, or both? Assumption: both should eventually use the same canonical policy, but the design must preserve current error boundaries during migration.
3. Is `drenyra-skills` intended to be a separately versioned package or a deployment-time content source? Assumption: ownership is clear but distribution is not, so design must decide before files move.
4. Must brand scaffolds work when sibling repositories are not checked out together? Assumption: yes; references should be repository-relative or stable public references rather than host-absolute paths.

## First-slice boundaries

Slice 1 contains exactly the following work:

1. Replace the private RUC/period regex declarations in `drenyra-ai/flow/close.ts` with imports from `drenyra-ai/candidates/types.ts`, with no export-surface or validation-semantic change.
2. Consolidate the duplicated fail-closed NDJSON/JSON parse helper in the identified `drenyra-pi` store and chain modules, provided the implementation and its verification do not modify any user-owned uncommitted file.
3. Correct only the stale brand-system version note in `drenyra-ai/contracts/README.md`.
4. Resolve only the known `nanoid@3.3.16` vulnerability to a compatible fixed resolution and update the corresponding package-manager artifacts.
5. Replace absolute machine paths only in the in-scope `BRAND.md` scaffold files outside `drenyra-command-center`.

Slice 1 does **not** change RUC checksum semantics, add or alter public exports, move skills content, modify fiscal content, change persistence formats, create branding assets, or touch `drenyra-command-center` or the listed user-owned files.

## Acceptance criteria

### Slice 1

- `flow/close.ts` no longer declares its own RUC or period regex and current observable validation behavior remains unchanged.
- The identified `drenyra-pi` modules use one internal fail-closed parse helper; malformed or unreadable records continue to fail closed with no schema or public behavior change.
- Git diff confirms the protected `drenyra-pi` files and all of `drenyra-command-center` are untouched.
- The brand-system documentation note agrees with the token version and no normative contract version changes.
- Dependency resolution contains no `nanoid` version affected by CVE-2024-55565, and unrelated dependency churn is absent or justified.
- In-scope `BRAND.md` scaffolds contain no absolute host paths and remain usable from their repositories.
- Relevant tests, typecheck, build, and package verification pass in each modified repository where the existing harness supports them.

### Slice 2

- The design documents separate shape validation from checksum validation and identifies the canonical owner.
- A caller-impact inventory and major-version migration path exist before any public export or semantic change.
- The checksum algorithm is consolidated from the existing implementation; no new tax rule is invented.
- After migration, `drenyra-pi` does not maintain a divergent checksum implementation and consumes a released compatible source.
- Candidate and close workflows have specified, testable behavior for valid shape/valid checksum, valid shape/invalid checksum, malformed input, and unavailable dependency states.

### Slice 3

- One repository is the writable source of truth for `BASE_PE_SKILLS` content.
- Existing fiscal/tax content is moved without substantive authorship or interpretation changes.
- `drenyra-ai` retains runtime registry/orchestration mechanics without violating its dependency direction.
- Packaging/loading behavior, version compatibility, rollback, and missing-content failure behavior are specified before migration.
- No duplicate writable content remains after the migration compatibility window.

## Risks and tradeoffs

- Strengthening `isValidRuc` can reject values accepted by current consumers. A major release and explicit migration are mandatory; this blocks slice 2 implementation until design resolves the transition.
- Moving skills content may introduce release-order or runtime-availability coupling. This blocks slice 3 implementation until the distribution boundary is designed.
- Internal NDJSON deduplication can accidentally alter fail-closed behavior if call-site differences are erased; the helper must preserve each documented return/error contract.
- A package-manager override can mask upstream resolution behavior. Prefer the narrowest compatible fix and remove the override when upstream dependency ranges resolve safely.
- Portable brand references may depend on repository layout. References must not assume sibling repositories unless that requirement is explicitly retained and tested.
- Concurrent or user-owned work creates a hard integrity boundary: protected paths must be checked before and after each applicable slice.

## Rollback

- **Slice 1:** revert the internal import/helper/documentation/path/dependency-resolution commits independently. No data migration or public contract rollback is expected.
- **Slice 2:** retain the prior major line during migration; downstream adoption must be reversible by restoring the prior released dependency and shape-only call path. Do not remove migration aliases until consumers are verified.
- **Slice 3:** retain an immutable pre-migration content snapshot and registry mapping. If packaging or loading fails, restore the prior registry reference and content location without editing the content itself.

## Success criteria

The cleanup succeeds when:

- every in-scope reusable rule or content set has one documented owner;
- slice 1 removes known low-risk duplication and hygiene defects without changing released behavior;
- RUC checksum consolidation has an approved major-version migration rather than an accidental breaking change;
- skills content has a designed structural migration with no fabricated fiscal content;
- protected repositories and user-owned files remain untouched; and
- each slice can be released and rolled back independently with evidence from the repository's existing verification harness.
