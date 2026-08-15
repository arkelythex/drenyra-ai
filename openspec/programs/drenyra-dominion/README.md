# Drenyra Dominion Program

> **Program source of truth for the Drenyra ecosystem.** This directory is the
> federated program master that fixes vision, authority, contracts,
> dependencies, gates, and sequencing across every Drenyra repository. Each
> repository keeps its own implementation, versioning, and tests; this program
> defines how they compose into one reproducible ecosystem release.

## Program identity

| Field | Value |
| --- | --- |
| Program | `drenyra-dominion` |
| Master SDD | [SDD-000 — Drenyra Dominion Program](sdds/sdd-000-dominion/README.md) |
| Stage | Private (open-core transition registered as intention, not promise) |
| Language | English (project convention; user-facing product language is Spanish) |
| Home repository | `arkelythex/drenyra-ai` |

## The master + vertical SDDs model

A single master SDD fixes vision, authority, contracts, dependencies, gates,
and sequence. Below it, several implementable SDDs deliver complete
capabilities that may traverse the repositories they need — for example,
the monthly close SDD can modify `drenyra-ai`, `drenyra-skills`, `drenyra-pi`,
and Drenyra Command Center — while each repository preserves its ownership
and boundaries.

**Why this shape:**

- Produces end-to-end usable results, not isolated repo progress.
- Prevents each repository from evolving in isolation.
- Enables chained PRs, per-vertical rollback, and coordinated releases.
- Adapts the lessons of Gentle-AI v2.4.x without copying its architecture.
- Is the right structure to turn Drenyra into a dominant platform.

## Program documents

| Document | Purpose |
| --- | --- |
| [charter.md](charter.md) | North Star, frontiers, authority, taxonomy, and domain criteria |
| [authority-model.md](authority-model.md) | Multi-repo authority architecture, constitutional rules, verifiable invariants, organic work routing |
| [dependency-graph.md](dependency-graph.md) | SDD dependency graph, federated source of truth, program-lock contract |
| [capability-matrix.yaml](capability-matrix.yaml) | First capability matrix against the real state of each repository (Gate 0) |
| [release-train.md](release-train.md) | Federated release train, immutable candidates, gates, waves |
| [acceptance-matrix.md](acceptance-matrix.md) | Threat model, verification matrix, non-negotiable scenarios, v1 definition, commercial gate |
| [program-lock.json](program-lock.json) | Reproducible ecosystem composition: repos, SHAs, versions, contracts, checksums |
| [delivery-sequence.md](delivery-sequence.md) | Exact two-phase commit/PR sequence for federated checkpoints (solves the lock bootstrap problem) |
| [ecosystem-coherence.md](ecosystem-coherence.md) | Ecosystem coherence program-master record: audited inconsistencies, evidence, owners, blocked decisions, propagation/readback log |

## SDD catalog

Each SDD must deliver functional, verifiable software on its own, with
explicit dependencies, input/output contracts, non-goals, threats, tests,
metrics, rollback, and a review limit. See [charter.md](charter.md#6-sdd-contract)
for the per-SDD content contract.

| SDD | Purpose | Wave |
| --- | --- | --- |
| [SDD-000 — Drenyra Dominion Program](sdds/sdd-000-dominion/README.md) | North Star, frontiers, authority, taxonomy, domain criteria | 0 |
| [SDD-010 — Ecosystem Contracts and Release Train](sdds/sdd-010-contracts/README.md) | Multi-repo compatibility, capability manifests, versioning, coordinated releases | 0 |
| [SDD-020 — Universal Agent Configurator](sdds/sdd-020-configurator/README.md) | `install`, `doctor`, `sync`, `upgrade`, `rollback`, host integration | 1 |
| [SDD-030 — Organic Accounting Work Routing](sdds/sdd-030-routing/README.md) | Direct / delegated / durable-mission routing from evidence and risk | 1 |
| [SDD-040 — Receipt-Driven Accounting v2](sdds/sdd-040-rda-v2/README.md) | Frozen candidate, proportional review, bounded correction, reusable receipt | 1 |
| [SDD-050 — Peruvian Monthly Close](sdds/sdd-050-monthly-close/README.md) | First complete vertical: ERP/SIRE/banks → verifiable close | 3 |
| [SDD-060 — Multi-Operator Control Plane](sdds/sdd-060-multi-operator/README.md) | Accounting firm + internal team over RBAC/ABAC, tenant scope, segregation | 3 |
| [SDD-070 — Skills and Policy Supply Chain](sdds/sdd-070-skills/README.md) | Versioned fiscal skills, normative sources, vigencia, signature, rollback | 2 |
| [SDD-080 — Engram Institutional Memory](sdds/sdd-080-engram/README.md) | Useful, persistent memory that informs but never authorizes | 2 |
| [SDD-090 — Guardian Angel](sdds/sdd-090-guardian/README.md) | Independent, adversarial, strictly read-only verification | 2 |
| [SDD-100 — Professional Command Center](sdds/sdd-100-command-center/README.md) | Web UI for missions, evidence, exceptions, decisions, receipts | 3 |
| [SDD-110 — Production and Commercial Readiness](sdds/sdd-110-production/README.md) | Connectors, KMS, observability, pilots, security, open-core transition | 4 |

## Waves

| Wave | SDDs | Verifiable outcome |
| --- | --- | --- |
| 0 — Constitution | 000–010 | Authority, contracts, multi-repo compatibility |
| 1 — Universal runtime | 020–040 | Configured hosts, organic routes, transactional RDA |
| 2 — Fiscal intelligence | 070–090 | Verifiable skills, bounded memory, independent Guardian |
| 3 — Flagship product | 050–060–100 | Monthly close for firms and internal teams via Web UI |
| 4 — Production | 110 | Real connectors, KMS, observability, pilots, commercial operation |

Wave 3 depends on wave 2 capabilities, but its UX exploration may advance
earlier. Authoritative implementation may not.

## Repository ownership

| Repository | Role | SDDs it primarily serves |
| --- | --- | --- |
| `drenyra-ai` | Deterministic authority core (missions, candidates, materiality, policies, gates, approvals, recovery, audit ledger) | 000, 010, 030, 040, 090 |
| `drenyra-command-center` | Professional Web UI projection of the Core (requests, review, explanations, approvals, supervision) | 100, 060, 050 |
| `drenyra-pi` | Pi-native agent runtime with pinned versions | 020, 030, 040 |
| `drenyra-skills` | Versioned, verifiable accounting/fiscal knowledge | 070, 050 |
| `drenyra-engram` | Institutional memory, prior decisions, context | 080, 050 |
| `drenyra-guardian-angel` | Independent adversarial review over frozen candidates | 090, 040 |

Each participating repository holds only its local change plus a reference to
this master program. Full specs are never copied into participant repos — they
would diverge.

## Gate 0 (immediate, before SDD-020)

1. Inventory currently active OpenSpec changes, including `fiscal-authority-kernel`.
2. Resolve overlaps and dependencies between active changes.
3. Align README, license, visibility, and commercial messages with the private stage.
4. Provisionally freeze ICP, operators, and the first journey.
5. Register the future open-core transition as an intention, not a contractual promise.
6. Create the first `capability-matrix.yaml` against the real state of each repository.

See [charter.md](charter.md#7-gate-0) for detail and current status.
