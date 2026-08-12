# Gate 0 — Inventory and Alignment

> Status: IN PROGRESS · Last updated: 2026-08-11 · Owner: Drenyra Dominion Program
> Gate 0 must complete before SDD-020 (Universal Agent Configurator) starts.

## Checklist

| # | Action | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Inventory active OpenSpec changes, including `fiscal-authority-kernel` | **Done** | See §1 |
| 2 | Resolve overlaps and dependencies between active changes | **In progress** | See §2 |
| 3 | Align README, license, visibility, commercial messages with private stage | **In progress** | Repo READMEs reference this program; private-product notices already in place |
| 4 | Provisionally freeze ICP, operators, first journey | **Pending** | See §3 |
| 5 | Register open-core transition as intention, not contractual promise | **Done** | [charter.md §9](charter.md#9-open-core-transition); per-repo READMEs |
| 6 | Create first capability matrix against real repo state | **Done** | [capability-matrix.yaml](capability-matrix.yaml); [program-lock.json](program-lock.json) |

## 1. Active OpenSpec changes inventory

### `drenyra-ai`

| Change | Status | Scope |
| --- | --- | --- |
| `fiscal-authority-kernel` | In progress | Tenant scope core, evidence authority, journal lifecycle, candidate ordering, PE policy/CDR composition — the deterministic authority kernel required before later ingestion and SUNAT-facing programs |
| `bounded-agent-roles` | In progress | Agent role bounding (staging-only) |
| `drenyra-ecosystem-cleanup` | **Archived 2026-08-11** | Ecosystem ownership cleanup (skills ownership model, direction rules) |

### `drenyra-engram`

| Change | Status | Scope |
| --- | --- | --- |
| `audit-register-closure` | In progress | Audit register closure support |

### `drenyra-command-center`

No active OpenSpec changes; strategy docs exist under `openspec/` (strategy-2026-q3, strategy-drenyra-superiority-2026, master-index).

### `drenyra-pi` / `drenyra-skills` / `drenyra-guardian-angel`

No OpenSpec changes.

## 2. Overlaps and dependencies

| Overlap / dependency | Resolution |
| --- | --- |
| `fiscal-authority-kernel` overlaps with frozen contracts (candidate, receipt, gate, ledger, recovery) | Kernel composes frozen primitives at application layer; normative lifecycle semantics unchanged. Kernel is the implementation seed for SDD-040 (RDA v2) and SDD-050 (monthly close). |
| Skills ownership split: `drenyra-skills` registry (authoring) vs `drenyra-ai/skills` runtime copy (`BASE_PE_SKILLS`) | Kept as designed by `drenyra-ecosystem-cleanup`; `bun run skills:conformance` fails CI on drift. Feeds SDD-070. |
| Engram memory vs evidence | Engram non-authorization boundary enforced (`no authorize/approve/allow commands`). Feeds SDD-080. |
| Command Center consumes Core contracts vs reimplementing gates | Command Center is a projection; never reconstructs state machine. Feeds SDD-100. |
| Adapters (ERP/SUNAT/banks) | No adapter code in `drenyra-ai` today; SDD-110 defines them as restricted capabilities with capability manifests. |

## 3. Provisional freeze: ICP, operators, first journey

> **Status: pending** — proposed values below, to be confirmed by the product
> owner before SDD-020.

- **ICP (ideal customer profile):** Peruvian accounting firms (SME and
  mid-market) with monthly close obligations, plus internal finance teams of
  Peruvian companies.
- **Operators:** firm = partner, supervisor, accountant, assistant; internal
  team = controller, manager, accountant, treasury.
- **First journey:** Peruvian monthly close — import evidence (ERP · SIRE ·
  banks · documents) → preflight → normalize and reconcile → explained
  exceptions → accounting/fiscal candidates → Guardian + R0–R3 review →
  professional decision → authorized execution → verifiable Close Package.

## 4. Alignment notes

- All repositories already carry private-product notices (except
  `drenyra-engram`, which is the Apache-2.0 open component by design).
- Commercial messaging: flagship vertical = Peruvian monthly close; expansion
  order documented in [charter.md §2](charter.md)
  and the flagship design.
- Open-core: registered as intention in every README; no contractual promise
  of opening, no date.

## 5. Next actions

1. Confirm ICP / operators / first journey with the product owner (§3).
2. Close `fiscal-authority-kernel` and `bounded-agent-roles` per their own
   review workflows.
3. Land per-repo documentation updates referencing this program.
4. Recompute `capability-matrix.yaml` and `program-lock.json` at the next
   integrated checkpoint (after SDD-000/010 deliverables land).
