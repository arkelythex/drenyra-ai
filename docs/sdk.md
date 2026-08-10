# Drenyra AI — SDK

> [!IMPORTANT]
> **The SDK is the public library surface of the headless core.** Drenyra Command Center, Drenyra Pi, ERPs, and third-party SaaS consume the same released contracts through these subpaths. Integrate via released, versioned artifacts — never a checkout.

<!-- -->

> **Part of:** [Architecture](architecture.md) · **Last updated:** 2026-08-10

<!-- -->

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Install

```bash
npm install drenyra-ai
```

The package ships a prebuilt ESM artifact (`dist/`, Node >= 22) and a `drenyra-ai` binary. Library modules use `node:crypto` only; the CLI adds `ajv` for schema validation.

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

## Quick examples

```ts
// Ledger validation (offline, from the frozen contract)
import { validateLedger, GENESIS_EMPTY_HASH } from "drenyra-ai/ledger";

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

// Mission runtime with fencing and reconciliation
import { MissionRuntime, acquireFence, reconcileExternalCall } from "drenyra-ai/missions";

// The deterministic monthly-close vertical
import { runMonthlyClose } from "drenyra-ai/flow";
const close = await runMonthlyClose({ /* scope, adapters, keyPair, ledger */ });
```

## Integration rules

1. **Consume released, versioned artifacts** — never a source checkout.
2. **Scope is part of every call**: RUC, company, and fiscal period are mandatory; post-read filtering is not tenant isolation.
3. **Money is BigInt cents** — no float is ever used for money.
4. **Agents propose; the Core decides** — the SDK exposes staging, validation, and verification, never self-authorization.
5. **Verification is offline and from canonical vectors** — never from ambient state.

## Verification

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
