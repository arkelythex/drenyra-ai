# Apply Progress — Cierre Contable Mensual Engine (SDD-CON-002, jurisdiction PE)

## Status

- **Status: success** — all five work units W1→W5 implemented; full regression green.
- Artifact store: openspec (`openspec/changes/cierre-mensual/`).
- Delivery: **single PR with recorded size exception** (user decision; `openspec/config.yaml`
  sets `review_budget_lines: 300`; the change exceeds the aggregate). No chained PRs.
  Work-unit commits W1→W5 within that one PR are parent-owned (see lifecycle gates).

## Start-state confirmation (W1)

- `close-calculations/` did not exist. ✅
- `skills/pe.ts` held **7** entries incl. `pe.conciliacion-bancaria` (sibling change merged in this
  workspace); no `pe.depreciacion-activo-fijo`, `pe.provision-cartera`, `pe.isr-mensual`, or
  `pe.cierre-resultados` entry. ✅
- `skills/__tests__/pe-skills.test.ts` asserted `length === 7` plus an exact id list. Updated to **11**. ✅
- Sibling `../drenyra-skills/skills/registry.json` held 7 entries; none of the four new ids. Now **11**. ✅

## Completed tasks (persisted checkbox updates in tasks.md)

All 42 implementation-owned rows across phases 1–9 are `- [x]`. The 3 parent-owned lifecycle-gate
rows remain `- [ ]` (deferred lifecycle actions).

### W1 — Types (`close-calculations/types.ts`)

- Canonical types + `CloseError` (6 codes: INVALID_SCOPE, NEGATIVE_AMOUNT, UNBALANCED_ENTRY,
  RATE_OUT_OF_BOUNDS, UNCLASSIFIABLE_INPUT, ACCOUNT_NOT_IN_CHART); `validateScope`,
  `assertChartAccount`, `assertRateInBounds`, `assertBalanced`; `MAX_RATE_BP = 10000`;
  `RETAINED_EARNINGS_ACCOUNT = "59"`.
- 14 tests: sealed constants, scope validation, chart validation, rate envelope, balanced invariant.

### W2 — Depreciation + Provisions

- `depreciation.ts`: monthly = `(costBasisCents * annualRateBp / 10000) / 12` BigInt floor;
  fail-closed NEGATIVE_AMOUNT / RATE_OUT_OF_BOUNDS / ACCOUNT_NOT_IN_CHART. 7 tests.
- `provisions.ts`: amount = `exposureCents * provisionRateBp / 10000`; UNCLASSIFIABLE_INPUT
  blocker; NEGATIVE_AMOUNT guards. 8 tests.

### W3 — Provisional ISR + Closing entries

- `isr.ts`: LIR Art. 85 coefficient vs statutory minimum (150 bp = 1.5%), greater-of, BigInt-exact
  cédula. 9 tests.
- `close-results.ts`: PCGE 12/13/14 → 59, one balanced entry per account, zero-balance skip. 6 tests.

### W4 — Report + barrel + wiring

- `report.ts`: trial-balance identity, cédula, before/after retained movement; UNBALANCED_ENTRY never
  emitted. 5 tests.
- Barrel `index.ts` (public surface only); boundary test (no agents/cmd/ledger/mcp/adapters/
  bank-reconciliation imports).
- Wiring: tsconfig.json + tsconfig.build.json include, package.json exports `./close-calculations`,
  root index.ts barrel. Build emits `dist/close-calculations/`.

### W5 — Skills + conformance

- `skills/pe.ts`: BASE_PE_SKILLS 7 → 11 (`pe.depreciacion-activo-fijo`, `pe.provision-cartera`,
  `pe.isr-mensual`, `pe.cierre-resultados`).
- Sibling manifest `../drenyra-skills/skills/registry.json`: identical 4 entries (11 total).
- `bun run skills:conformance` PASS (11 in sync).

## Deviations from design (documented)

1. `CloseScope` → `Scope` (root-barrel TS2308 clash with `flow/close.ts` `CloseScope`).
2. `IsoDate` module-private (root-barrel clash with `skills/types.ts` `IsoDate`).
3. ISR statutory minimum = **150 bp (1.5%)**, NOT 15 bp — LIR Art. 85 mandates 1.5%; implemented as
   `IsrPolicy.statutoryMinimumBp` policy input (150 in tests).
4. Added `ProvisionPolicy` + `IsrPolicy` types (design showed only `DepreciationPolicy`).
5. `computeProvisionalIsr` takes a single input → `{ entry, cedula }`.
6. `buildCloseReport(input: CloseReportInput)` — the design's `(scope, entries, chart)` cannot
   derive the cédula/opening balance.
7. Closing: one balanced entry per result account; `UNBALANCED_ENTRY` via shared `assertBalanced`.
8. Monthly depreciation rounding to zero → `NEGATIVE_AMOUNT` (fail-closed).
9. `monthlyNetIncomeCents` feeds the 1.5% path; `netIncomeCents` feeds the coefficient path.

## Final verification

- `bun run test` 97 files / 1344 tests passing; `bun run typecheck` clean; `bun run build` done;
  `bun run skills:conformance` PASS (11 in sync).
- Out-of-scope check: no `contracts/`, `flow/close.ts`, `ledger/`, `mcp/`, `cmd/`, missions, gates,
  receipts, evidence, or guardian changes; no CLI/MCP tools; no ledger writes.
- Spec R1–R8 mapping recorded in verify-report.md.
