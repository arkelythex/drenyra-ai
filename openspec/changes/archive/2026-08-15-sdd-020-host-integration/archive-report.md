# Archive Report — sdd-020-host-integration (slice 2)

> Change: `sdd-020-host-integration` · Phase: archive · Store: openspec
> Archive status: **PASS** (slices 2A+2B archived; slice C documented)
> Archived to: `openspec/changes/archive/2026-08-15-sdd-020-host-integration/`

## What was delivered

SDD-020 slice 2 (host integration):

- **2A — per-host pinned runtime/model/tool:** `PinnedComposition` on the managed manifest, package-local `PINNED_AI_COMPOSITION` constants (exhaustive over `HostName`), install/sync pin rendering, doctor `pinned-ai-runtime` diagnostic (managed/foreign/drift/absent), pre-pin fail-closed compat, foreign-pin byte-for-byte preservation, capabilities wording fix.
- **2B — drenyra-pi host + four-host E2E:** `drenyra-pi` in the union/map/pins (canonical dir `~/.drenyra`); the four-host `install → doctor → sync → upgrade → rollback` E2E proven; no adapter edits needed.

## Delivery

- Chained PRs #46 (2A) → #47 (2B), both merged 2026-08-15. Bounded review N/A (RDD-off precedent).
- Suite 864/864 (859 baseline + 5 new), typecheck/build clean, protected paths zero delta.

## Follow-ups (documented, NOT part of this change)

1. **Slice C — program-lock-aware install** (every host consumes the promoted artifact, never a copy of main) — SDD-010 boundary.
2. **drenyra-pi host-serving integration** — owned by the pi session.

## Final verdict

**PASS** — slice 2 (A+B) complete and archived; 5/5 requirements, 16/16 scenarios; suite 864/864; no blockers.
