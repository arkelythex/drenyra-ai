# Archive Report — mcp-bank-reconcile-tool

> Change: `mcp-bank-reconcile-tool` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-17-mcp-bank-reconcile-tool/`

## Structured status (consumed)

```yaml
schemaName: gentle-ai.sdd-status
changeName: mcp-bank-reconcile-tool
artifactStore: openspec
changeRoot: openspec/changes/mcp-bank-reconcile-tool (archived)
artifacts:
  proposal: done
  specs: done (spec.md — 9 requirements, 23 scenarios)
  design: done
  tasks: done (19/19 complete)
  applyProgress: done
  verifyReport: done (gentle-ai.verify-result/v1 envelope; verdict pass, 0 blockers)
nextRecommended: archive
```

## Final state facts (at close)

- **Merged**: MCP tool PR via #73 and tests PR via #74, landed on `main` through merge `5be3761`; verified state `main` at `e853342`.
- **Suite**: `bun run test` → **1471/1471 pass, exit 0** at close (MCP suite 30/30: 10 existing + 20 new).
- **Typecheck**: `bun run typecheck` → clean, exit 0.
- **CI**: green on `main` (typecheck / lint / test / package / brand-conformance / skills-conformance).
- **Frozen paths**: `mcp/server.ts`, `mcp/protocol.ts`, `mcp/stdio.ts`, `bank-reconciliation/**` byte-identical (diff empty).
- **Delivered**: `bank.reconcile` MCP tool on the drenyra-ai MCP server — thin read-only wrapper over the SDD-CON-001 engine (scope validation, fail-closed normalization, structured typed errors, BigInt→decimal-string serialization); registered in `createDrenyraMcpServer()` so `drenyra-ai mcp serve` exposes it; capability matrix `bank-reconciliation` row notes the MCP surface.
- **Review note**: RDD is off in this clone (`gentle-ai review mode status` → clone-local off); delivery proceeded under ordinary repository policy (CI gates), so no native review receipts were minted.

## Summary

The MCP server previously exposed only `capabilities` and `ledger.validate`. This change added `bank.reconcile`: a JSON Schema draft-07 contract (amounts as decimal strings only, RUC + YYYYMM scope), handler flow of shape validation → engine scope validation → normalization (any rejection blocks delegation, never reconciles the subset) → engine `reconcile` → JSON-safe serialization. Strict TDD applied (RED→GREEN, evidence in apply-progress); `mcp/__tests__/reconcile.test.ts` covers the happy path, all four difference classifications, every typed rejection, determinism, and the stdio round-trip.
