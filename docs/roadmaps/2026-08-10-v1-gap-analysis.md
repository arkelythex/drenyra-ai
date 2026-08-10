# Drenyra AI — v1.0 Gap Analysis

> [!IMPORTANT]
> **Status: live document.** This analysis separates what is already built (the contract-complete RDA core) from what remains to reach production-complete v1.0. It is tied to the inspected commit and the approved design series.

<!-- -->

> **Inspected commit:** `bfcc2e8` (2026-08-10) · **Design series:** [Design 01–05](../design/) · **Part of:** [Architecture](../architecture.md)

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Summary

> **Drenyra AI has a contract-complete, verifiable RDA core with a growing ecosystem surface.** As of 2026-08-10 the versioned-skill registry, Guardian Angel, fencing/outbox, prompt-injection defenses, MCP server, `capabilities`/`doctor`/`install`/`sync`, the formal SDK surface, the PostgreSQL adapter, external reconciliation, secret resolvers, the adversarial suite, and the monthly-close E2E are implemented and tested (601 tests). Still pending: KMS adapters for real vaults, ERP/SUNAT/bank connectors, pilots, and the license change.

| Layer | Status |
| --- | --- |
| Contracts, missions, candidates, gates, receipts, ledger, recovery, tenant scope | **Implemented** |
| Formal SDK (exports + MCP), versioned skills, Guardian Angel, defenses | **Implemented** |
| Real KMS adapters, ERP/SUNAT/bank connectors, pilots, productive operation | **Planned** |

## Gap matrix

Legend: ✅ implemented · ⚠️ partial · ❌ planned. Each row records exact repository evidence, the risk it mitigates, dependencies, a verifiable completion criterion, and the target release.

### 1. Contract-complete core — implemented

| Capability | Status | Evidence | Risk it resolves | Completion criterion |
| --- | --- | --- | --- | --- |
| Six frozen contracts (mission-protocol, candidate, receipt, gate, ledger, recovery) | ✅ | `contracts/` + conformance suites in `contracts/__tests__/` (CI, fail on drift) | Contract drift breaks consumers | Conformance suites green on every release |
| Mission protocol + `MissionRuntime` (15 states, transitions, events, versioning, idempotency) | ✅ | `missions/` (7 test files) | Nondeterministic lifecycle | `missions/__tests__/*` green |
| Candidate identity + materiality (R0–R3) | ✅ | `candidates/identity.ts`, `candidates/materiality.ts` | Unreviewed agent proposals | Candidate conformance green |
| Receipts (Ed25519, canonical vectors, offline verification) | ✅ | `receipts/` + frozen vectors in `contracts/receipt-schema/` | Untrusted execution claims | Receipt conformance + drift-guard green |
| Append-only ledger (hash chain, first-divergence validation) | ✅ | `ledger/` (29 conformance tests) | History tampering | Ledger conformance green |
| Gates (approval R2/R3, receipt, mission-state, fail-closed runner) | ✅ | `gates/approval.ts`, `gates/runner.ts` | Unauthorized transitions | Gate conformance green |
| Recovery (per-state policy, event-log replay, idempotent) | ✅ | `recovery/` (26 conformance tests) | Duplicated actions after crash | Recovery conformance green |
| Proportional review lenses (4R + judgment-day) | ✅ | `review/lenses.ts`, `review/workload.ts` | Review workload overload | Review tests green |
| Evidence authority (hash, tenant-bound registration, deep-freeze) | ✅ | `evidence/identity/`, `evidence/authority/` | Unverifiable evidence provenance | Evidence tests green |
| Tenant isolation (RUC/company/period scope) | ✅ | `tenant-core/`, `tenant-isolation/` | Cross-tenant leakage | Cross-tenant tests green |
| 5 intents (monthly-close, correction, reconciliation, invoice-review, compliance-check) | ✅ | `agents/handlers.ts`, `agents/plans.ts` | Generic agent chaos | Agent tests green |
| CLI core (receipt, ledger, mission, candidate, gate) | ✅ | `cmd/` (10 commands) | Headless core unreachable | CLI tests green |
| Fiscal discipline (BigInt cents, no floats) | ✅ | repository-wide convention | Monetary float corruption | Lint/convention enforced |

### 2. Partial layer

| Capability | Status | Evidence | Risk it resolves | Completion criterion |
| --- | --- | --- | --- | --- |
| SDK/API surface | ✅ | 14 subpath `exports` in `package.json` (incl. skills, security, guardian, mcp) + root `index.ts`; dist build smoke-tested | Consumers need a documented public API | Documented SDK guide + typed public surface + integration test |
| Specialized agent roles | ⚠️ | 5 intent handlers exist; the Design 03 roles (Close Coordinator, Evidence Agent, Invoice/SIRE Agent, Reconciliation Agent, Journal Candidate Agent, Compliance Agent, Guardian Angel) are not separate agents | Undefined agent boundaries | Roles exposed as bounded agents with schema-typed outputs |
| Evidence adapters | ⚠️ | Evidence authority exists; **no ERP/SUNAT/bank connectors** | External execution claims unverifiable | Adapter framework + at least one connector contract |

### 3. Planned layer (v1.0 gaps)

| Capability | Status | Risk it resolves | Dependencies | Completion criterion | Target release |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL production adapter | ✅ | `missions/store.postgres.ts` (Mission/Event/Idempotency/Fence/Outbox stores + DDL); unit tests green on a fake pool | JSON file store is dev-only | Real integration suite against a running PostgreSQL (`DATABASE_URL`) | v0.3 |
| MCP server | ✅ | `mcp/` — JSON-RPC 2.0 over stdio (`initialize`, `tools/list`, `tools/call`) with core tools; 6 tests | External hosts need a uniform protocol | Stdio binding wired to the CLI binary | v0.3 |
| `capabilities` command | ✅ | `drenyra-ai capabilities show` (6 contracts, PE jurisdiction, base skills); 2 tests | Consumers need declared contracts/skills/jurisdictions/adapters | Output tied to the live skills registry | v0.3 |
| `install` / `doctor` / `sync` | ✅ | `doctor` (read-only), `install` (detects codex/claude/opencode, writes managed markers, never installs a host), `sync` (preserves foreign-modified markers); 7 tests | Gentle-AI-equivalent configurator experience | Markers wired to real host skill/policy assets | v0.4 |
| Versioned skills (registry + Peru base) | ✅ | `skills/` — SkillRegistry (id/version/jurisdiction/validity/checksum, resolve-at-date, fail-closed); 9 tests; 3 PE base skills | Unversioned policy changes break reproducibility | Skills surfaced through `capabilities` and consumed by missions | v0.3 |
| Guardian Angel | ✅ | `guardian/` — read-only adversarial findings over frozen candidates (scope, R3 dual approval, never approves); 9 tests | Independent adversarial review | Wired into the close flow after candidate freeze | v0.4 |
| Fencing tokens + inbox/outbox | ✅ | `missions/fencing.ts` + `missions/outbox.ts`; fencing integrated into `MissionRuntime.apply` (stale tokens rejected); 10 tests | Parallel workers can double-confirm | PostgreSQL-backed stores + leader election | v0.3 |
| KMS/Key Vault integration | ⚠️ | `security/keys.ts` — SecretResolver contract + EnvResolver (dev) + FileResolver (test-only) + KMS_GUIDANCE; real vault adapter pending | Connector secrets and keys need managed storage | AWS/Azure/GCP KMS adapter implementing SecretResolver | v0.5 |
| External reconciliation (UNKNOWN states) | ✅ | `missions/reconciliation.ts` — `reconcileExternalCall`: executed requires verifiable evidence, not-executed → idempotent retry, indeterminate → human; fail-closed resolver; 8 tests | Blind retries duplicate postings | Wired into adapter calls (UNKNOWN mission state) | v0.5 |
| Adversarial test layer | ✅ | `security/__tests__/adversarial.test.ts` — prompt injection, receipt tampering, forged R3 approval, cross-tenant scope, expired skill, ledger reordering (6 scenarios) | Prompt injection, tampering, replay, forged approvals | Extended to live adapter/reconciliation flows | v0.4 |
| Prompt-injection defenses | ✅ | `security/` — `sanitizeDocumentText` (detect + neutralize + inert delimiters); 10 tests | Untrusted documents can instruct agents | Wired into evidence ingestion | v0.4 |
| Monthly-close E2E | ✅ | `missions/__tests__/e2e-monthly-close.test.ts` — synthetic PE company: mission → candidates → receipt → ledger, evidence-gated SUNAT claim, outbox dedup | Flagship flow unproven end-to-end | Extended with SIRE/conciliation agents | v0.5 |
| Drenyra consumes the published package | ❌ | Duplicate internal authority must be removed | Drenyra repo | Drenyra consumes released artifact; internal copy removed | v1.0 |
| Professional pilots | ❌ | Blocks and evidence requests must be understandable | Drenyra Command Center | 3 pilot firms confirm | v1.0 |
| Apache 2.0 license | ❌ | Open-core adoption; **requires separate explicit change + legal review** | Legal review | License PR merged | v1.0 |

## Approved design vs existing implementation

The design series is the **target specification**; it does not claim every capability exists. The core (Design 01–02 deterministic surface) is implemented. The ecosystem surface (Design 03–05: agents, skills, MCP, persistence, security, testing levels) is largely planned.

## Closing order (recommended)

1. Drenyra consumes the published package and removes the duplicate authority. *(external repo)*
2. Formal SDK for the Command Center.
3. PostgreSQL production adapter.
4. MCP and `capabilities`.
5. One complete monthly-close vertical with SIRE and evidence.
6. Versioned Peruvian skills.
7. `install`, `doctor`, and `sync`.
8. KMS, inbox/outbox, fencing, and external reconciliation.
9. Guardian Angel and adversarial tests.
10. Accounting-firm pilots. *(external)*
11. License change via independent PR and legal review. *(decision)*

## Related documents

- [Design 01 – Ecosystem Frontier and Authority](../design/design-01-ecosystem-frontier-and-authority.md)
- [Design 02 – Monthly Accounting and Tax Close](../design/design-02-monthly-close.md)
- [Design 03 – Agents, Skills, and Integrations](../design/design-03-agents-skills-integrations.md)
- [Design 04 – Persistence, Security, and Recovery](../design/design-04-persistence-security-recovery.md)
- [Design 05 – Testing, Releases, and the v1.0 Definition](../design/design-05-testing-releases-v1.md)
- [ROADMAP](../../ROADMAP.md)

---

**Read next:** [ROADMAP](../../ROADMAP.md) — the plan · [Architecture](../architecture.md) — back to the index
