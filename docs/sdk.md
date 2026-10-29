# Drenyra AI — SDK

← [Back to README](../README.md)

Integrators need the same validation and proof regardless of their interface.
The SDK exposes the headless core as ESM subpaths so applications can use it
without embedding CLI processes or treating agent output as authority.

> [!IMPORTANT]
> **The SDK is the public library surface of the headless core.** Drenyra Console, Drenyra Shell, ERPs, and third-party SaaS consume the same released contracts through these subpaths. Integrate via released, versioned artifacts — never a checkout.

<!-- -->

> **Part of:** [Architecture](architecture.md) · **Last updated:** 2026-08-10

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Install

```bash
npm install drenyra-ai
```

The package ships a prebuilt ESM artifact (`dist/`, Node >= 22) and a `drenyra-ai` binary. Verification uses `node:crypto`; the CLI uses `ajv` for schema validation. Infrastructure adapters such as PostgreSQL persistence have their own dependencies.

## Package subpaths

| Subpath | Surface |
| --- | --- |
| `drenyra-ai` (root) | All modules re-exported |
| `drenyra-ai/receipts` | Receipt signing, hashing, verification (Ed25519, canonical vectors) |
| `drenyra-ai/ledger` | Append-only ledger validation (`validateLedger`) |
| `drenyra-ai/missions` | Mission protocol, `MissionRuntime`, fencing, outbox, reconciliation |
| `drenyra-ai/candidates` | Candidate identity, materiality (R0–R3), lifecycle |
| `drenyra-ai/evidence` | Evidence authority (hash, tenant-bound, deep-freeze) |
| `drenyra-ai/review` | Proportional review lenses and workload forecast |
| `drenyra-ai/gates` | Approval (R2/R3), receipt, mission-state gates |
| `drenyra-ai/recovery` | Per-state recovery policy and event replay |
| `drenyra-ai/tenant` | RUC/company/period scope primitives |
| `drenyra-ai/skills` | Versioned skill registry + base Peruvian skills |
| `drenyra-ai/security` | Prompt-injection sanitization, secret resolvers |
| `drenyra-ai/guardian` | Adversarial read-only review of frozen candidates |
| `drenyra-ai/mcp` | JSON-RPC 2.0 server + stdio binding |
| `drenyra-ai/adapters` | Evidence adapter framework |
| `drenyra-ai/flow` | Deterministic monthly-close vertical |

## Quick path

Import a subsystem directly, keep money as BigInt cents, and bind every candidate
to the exact subject bytes and fiscal scope. The first example below is runnable
without any external adapter. It stages a candidate; it does not approve or post.

## Quick examples

```ts
// Candidate with BigInt-cents materiality (no floats for money)
import { CandidateLifecycle } from "drenyra-ai/candidates";
const lifecycle = new CandidateLifecycle();
const candidate = lifecycle.propose({
  subject: "reclassify supplier prepayment",
  scope: { ruc: "20123456789", period: "202607" },
  materialityInput: { value: 120_000n, reversibility: "reversible", jurisdiction: "PE" },
});

// Guardian audit over the frozen candidate (findings only, never approval)
import { runGuardianReview } from "drenyra-ai/guardian";
const report = runGuardianReview(candidate);

// Versioned skill resolution (a normative update never retroactively changes a mission)
import { SkillRegistry, BASE_PE_SKILLS } from "drenyra-ai/skills";
const skills = new SkillRegistry();
BASE_PE_SKILLS.forEach((skill) => skills.register(skill));
const igv = skills.resolveAt("pe.igv-validate", "2026-07-15");

// Revalidate against the same bytes before requesting review.
const inspected = lifecycle.inspect(candidate, "reclassify supplier prepayment");
console.log(inspected.status); // inspected
```

For adapter-backed compositions, use `MissionRuntime` from `drenyra-ai/missions`
and `runMonthlyClose` from `drenyra-ai/flow`. These need explicit stores, scope,
evidence, and integration dependencies: see the [monthly-close design](design/design-02-monthly-close.md)
and [`flow/close.ts`](../flow/close.ts) rather than passing a placeholder object.
Guardian findings above are diagnostic, not approval; a synthetic RUC may fail
its checksum check even when its shape passes candidate construction.

## Integration rules

1. **Consume released, versioned artifacts** — never a source checkout.
2. **Scope is part of every call**: RUC, company, and fiscal period are mandatory; post-read filtering is not tenant isolation.
3. **Money is BigInt cents** — no float is ever used for money.
4. **Agents propose; the Core decides** — the SDK exposes staging, validation, and verification, never self-authorization.
5. **Verification is offline and from canonical vectors** — never from ambient state.

## Verification

These commands run in this repository checkout, not in an application that only
installed the package. Consumer applications run their own typecheck and tests.

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run (conformance + unit + adversarial + E2E)
npm run verify:package  # build + tests + packed-artifact verification
```

## Related

- [Intended Usage](intended-usage.md) — the frontier
- [Contracts](../contracts/README.md) — the frozen public surface
- [Design 03 — Agents, Skills, Integrations](design/design-03-agents-skills-integrations.md)
- [Design 04 — Persistence, Security, Recovery](design/design-04-persistence-security-recovery.md)

---

**Read next:** [Architecture](architecture.md) — back to the index · [Runbooks](runbooks/README.md) — operations
