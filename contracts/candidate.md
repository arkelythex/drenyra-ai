# Contract: candidate

> Version: 0.1-draft · Status: draft · Transport-agnostic.

A **candidate** is an agent's proposal for a material accounting action, made first-class and reviewable. Candidates are the unit of **human-supervised AI execution**: the agent proposes, the candidate carries identity and materiality, and risk-proportional review decides.

## Purpose

- Give AI proposals a durable identity that can be inspected, reviewed, corrected, and receipted.
- Make materiality explicit so review depth is derived, not chosen.
- Keep a bounded correction budget — one immutable candidate permits at most one scoped correction.

## Candidate

| Field          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `id`           | Canonical candidate identifier                                 |
| `mission_id`   | Owning mission (if any)                                        |
| `scope`        | RUC/company/period — mandatory                                 |
| `materiality`  | Risk tier R0–R3 derived from value, reversibility, jurisdiction |
| `status`       | `proposed → inspected → reviewing → accepted | corrected | rejected` |
| `subject_hash` | Hash of the exact reviewed subject (bytes are the source of truth) |
| `lineage`      | Chain to the parent candidate/mission                          |

## Monetary values

Monetary values in candidates are **whole-number cents as BigInt** (`amount: 1500n` for S/15.00). Floats and raw numbers are blocked for money, per the Drenyra fiscal rules. Materiality tiers derive from these BigInt values plus reversibility and jurisdiction — never from agent claims.

## Identity

Candidate identity is derived from content (`subject_hash` over the exact reviewed bytes), never from agent intent or transcript. Two candidates with the same subject and scope collide; differing bytes are different candidates.

## Materiality

Materiality is computed from **value (BigInt cents), reversibility, and jurisdiction rules**:

| Tier | Example                                                      | Review                    |
| ---- | ------------------------------------------------------------ | ------------------------- |
| R0   | Read-only queries, non-material drafts                       | High autonomy             |
| R1   | Standard journal entries, within limits                      | Focused review            |
| R2   | Monthly close, batch mutations                               | Explicit review + approval |
| R3   | Irreversible operations (declarations, payments, deletion)   | Explicit dual approval    |

## Review

- Review depth follows materiality; reviewers never skip tiers.
- Deterministic blockers need no refuter; inferential blockers share one read-only refuter batch.
- Only candidate-caused severe findings block; pre-existing/base-only findings become follow-ups.
- One candidate permits **at most one scoped correction**. Later observations are follow-ups, not a second correction.

## Correction

A correction must be:

1. Forecast before editing (positive cost estimate).
2. Bounded to the candidate's frozen scope.
3. Re-validated against the same subject lineage.
4. Receipted as a distinct event.

## Conformance

Vectors cover: identity derivation (same bytes → same id), materiality derivation per jurisdiction, review-tier escalation, correction budget enforcement, and rejection of mutated subjects.
