# Proposal — GO-000 Native Go Runtime Constitution

## Decision

Adopt a migration constitution that defines Drenyra AI as a language-independent, frozen fiscal contract surface whose target executable implementation is a deterministic native Go runtime. GO-000 implementation is a bounded governance change: it updates the repository constitution/configuration and may add the minimal auditable program documentation needed to govern GO-010 through GO-100. It does not change runtime behavior, introduce Go code, edit frozen contracts, modify Drenyra Pi, or retire any current JavaScript surface.

This work is bound to the Drenyra AI Native Go program Master issue **#80** and the approved GO-000 issue **#81**. Those issues define the authorized program and work-unit boundary; this proposal must not absorb unrelated OpenSpec work, including the Dominion program or `fiscal-authority-kernel`.

## Intent

Establish the rules, dependencies, compatibility boundaries, and evidence expectations that all later native Go migration work must follow, and align the repository's governing OpenSpec configuration with those rules before Go work begins. The constitution makes the frozen fiscal behavior—not the current TypeScript module structure—the source of compatibility truth.

The target outcome is a deterministic native Go runtime that conforms to the existing transport-independent fiscal contracts while preserving the current TypeScript 0.5.0 implementation only as a temporary behavioral oracle and compatibility surface during migration.

## Current-state gap

Drenyra AI currently has a TypeScript/Node implementation and a stable 0.5.0 CLI, but it does not yet have an approved constitutional boundary for replacing that executable implementation with native Go. Without this boundary, later work could accidentally:

- treat TypeScript module layout or broad JavaScript exports as the permanent contract;
- alter frozen contracts to accommodate implementation convenience;
- introduce deep canonicalization or other byte-level drift;
- weaken fiscal scope, receipt, approval, gate, or audit invariants;
- make the TypeScript oracle a production dependency;
- couple Drenyra AI to Drenyra Pi or permit ambient/PATH runtime discovery;
- claim parity before staged evidence proves the applicable behavior;
- retire compatibility surfaces before consumers have an explicit migration path.

The repository configuration also preserves TypeScript/Node-specific architecture guidance, records unsupported `delivery_strategy: auto-forecast`, and presents current Bun/Vitest commands without distinguishing their legacy TS-oracle role from future Go verification. GO-000 closes both the constitutional and configuration gaps before any Go-bearing implementation begins.

## Target users and maintainers

This constitution serves:

- Drenyra AI maintainers implementing and reviewing the native Go migration;
- fiscal-contract and conformance maintainers protecting byte-level and authority invariants;
- release maintainers proving deterministic parity and executable provenance;
- Drenyra Pi maintainers who will later consume the native runtime through the separately governed GO-090 boundary;
- operators and downstream consumers who need stable behavior while TypeScript and Go coexist.

## Product and architecture outcome

After GO-000, maintainers can plan every migration slice against one explicit rule set:

1. **Language-independent contract surface:** compatibility is defined by frozen contracts, conformance vectors, and observable deterministic behavior, not by TypeScript internals.
2. **Native Go target:** the target executable implementation is a deterministic, transport-independent native Go runtime with explicit adapters.
3. **Fiscal authority preservation:** shallow canonicalization, BigInt-safe cents, RUC/scope isolation, receipt-before-material-action, fail-closed gates and approvals, and append-only audit behavior remain mandatory.
4. **Temporary oracle:** TypeScript 0.5.0 may generate and validate differential evidence but must never be imported, executed, discovered, or required by the production Go runtime.
5. **Controlled coexistence:** current JavaScript exports and the 0.5.0 CLI remain temporary compatibility surfaces until separately approved retirement or versioning work.
6. **One-way consumer boundary:** Drenyra AI remains independent of Drenyra Pi. Exact, verified, package-local, never-PATH Pi consumption belongs only to GO-090.
7. **Truthful repository governance:** OpenSpec configuration states the native Go constitution and supported delivery controls while identifying current test commands as legacy TS-oracle evidence, not proof of a Go toolchain.

## Constitutional rules

### Frozen contract and byte rules

- `contracts/**`, including schemas, fixtures, and conformance vectors, is normative, versioned, and read-only throughout this program unless a separate approved contract-change SDD explicitly authorizes versioning and migration.
- Go must conform to the frozen contracts; it must not redefine or reinterpret them.
- Canonicalization remains **shallow and top-level**. Recursive, deep, or convenience normalization is prohibited even when it appears semantically equivalent.
- Hashing, serialization, candidate identity, receipts, and comparison evidence must preserve exact contract byte behavior.
- Any discovered contract mismatch is a blocker and contract-regime decision, not permission to edit `contracts/**`.

### Fiscal authority rules

- Monetary values remain exact integer cents with BigInt-safe semantics; floats are prohibited.
- RUC, tenant/company, fiscal period, source snapshot, actor, authority level, and the complete bound scope must remain explicit and fail closed on absence, mismatch, or change.
- No material action may occur without its immutable receipt.
- Gates and approvals must fail closed.
- Audit records remain append-only and preserve required actor, reason, RUC, period, and ordering evidence.
- Forecasting, adapters, diagnostics, and migration harnesses are non-authoritative and must not acquire mutation authority.

### Oracle and executable rules

- TypeScript 0.5.0 is the temporary behavioral oracle only.
- Oracle execution is permitted in migration harnesses and differential evidence workflows, never in the production Go runtime.
- The Go runtime must not import TypeScript artifacts, shell out to Node/TypeScript, or discover the oracle through `PATH`, aliases, global installs, or ambient environment state.
- Drenyra Pi remains TypeScript. GO-000 does not modify Pi or define its integration implementation.
- GO-090 must later require exact, verified, package-local native-runtime consumption with provenance checks and no PATH/global/ambient fallback.

### Compatibility rules

- Existing JavaScript exports and the TS 0.5.0 CLI remain available as a temporary compatibility surface during staged migration.
- Their existence does not make broad JavaScript module shape part of the frozen language-independent contract.
- Export removal, compatibility retirement, contract versioning, and consumer migration require later explicitly approved work; GO-000 authorizes none of them.

## Program dependency order

The following order is mandatory. A later work unit must not claim completion of an earlier gate or pull later integration concerns forward.

| Work unit | Authorized role and exit boundary |
| --- | --- |
| **GO-000** | Define and approve the migration constitution, then apply its bounded repository-governance update to `openspec/config.yaml` and any minimal auditable program documentation. No Go runtime source, runtime behavior, frozen-contract, JavaScript-export, or Pi changes. |
| **GO-010** | Build the **harness only**: fixture/oracle capture, deterministic invocation and comparison protocol, mismatch diagnostics, staged parity criteria, and at least one sentinel/reference comparison proving the mechanism. It must not require a production Go runtime or claim full parity. |
| **GO-020** | Introduce the native Go skeleton and transport-independent package/runtime shape. |
| **GO-030–GO-070** | Deliver staged vertical parity for receipt/crypto; candidate/materiality/scope/gates; missions/recovery; ledger/persistence; and CLI/MCP behavior. Each slice owns only its applicable vectors and evidence. |
| **GO-080** | Establish the native Go release boundary and release evidence after required staged parity is complete. It must not silently perform Pi integration or compatibility retirement. |
| **GO-090** | Integrate Drenyra Pi through exact, verified, package-local native-runtime consumption; prove runtime identity/provenance and prohibit PATH/global/ambient fallback. Pi remains TypeScript. |
| **GO-100** | Retire superseded TypeScript runtime surfaces only after approved compatibility, migration, and rollback criteria are satisfied. Any export removal or versioning decision belongs here or in a separately approved contract-change SDD. |

GO-010 depends on GO-000. Each subsequent work unit depends on the constitutional and evidence gates of its predecessors. Parallel implementation is allowed only where it cannot violate these dependency or frozen-input boundaries.

## Scope

### In scope for GO-000

- The migration constitution and its architectural constraints.
- Binding the program to Master issue #80 and approved GO-000 issue #81.
- The frozen-contract, shallow-canonicalization, fiscal-authority, oracle, compatibility, and Pi-consumer boundaries.
- The GO-010 through GO-100 dependency and rollout order.
- A bounded APPLY update to `openspec/config.yaml` that:
  - replaces TypeScript/Node-preserving architecture guidance with the approved language-independent fiscal contracts, deterministic native Go target, and temporary TS 0.5.0 oracle boundary;
  - replaces unsupported `delivery_strategy: auto-forecast` with supported `delivery_strategy: auto-chain`;
  - retains automatic execution, `strict_tdd: true`, the recorded legacy test-capability evidence, and the 300 authored changed-line review budget;
  - identifies existing Bun/Vitest, typecheck, and build commands as legacy TS-oracle commands, while leaving future Go commands explicitly unavailable until a Go-bearing work unit establishes and verifies them.
- Creation or update of only the minimal auditable migration constitution/program documentation needed to govern GO-010 through GO-100.
- `feature-branch-chain` when downstream work is split into chained PRs.
- Explicit rollout, rollback, acceptance, and Definition of Done criteria for constitutional implementation.

### Phase-local edit boundary

Planning phases define and review the governance update but do not mutate repository configuration. This proposal rerun is limited to this existing `proposal.md`. GO-000 APPLY owns the authorized `openspec/config.yaml` and minimal program-documentation changes and must preserve unrelated OpenSpec state.

## Non-goals

GO-000 does not include:

- Go runtime source, modules, binaries, adapters, CLI/MCP implementations, build tooling, or Go test-command claims;
- TypeScript/Node runtime changes, Pi changes, export removal, or CLI behavior changes;
- edits to contracts, schemas, fixtures, vectors, or any file under `contracts/**`;
- implementation of the differential harness, native skeleton, parity verticals, release, Pi integration, or TypeScript retirement;
- transport or framework selection beyond requiring a transport-independent core and explicit adapters;
- contract versioning, data migration, compatibility deprecation, or release publication;
- runtime behavior changes to any legacy `auto-forecast` feature; the in-scope change is only the unsupported OpenSpec delivery-strategy value;
- fabricated evidence that Go tests, typechecks, or builds already exist;
- commits, pushes, pull requests, or modifications to unrelated active OpenSpec changes during this proposal phase.

## Affected areas

GO-000 directly affects:

- `openspec/changes/go-000-native-go-runtime-constitution/` planning artifacts;
- `openspec/config.yaml`, limited to the constitutional architecture, delivery strategy, execution/TDD/review controls, and truthful legacy-versus-future test-command classification;
- any minimal auditable migration constitution/program documentation required to govern GO-010 through GO-100;
- the sequencing and acceptance boundaries of GO-010 through GO-100;
- future review and release expectations for the native Go migration.

It constrains, but does not modify:

- frozen `contracts/**` and conformance vectors;
- the current TypeScript 0.5.0 runtime, CLI, and JavaScript exports;
- future Go core and adapter packages;
- Drenyra Pi;
- release, support, and compatibility-retirement behavior.

## Product tradeoffs

| Decision | Benefit | Cost or limitation |
| --- | --- | --- |
| Freeze contracts during migration | Prevents implementation-driven fiscal drift and preserves consumer trust. | Mismatches can block progress until separately governed contract work is approved. |
| Preserve shallow byte compatibility exactly | Keeps hashes, receipts, and identities deterministic across languages. | Rejects seemingly cleaner deep normalization and requires careful byte-level evidence. |
| Keep TS 0.5.0 as a temporary oracle | Enables differential migration evidence without redefining behavior. | Requires controlled dual-runtime test infrastructure during migration. |
| Keep current JS exports temporarily | Avoids premature consumer breakage. | Extends coexistence and support burden until GO-100 retirement. |
| Defer Pi integration to GO-090 | Preserves one-way architecture and prevents ambient execution shortcuts. | Native Go cannot be declared fully integrated with Pi before late-stage provenance evidence exists. |
| Stage parity by vertical | Makes failures attributable and reviewable. | Full migration takes longer than a single broad rewrite. |
| Use 300-line auto-chained slices | Protects review quality and rollback clarity. | Adds branch and dependency-management overhead. |

The primary accepted tradeoff is slower, evidence-driven migration in exchange for preserving fiscal correctness and executable provenance. Speed must not override frozen contracts or fail-closed authority.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Semantic or byte drift between TypeScript and Go | Critical fiscal identities, receipts, or comparisons could diverge. | Require shallow byte-level differential fixtures, exact serialization checks, and deterministic mismatch diagnostics in later slices. |
| Authority drift into harnesses, forecasts, or adapters | Non-authoritative paths could influence material actions. | Keep those components explicitly non-authoritative and preserve receipt/gate/scope fail-closed rules. |
| TypeScript becomes a hidden production dependency | Native operation would not be deterministic or independently deployable. | Prohibit production import, shell-out, runtime discovery, and ambient oracle dependencies. |
| PATH/global execution reaches Pi integration | The wrong executable could run without verified provenance. | Reserve integration for GO-090 and require exact package-local identity verification with no fallback. |
| Contract churn masks implementation defects | Public fiscal behavior could change to make parity appear green. | Keep `contracts/**` read-only; require a separate approved contract-change SDD for any versioning or migration. |
| Temporary JS compatibility becomes permanent by accident | Support burden and ambiguous ownership persist. | Make GO-100 retirement explicit while requiring separate approval and migration evidence before removal. |
| GO-010 is mistaken for runtime parity | Program could report false completion. | Limit GO-010 to harness mechanics and one sentinel/reference proof; assign applicable parity vectors to GO-030–GO-070. |
| Parallel OpenSpec work is overwritten or absorbed | Unrelated programs could lose state or acquire unapproved assumptions. | Restrict APPLY to the authorized `openspec/config.yaml` fields, the GO-000 artifacts, and minimal program documentation; inventory overlaps and preserve unrelated state. |
| Configuration overstates migration readiness | Downstream work could run TS commands as if they proved Go or could inherit obsolete TS architecture. | Label current commands as legacy TS-oracle evidence, leave Go commands unavailable until verified, and replace only the approved constitutional guidance. |
| Review slices exceed the approved budget | Review quality and rollback clarity degrade. | Use `auto-chain`, a 300-line budget, and `feature-branch-chain`; re-scope rather than silently enlarging a slice. |

## Dependencies

- Master issue #80 and approved GO-000 issue #81 remain the program and work-unit authority.
- Frozen contracts and conformance vectors are required read-only inputs.
- TS 0.5.0 remains available as a temporary oracle until approved retirement.
- GO-010 must establish trustworthy differential evidence before the native skeleton and parity work can make behavioral claims.
- GO-080 requires the applicable staged parity gates from GO-030–GO-070.
- GO-090 requires the released native identity and provenance boundary from GO-080.
- GO-100 requires validated consumer migration and explicit retirement approval after GO-090.

## Rollout

1. Approve GO-000 as the governing constitution.
2. Translate each constitutional rule into transport-agnostic RFC 2119 requirements and Given/When/Then scenarios during specification.
3. Design and task the bounded GO-000 governance work without introducing Go runtime source or runtime behavior.
4. During GO-000 APPLY, update `openspec/config.yaml` to the native-Go constitution and supported `auto-chain` strategy; retain automatic execution, strict TDD, legacy test-capability evidence, and the 300-line budget while distinguishing legacy TS-oracle commands from not-yet-established Go commands.
5. Create or update only the minimal auditable program documentation required to govern GO-010 through GO-100, then verify the configuration and documentation against this constitution.
6. Design and task GO-010 as a harness-only slice under strict TDD and the 300-line budget.
7. Progress through GO-020 and staged GO-030–GO-070 parity gates, preserving exact differential evidence.
8. Release the native runtime through GO-080 only after applicable parity evidence is complete.
9. Integrate Pi through GO-090 using exact, verified, package-local consumption.
10. Consider compatibility retirement only in GO-100 after migration, support, versioning, and rollback evidence is approved.

At every stage, a mismatch in contract bytes, fiscal scope, receipt behavior, executable identity, authority, or constitutional configuration must fail closed and stop advancement to the dependent work unit.

## Rollback

GO-000 changes governance artifacts and configuration, not runtime behavior, contracts, data, or executables. Rollback therefore means:

1. stop downstream native Go work that relies on this constitution;
2. revert only the GO-000 planning/program documentation and the bounded `openspec/config.yaml` fields changed by GO-000;
3. restore the prior configuration values without overwriting unrelated concurrent OpenSpec state;
4. preserve existing TypeScript runtime behavior and legacy test evidence;
5. leave `contracts/**`, current JavaScript exports, TS 0.5.0, and Drenyra Pi unchanged.

After implementation begins in later work units, each work unit must define its own bounded rollback. No rollback may edit frozen contracts to accommodate a failed migration.

## Acceptance criteria

GO-000 is accepted when reviewers can verify that:

- the proposal is explicitly bound to Master #80 and GO-000 #81;
- Drenyra AI is defined as a language-independent frozen fiscal contract surface with deterministic native Go as the target executable implementation;
- GO-000 APPLY makes only bounded constitution/configuration and minimal auditable program-documentation changes, with no runtime, frozen-contract, export-retirement, or Pi change;
- `openspec/config.yaml` replaces TS/Node-preserving architecture guidance with the language-independent fiscal contracts, native Go target, and TS 0.5.0 oracle boundary;
- `delivery_strategy: auto-chain` replaces unsupported `auto-forecast`, while automatic execution, `strict_tdd: true`, test-capability evidence, and the 300-line budget remain intact;
- existing Bun/Vitest, typecheck, and build commands are explicitly classified as legacy TS-oracle commands, and future Go commands are not claimed until established and verified by a Go-bearing work unit;
- `contracts/**` is read-only absent a separate approved contract-change SDD with versioning and migration;
- shallow top-level canonicalization and exact byte identity are mandatory;
- BigInt-safe cents, RUC/scope isolation, receipt-before-material-action, fail-closed gates/approvals, and append-only audit invariants are preserved;
- TS 0.5.0 is a temporary behavioral oracle only and cannot become a production Go dependency;
- current JavaScript exports and the TS CLI are preserved as temporary compatibility surfaces;
- Pi remains TypeScript and GO-090 exclusively owns exact, verified, package-local, never-PATH consumption;
- GO-010, GO-020, GO-030–GO-070, GO-080, GO-090, and GO-100 have explicit ordered boundaries;
- unrelated OpenSpec work remains untouched.

## Success criteria

The constitution succeeds when repository configuration and downstream proposals, specifications, designs, tasks, and reviews express one consistent migration policy and can reject non-conforming work without inferring missing rules. Maintainers can distinguish legacy TS-oracle evidence from future Go verification, use supported `auto-chain` delivery under the retained controls, and audit the GO-010 through GO-100 program boundary. No later slice can legitimately claim completion while depending on changed frozen contracts, deep canonicalization, TypeScript in production, ambient executable discovery, weakened fiscal authority, premature JavaScript retirement, fabricated Go test evidence, or skipped program gates.

## Definition of Done

GO-000 is done when:

- this proposal and its follow-on specification capture the constitutional rules as reviewable, unambiguous requirements;
- downstream design and tasks preserve the mandatory work-unit order and frozen-input boundaries;
- GO-000 APPLY has updated `openspec/config.yaml` exactly within the approved constitutional and delivery-control boundary;
- automatic execution, strict TDD, legacy test-capability evidence, and the 300-line budget are retained, `auto-chain` is configured, and TS-oracle commands are clearly distinguished from future Go commands;
- the minimal auditable migration constitution/program documentation needed for GO-010 through GO-100 exists and is internally consistent;
- the GO-000 artifact set contains no Go runtime implementation, runtime behavior changes, contract edits, JavaScript export retirement, Pi changes, or unrelated OpenSpec modifications;
- rollback can revert the bounded configuration/documentation delta without affecting unrelated state;
- reviewers approve the issue binding, scope, tradeoffs, risks, rollout, rollback, and acceptance criteria;
- the next authorized action after proposal is specification; configuration mutation remains reserved for GO-000 APPLY.

## Next recommended phase

Proceed to `spec` for GO-000 only. The specification must use RFC 2119 language and Given/When/Then scenarios to make the frozen contract, fiscal authority, oracle, compatibility, executable-provenance, dependency-order, and scope-preservation rules testable without introducing implementation behavior.
