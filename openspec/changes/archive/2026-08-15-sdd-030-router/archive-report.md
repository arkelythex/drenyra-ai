# Archive Report — sdd-030-router (slice C)

> Change: `sdd-030-router` · Phase: archive · Store: openspec
> Archive status: **PASS**
> Archived to: `openspec/changes/archive/2026-08-15-sdd-030-router/`

## What was delivered

SDD-030 slice C — the deterministic preflight router: `routing/router.ts` with the closed `RouteRequest` (fiscal `WorkScope` + eight §5 axes), fail-closed `route(request) → ValidationResult<Route>` (typed `AMBIGUOUS_INPUT`, never a guessed route), escalation-only precedence (durable-mission → specialized-agent → direct-analysis), and the `Route` discriminant with inseparable literal authority ceilings (no-mutation / proposes-only / through-core). Propose-only: no execution/transition/materialization/persistence; deterministic/offline; no local transition table. `router.ts` in the boundary allowlist; root-barrel `ExternalEvidence` clash resolved.

## Delivery

- PR #49 (single PR per the forecast size-exception), merged 2026-08-15. Bounded review N/A (RDD-off precedent).
- Suite 915/915 (864 + 51), typecheck/build clean, protected paths zero delta.

## Follow-ups (documented, NOT part of this change)

1. **Authorized-adapter execution integration** — adapters consume the routed proposal; Core determines transitions (later work, not this SDD core).

## Final verdict

**PASS** — slice C complete and archived; 5/5 requirements, 13/13 scenarios; suite 915/915; no blockers. SDD-030 routing core is complete.
