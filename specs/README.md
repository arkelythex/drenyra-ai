# Drenyra AI — Requirements of record

← [Back to README](../README.md)

A behavior change needs an explicit rule and a verifiable scenario, not a remembered
conversation. Find the relevant capability here before writing code; use the
current [ODD workflow](../CONTRIBUTING.md) to track the implementation.

Requirements of record for Drenyra AI, one directory per capability.

These specs moved verbatim from the active changes under the retired `openspec/changes/` when the repository adopted ODD ([`odd/tasks/sdd-to-odd-migration.md`](../odd/tasks/sdd-to-odd-migration.md)). Paths inside them that point into `openspec/` are historical provenance and resolve in git history.

| Spec | Origin change |
| --- | --- |
| [`declared-surface`](declared-surface/spec.md) | `gentle-ai-quality-parity` |
| [`drenyra-ecosystem-cleanup`](drenyra-ecosystem-cleanup/spec.md) | `drenyra-ecosystem-cleanup` |
| [`ecosystem-coherence`](ecosystem-coherence/spec.md) | `ecosystem-coherence` (open work: [`odd/tasks/ecosystem-coherence.md`](../odd/tasks/ecosystem-coherence.md)) |
| [`ecosystem-conformance`](ecosystem-conformance/spec.md) | `ecosystem-script-resilience` |
| [`lint-gate`](lint-gate/spec.md) | `reproducible-lint-gate` |
| [`release-integrity`](release-integrity/spec.md) | `release-integrity-evidence` |

Program-level requirements (the 16 program SDDs, the charter, and gate 0) live in [`program/drenyra-dominion/`](../program/drenyra-dominion/README.md).

## Use a requirement in a change

1. Read the capability's purpose, requirements, scenarios, and non-goals.
2. Identify the exact rule your change affects and preserve compatibility with
   the [public contracts](../contracts/README.md).
3. Follow [deterministic testing](../docs/testing-deterministic.md): observe the
   expected failure, implement the rule, and verify existing behavior.
4. Record the implementation and evidence in the relevant ODD feature document
   when the [tracking criteria](../AGENTS.md#delivery-workflow--odd) apply.

A specification is a requirement of record, not a release certificate. Its
presence alone does not establish that every scenario is implemented today.

## Read next

- [Codebase guide](../docs/CODEBASE-GUIDE.md) — find the owning implementation.
- [Program master](../program/drenyra-dominion/README.md) — coordinate cross-repository decisions.
