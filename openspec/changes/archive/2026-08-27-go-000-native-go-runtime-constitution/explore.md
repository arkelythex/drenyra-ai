# Exploration — GO-000 Native Go Runtime Constitution

> Constitutional exploration only for the approved GO-000 work unit. No Go implementation, configuration change, contract edit, commit, push, or PR. Repository: `drenyra-ai-native-go`.
>
> Approved issues: Master #80 and GO-000 #81. OpenSpec delivery defaults: automatic execution, auto-chain, 300 changed lines, feature-branch-chain.

## Executive finding

The current TypeScript/Node runtime and stable 0.5.0 CLI are the temporary behavioral oracle. GO-000 defines the migration constitution; it does not implement Go, change configuration, or reshape the existing runtime. The compatibility boundary is the frozen, transport-independent contract behavior—not current module layout, broad JavaScript exports, or convenience CLI discovery.

TS 0.5.0 may generate and validate migration evidence, but production Go must not import, shell out to, or discover it. The target remains a transport-independent Go core with explicit adapters and a separately controlled consumer boundary.

## Current state and boundaries

- `contracts/**` and its frozen conformance vectors are normative, versioned, read-only inputs for GO-000.
- Shallow top-level canonicalization is a byte-level compatibility rule; deep or recursive normalization is not an allowed improvement.
- Fiscal behavior must preserve BigInt-safe cents and RUC handling, receipt-before-material-action, fail-closed scope and gates/approval, and append-only audit invariants.
- `auto-forecast` is legacy behavior. It may be migrated, retained behind an explicit non-authoritative boundary, or retired; it must not acquire authority or become a hidden Go prerequisite.
- Current Drenyra Pi policy already forbids `PATH` execution. Ambient, global, alias-based, or PATH-resolved execution is therefore a prohibited migration risk that must remain impossible—not a claim about current verified behavior.
- Drenyra AI must not depend on Drenyra Pi, and contracts must not contain host-specific bindings. Package-local Pi integration belongs to GO-090.
- GO-000 must coexist with the Dominion program and unrelated active OpenSpec changes, including `fiscal-authority-kernel`, without absorbing their files, assumptions, or delivery state.

## Constitutional rules

1. **Contracts first:** Go conforms to frozen contracts; it does not redefine them.
2. **Byte identity:** canonicalization, hashing, serialization, candidate identity, and receipts match the shallow byte contract exactly.
3. **Oracle only:** TS 0.5.0 supplies temporary differential evidence, never a production dependency.
4. **Authority remains deterministic:** scope, RUC, BigInt cents, receipts, gates, approvals, and append-only audit behavior remain fail-closed.
5. **Frozen inputs:** GO-000 may inspect contracts, fixtures, and conformance suites but may not edit them.
6. **Explicit coexistence:** TS and Go coexist only through declared identities, versions, boundaries, and evidence.
7. **Consumer direction:** exact package-local Pi invocation is a later integration concern owned by GO-090; PATH/global/ambient fallback must remain impossible.

## Program order and gates

| Work unit | Constitutional role and exit boundary |
|---|---|
| GO-010 | **Harness only.** Establish differential infrastructure, shared fixture/oracle capture, invocation and comparison protocol, deterministic mismatch diagnostics, staged parity criteria, and at least one sentinel/reference comparison proving the mechanism. It must not require a production Go runtime, package-local Pi integration, or full domain/contract parity. |
| GO-020 | Introduce the native Go skeleton and its transport-independent package/runtime shape. |
| GO-030–GO-070 | Progressively add receipt/crypto; candidate/materiality/scope/gates; missions/recovery; ledger/persistence; and CLI/MCP parity. Applicable vectors become green in the corresponding later verticals. |
| GO-090 | Add package-local Pi integration and verify exact runtime identity/provenance at that consumer boundary. |

GO-000 exits into proposal/specification when these boundaries, dependencies, frozen inputs, oracle role, and staged program order are explicit. It does not claim migration completion or GO-010 parity.

## Risks and evidence requirements

- **Semantic drift:** require byte-level differential fixtures and deterministic mismatch diagnostics.
- **Authority drift:** keep forecast and adapters non-authoritative; preserve fail-closed invariants.
- **Execution drift:** treat ambient/global/PATH resolution as a prohibited state and test later package-local integration against that constraint.
- **Contract churn:** escalate any mismatch as a separately approved contract-regime decision; do not edit frozen contracts here.
- **Parallel-change conflict:** inventory active OpenSpec changes before overlapping later work.
- **False completion:** GO-010 proves only the harness mechanism; later verticals own applicable green vectors.

## Non-goals

No Go source, module, CLI, adapter, build/configuration change, TypeScript/Node change, contract/schema/fixture/vector edit, Pi implementation, transport/framework design, `auto-forecast` behavior change, version bump, release, or unrelated OpenSpec change is included in GO-000.

## Recommendation

Proceed to proposal/specification with GO-000 as a concise constitution. Keep TS 0.5.0 as a temporary oracle, make shallow byte compatibility and fiscal invariants explicit, constrain GO-010 to harness infrastructure, reserve the native skeleton for GO-020 and package-local Pi integration for GO-090, and treat any contract, scope, authority, or boundary ambiguity as a blocker.

## Artifact status

- Exploration corrected in place; no implementation or configuration files changed.
- Intended next phase: `propose`.
- `skill_resolution`: `paths-injected`.
