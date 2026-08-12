---

# SDD-010 — Ecosystem Contracts and Release Train

> Status: PLANNED · Wave: 0 · Depends on: SDD-000 · Feeds: SDD-020, SDD-030, SDD-070, SDD-080

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

## Progress

- [ ] Exploration
- [ ] Proposal
- [ ] Specification (RFC 2119 + Given/When/Then)
- [ ] Design
- [ ] Tasks (vertical TDD units)
- [ ] Apply (strict TDD)
- [ ] Verification report
- [ ] Archive report
