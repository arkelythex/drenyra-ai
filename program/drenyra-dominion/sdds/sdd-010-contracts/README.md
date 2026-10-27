---

# SDD-010 — Ecosystem Contracts and Release Train

> Status: lifecycle:complete (contracts frozen + release-train executed) · Maturity: implemented · Wave: 0 · Depends on: SDD-000 · Feeds: SDD-020, SDD-030, SDD-070, SDD-080
>
> **Release-train executed 2026-08-15** (change `sdd-010-release-train`, PRs #52/#53):
> the program-lock checkpoint was PROMOTED (candidate → promoted) with fresh
> revision-bound facts (host 0.4.0, tests 928/928, visibility PUBLIC), verified
> public sibling SHAs (engram/pi), the private trio honestly recorded
> `unknown`/`awaiting-evidence` (E-010), deterministic self-excluding checksums
> (`scripts/checksum-lock.mjs`), and the B5 release attestation recorded. The
> federated release train is executed; the six frozen contracts (v0.1) and the
> evidence-precedence governance are in place.
>
> **Status reconciliation (2026-08-14, evidence E-001/E-004/E-006):** the former
> `PLANNED` label maps to `lifecycle:planned` under the five-axis vocabulary
> ([status-and-evidence.md](../../status-and-evidence.md)); this SDD is recorded
> `lifecycle:active` because the composition artifacts exist (`program-lock.json`,
> its schema, release-train and delivery-sequence records). It is NOT
> `lifecycle:complete`: release-train obligations and the lock's
> historical/current separation remain unreconciled (W2). Lifecycle is never
> derived from capability maturity (R3).

## Purpose

Makes the ecosystem one reproducible composition instead of six `main` branches
taken at different moments. Defines multi-repo compatibility, capability
manifests, versioning rules, and the federated release train governed by
`program-lock.json`.

## Scope

- The six frozen v0.1 contracts and their protection rule: new relationships are
  implemented by composition; any break requires a major version and migration.
- Capability manifests per repository (in the shape of `capability-matrix.yaml`)
  as the Gate 0 snapshot against real repo state.
- Versioning rules and compatibility policy shared across repositories.
- Federated release train: producer publishes immutable candidate → conformance
  CI → federated integration → multi-repo journeys → signed manifest promotion.
- `program-lock.json`: repository, commit SHA, package version, contracts
  consumed/produced, skills and policies, storage schemas, MCP/SDK compatibility,
  conformance status, artifacts and checksums.
- Conformance test suite enforced across contract consumers.

## Non-goals

- Does not implement any vertical business capability.
- No distributed Git transaction machinery — coordination is via immutable
  candidates, never an impossible-to-recover multi-repo commit.
- Does not own per-repo release processes; each repository keeps its own
  implementation, versioning, and tests.

## Dependencies

| SDD | Relationship |
| --- | --- |
| SDD-000 | provides — the constitution: frozen contracts, authority rules, gate criteria |
| SDD-020 | consumes — pins published candidates and `program-lock` composition |
| SDD-030 | consumes — the contract surface for preflight and negotiated transitions |
| SDD-070 | consumes — versioning/compatibility rules for skills packs |
| SDD-080 | consumes — interface and compatibility contract for memory services |

## Input/output contract

- Inputs: charter (SDD-000), real repository states, conformance results,
  Gate 0 inventory.
- Outputs: `program-lock` per integrated checkpoint; signed ecosystem manifest;
  green conformance across producers and consumers.

## Threats

- Contract drift between repositories; a moving branch as a dependency.
- Silent conformance breakage tolerated by a consumer.
- Checksum/artifact mismatch between the manifest and what was tested.
- Repositories evolving in isolation without compatibility checks.

## Tests and metrics

- Conformance suite per producer and per consumer (contract tests).
- `program-lock` reproducibility: same composition reproduces the same SHAs,
  versions, and checksums.
- Multi-repo journey tests validate the composition before promotion.
- Rollback and recovery exercises per release-train policy.

## Rollback

- Promote the previous verified `program-lock` composition and revalidate
  conformance.
- Frozen contracts never change inside an ordinary implementation PR; rollback
  never rewrites historical receipts.

## Review limit

- Max 400 authored lines per review unit; larger changes via chained PRs.

## Evidence contract (governance amendment — W1 only)

Allocated to SDD-010 by the Dominion reconciliation (W1 only; not repeated in
any later work unit). This is a governance requirement allocation: it does not
claim the federated release train, conformance CI, or signed ecosystem manifests
exist today (R14/R17).

- **Evidence-source precedence (strongest first):** current repository contents
  and executable verification over the inspected revision; direct current
  GitHub metadata or release/PR records; persisted verification tied to an
  identifiable revision; apply-progress and archive records; roadmap, matrix,
  lock, and narrative documents. A higher source prevails only for the revision
  or observation it proves.
- **Freshness:** repository/executable evidence is `verified-current` only while
  the candidate tree equals the inspected tree; persisted reports are
  `verified-revision-bound`; GitHub metadata is observation-scoped; lock/matrix
  values are historical snapshots until corroborated by stronger evidence.
- **Reproducible cross-repo claims:** any promoted claim about another
  repository's contents, versions, or conformance MUST cite direct evidence for
  that repository or be recorded `unknown`/`unverified`. Public links are not
  repository visibility.

## Progress

> The checklist below tracks this SDD's content-contract phases; reconciliation
> marks none complete (documentary presence alone never completes a phase or
> gate — R4). Landed composition artifacts are exposed under the maturity axis
> above, not by promoting lifecycle.

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
