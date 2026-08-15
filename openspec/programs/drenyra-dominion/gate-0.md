# Gate 0 — Inventory and Alignment

> Status: gate: pending — SDD-020 blocked · Last updated: 2026-08-14 · Owner: Drenyra Dominion Program
> Reconciled 2026-08-14 against repository evidence at inspected revision `4975f4f`
> (evidence register: [status-and-evidence.md](status-and-evidence.md) §3).
> Gate 0 must complete before SDD-020 (Universal Agent Configurator) starts; see §4 for the SDD-020 decision.

## Checklist

| # | Action | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Inventory active OpenSpec changes, including `fiscal-authority-kernel` | **satisfied** | See §1 (refreshed 2026-08-14, E-001/E-008) |
| 2 | Resolve overlaps and dependencies between active changes | **satisfied** | See §2 (resolution table; this change is docs-only, no new overlap) |
| 3 | Align README, license, visibility, commercial messages with private stage | **pending** | Program notices in place; cross-repo alignment unverified; visibility fact recorded (E-005) |
| 4 | Provisionally freeze ICP, operators, first journey | **approved-pending-evidence** | See §3 (decision approved; durable capture pending, E-009) |
| 5 | Register open-core transition as intention, not contractual promise | **satisfied** | [charter.md §9](charter.md#9-open-core-transition); program README; sibling READMEs unverified from this clone |
| 6 | Create first capability matrix against real repo state | **satisfied** | [capability-matrix.yaml](capability-matrix.yaml) exists at `4975f4f`; W2 evidence/freshness refresh scheduled |

## 1. Active OpenSpec changes inventory

### `drenyra-ai`

| Change | Status (2026-08-14, drenyra-ai at `4975f4f`) | Scope |
| --- | --- | --- |
| `fiscal-authority-kernel` | Verification complete (774/774 at `4975f4f`, E-004); archive pending | Tenant scope core, evidence authority, journal lifecycle, candidate ordering, PE policy/CDR composition — the deterministic authority kernel required before later ingestion and SUNAT-facing programs |
| `bounded-agent-roles` | unverified from this clone (not under `openspec/changes/` at `4975f4f`; may live in another repository) | Agent role bounding (staging-only) |
| `drenyra-ecosystem-cleanup` | **Archived 2026-08-11** | Ecosystem ownership cleanup (skills ownership model, direction rules) |
| `dominion-program-status-reconciliation` | Active (this change) | Docs-only reconciliation of program status, evidence, and governance ownership (W1–W3) |
| `ecosystem-coherence` | Active | EC inconsistency inventory, decision register, propagation/readback — see its change record |
| `ecosystem-script-resilience` | Active | Script resilience / conformance guardrails — see its change record |
| `gentle-ai-quality-parity` | Active | Declared-surface integrity — see its change record |
| `release-integrity-evidence` | Active | Release integrity evidence (SBOM/checksums) — see its change record |
| `reproducible-lint-gate` | Active | Reproducible lint gate — see its change record |

### `drenyra-engram`

| Change | Status | Scope |
| --- | --- | --- |
| `audit-register-closure` | In progress | Audit register closure support |

### `drenyra-command-center`

No active OpenSpec changes; strategy docs exist under `openspec/` (strategy-2026-q3, strategy-drenyra-superiority-2026, master-index).

### `drenyra-pi` / `drenyra-skills` / `drenyra-guardian-angel`

No OpenSpec changes.

> Sibling-repository change states above are as last recorded 2026-08-11 and are
> unverified from this clone; refresh at the next integrated checkpoint.

## 2. Overlaps and dependencies

| Overlap / dependency | Resolution |
| --- | --- |
| `fiscal-authority-kernel` overlaps with frozen contracts (candidate, receipt, gate, ledger, recovery) | Kernel composes frozen primitives at application layer; normative lifecycle semantics unchanged. Kernel is the implementation seed for SDD-040 (RDA v2) and SDD-050 (monthly close). |
| Skills ownership split: `drenyra-skills` registry (authoring) vs `drenyra-ai/skills` runtime copy (`BASE_PE_SKILLS`) | Kept as designed by `drenyra-ecosystem-cleanup`; `bun run skills:conformance` fails CI on drift. Feeds SDD-070. |
| Engram memory vs evidence | Engram non-authorization boundary enforced (`no authorize/approve/allow commands`). Feeds SDD-080. |
| Command Center consumes Core contracts vs reimplementing gates | Command Center is a projection; never reconstructs state machine. Feeds SDD-100. |
| Adapters (ERP/SUNAT/banks) | No adapter code in `drenyra-ai` today; SDD-110 defines them as restricted capabilities with capability manifests. |

> Reconciled 2026-08-14: no new overlap introduced by
> `dominion-program-status-reconciliation` (docs-only; internal unit order
> W1→W2→W3 per tasks.md).

## 3. Provisional freeze: ICP, operators, first journey

> **Status: approved-pending-evidence** — the three business inputs below were
> provided and approved by the product owner; durable attributable approval
> capture is pending (E-009). The decision is not reopened.

- **ICP (ideal customer profile):** Peruvian accounting firms (SME and
  mid-market) with monthly close obligations, plus internal finance teams of
  Peruvian companies.
- **Operators:** firm = partner, supervisor, accountant, assistant; internal
  team = controller, manager, accountant, treasury.
- **First journey:** Peruvian monthly close — import evidence (ERP · SIRE ·
  banks · documents) → preflight → normalize and reconcile → explained
  exceptions → accounting/fiscal candidates → Guardian + R0–R3 review →
  professional decision → authorized execution → verifiable Close Package.

## 4. SDD-020 decision

**SDD-020 is BLOCKED.**

Rows 3 (`pending`) and 4 (`approved-pending-evidence`) are not `satisfied`. Per
the reconciliation contract, any incomplete required row blocks SDD-020 unless
a durable waiver names owner, rationale, scope, and approval reference; no
waiver is recorded, so there is no implicit waiver. SDD-020 remains
`lifecycle:planned` in its own record and MUST NOT be started (R10).

Required for unblock — evidence capture only, no new product-decision gate:

- Row 3 → `satisfied` when cross-repo README/license/visibility alignment is
  directly verified (drenyra-ai verified at `4975f4f`; siblings not).
- Row 4 → `satisfied` when the three business inputs carry a durable,
  attributable approval reference (E-009), without reopening the decision.

Boundary pointer: this record relates to — but does not duplicate —
`ecosystem-coherence` (program record
`openspec/programs/drenyra-dominion/ecosystem-coherence.md`; change
`openspec/changes/ecosystem-coherence/`). Its EC inventory, decision register,
propagation units, and readback log are exclusively owned there and are not
copied, modified, superseded, or marked complete here (R16).

## 5. Alignment notes

> Sibling-repository alignment claims below are as recorded 2026-08-11 and are
> unverified from this clone; refresh at the next integrated checkpoint.

- All repositories already carry private-product notices (except
  `drenyra-engram`, which is the Apache-2.0 open component by design).
- Commercial messaging: flagship vertical = Peruvian monthly close; expansion
  order documented in [charter.md §2](charter.md)
  and the flagship design.
- Open-core: registered as intention in every README; no contractual promise
  of opening, no date.

## 6. Next actions

1. Capture durable attributable approval evidence for the §3 business inputs
   (E-009); the decision is not reopened.
2. Archive `fiscal-authority-kernel` (verification complete, E-004); refresh
   `bounded-agent-roles` state from its owning repository (unverified here).
3. Refresh sibling-repository README/license/visibility alignment and change
   inventory at the next integrated checkpoint (row 3).
4. Reconcile `capability-matrix.yaml` and `program-lock.json` evidence/freshness
   (W2 of this change; the 640-test snapshot stays historical, E-006).
