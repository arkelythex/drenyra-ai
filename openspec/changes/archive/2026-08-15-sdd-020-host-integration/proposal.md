# SDD-020 Slice 2 — Host Integration Proposal

> Change: `sdd-020-host-integration`  
> Program: Drenyra Dominion, SDD-020 Universal Agent Configurator  
> Status: proposed  
> Predecessor: `sdd-020-configurator` slice 1, delivered in PRs #34 and #35

## Intent

Complete the first host-facing portion of SDD-020 by making host configuration explicitly pinned and by recognizing Drenyra Pi as the fourth supported host. This proposal groups slices A and B as one product unit while keeping them as bounded, sequential review units.

Slice 1 already delivered the package-level managed-configuration library, composition snapshots, install/sync delegation, upgrade/rollback transitions, and doctor diagnostics. Slice 2 is permitted by the SDD-020 deferred-slice list and extends that foundation without changing Drenyra AI's deterministic-advisory boundary.

## Roadmap and architecture alignment

This change advances the Drenyra Dominion Peru v1 roadmap through SDD-020 and feeds SDD-100 by producing reproducible host configuration for agents that run Command Center missions. It remains on the AI advisory side of the approved architecture: Drenyra AI configures runtime hosts but does not make fiscal decisions, authorize operations, write accounting journals, or reinterpret evidence or memory.

The implementation must preserve the existing layer direction:

`contracts -> library modules -> agents -> cmd`

Host composition and pin rules belong below `cmd/`, with command handlers remaining thin adapters. No reverse import from the configurator library into `cmd/` or `agents/` is permitted.

## Current-state gap

The delivered configurator does not yet satisfy the host-integration portion of SDD-020:

- Only `codex`, `claude-code`, and `opencode` are recognized; Drenyra Pi is absent from the host union, directory map, detection, marker rendering, and tests.
- There is no per-host runtime/model/tool pin. The existing `package-pin` diagnostic checks only the package-level Drenyra AI composition version.
- There is no four-host install-to-rollback end-to-end path.
- `program-lock` is not read by any runtime command.
- `capabilities.ts` still describes configured host integrations as `"(planned)"`, which is stale.

The resulting user and operational gap is that a managed installation can report package consistency without proving which AI runtime, model, and tool composition each host is expected to use. Pi also cannot participate as a detected/configured host, and the complete four-host lifecycle is not covered by one acceptance flow.

## Proposed first product slice

### Slice A — Per-host pinned AI runtime

Introduce a deterministic `pinned-ai-runtime` record for each recognized host containing its runtime, model, and tool pins.

The record will:

- be rendered as a Drenyra-managed host asset during install and sync;
- be represented in the managed composition snapshot so upgrade and rollback remain reproducible;
- be validated and surfaced by doctor as a distinct `pinned-ai-runtime` diagnostic;
- use the same exact-byte ownership and preservation rules as existing managed assets; and
- remain consumable by Drenyra Pi without introducing a dependency on the `drenyra-pi` repository.

Estimated change: **150–250 authored lines including focused tests**.

### Slice B — Drenyra Pi host and four-host lifecycle

Add `drenyra-pi` to the fixed host-name union and host-directory map, then include it in detection, managed marker/pin handling, manifest validation, diagnostics, and lifecycle tests.

Add a four-host acceptance flow covering:

`install -> doctor -> sync -> upgrade -> rollback`

The flow must include Codex, Claude Code, OpenCode, and Drenyra Pi and prove deterministic pin rendering and preservation behavior. Host capability wording should be reconciled so already-configured integrations are no longer described as merely planned.

Estimated change: **120–200 authored lines including focused tests**.

### Delivery boundary

Slices A and B together are estimated at **270–450 authored lines**. Because the upper bound exceeds the SDD-020 400-line review limit and the repository proposal budget is 300 lines, the recommended delivery is a chain of two review units:

1. **A — pinned runtime/model/tool record and doctor surfacing**
2. **B — Drenyra Pi host, capability wording, and four-host lifecycle coverage**

A+B may be delivered as one review unit only if the completed task forecast demonstrates that the total authored change remains within the applicable review budget. Scope must not be reduced merely to fit that budget.

## Ownership boundary

`drenyra-ai` owns the deterministic host-integration commands and records:

- fixed host detection and managed paths;
- managed markers and pin records;
- install/sync rendering;
- doctor surfacing;
- composition transitions and four-host lifecycle evidence.

`drenyra-pi` owns the host-serving side:

- consuming a released, versioned Drenyra AI artifact; and
- serving the configurator capability to Pi users.

This slice configures Drenyra Pi as a recognized host but **does not implement Pi's host-serving behavior**. Drenyra AI must not import, invoke, install, upgrade, remove, or replace Drenyra Pi or any other host binary.

## Design principles and invariants

1. **Never install a host.** Detection and configuration apply only to host directories that already exist. No host executable or package manager is invoked.
2. **Preserve foreign bytes exactly.** A missing managed pin asset may be created. An asset that differs from Drenyra's recorded expected bytes must be preserved byte-for-byte, including unreadable or partially migrated states; commands report the condition instead of overwriting it.
3. **Keep layer direction.** Deterministic host and pin composition belongs in the library layer. `cmd/` remains an adapter, and no reverse imports are introduced.
4. **Use fixed, re-derived managed paths.** Recorded host paths are never trusted as write authority. Every write target is re-derived from the injected home directory and the fixed host map; redirected paths fail closed.
5. **Keep transitions reproducible.** Pin bytes and their hashes participate in current/previous composition state so sync, upgrade, and rollback can reason about exact expected bytes.
6. **Respect program-lock bootstrap.** A program lock must never self-reference the commit carrying it. Program-lock-aware installation belongs to later slice C and must eventually consume a genuinely promoted artifact rather than `main` or a copied repository document.

## Scope

In scope:

- a per-host runtime/model/tool pin record identified as `pinned-ai-runtime`;
- deterministic rendering through install and sync;
- composition snapshot and transition support for the managed pin asset;
- doctor reporting for pin presence, exact-byte drift, and pin mismatch;
- Drenyra Pi in the host union, fixed map, detection, validation, and managed assets;
- four-host lifecycle coverage;
- correction of stale host-integration capability wording;
- compatibility behavior for manifests created before the pin asset exists, defined fail-closed where safe derivation is impossible.

## Non-goals

- Program-lock-aware installation or promoted-lock acquisition/verification (slice C).
- Drenyra Pi host-serving implementation.
- Installing, upgrading, removing, or replacing any host binary.
- RBAC, authorization, fiscal decisions, or accounting behavior.
- New normative contracts or changes to frozen contracts/program roots.
- Packaging vertical capabilities.
- Broad host-vendor adapters beyond the deterministic managed marker/pin surface.

## Affected areas

Expected implementation impact is limited to:

- `configurator/managed-config.ts` for host types/maps, pin rendering, manifest/composition validation, transition behavior, and diagnostics;
- thin install/sync/doctor command adapters where needed to expose library results;
- host integration and configurator transition tests, including a four-host lifecycle flow; and
- `capabilities.ts` wording for integration status accuracy.

No implementation file is modified by this proposal phase.

## Product tradeoffs

- **Determinism over convenience:** foreign or unverifiable pin files are preserved and reported, even when automatic replacement would be easier.
- **Released artifacts over repository state:** this unit uses package-local deterministic pin inputs; promoted `program-lock` resolution is deferred rather than approximated from `main`.
- **Bounded delivery over one large review:** A and B form one product outcome but should be reviewed sequentially when the combined change cannot remain inside the budget.
- **Explicit Pi boundary over hidden coupling:** Drenyra AI recognizes/configures the Pi host, while Pi serving remains in its owning repository.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A new pin asset overwrites user- or host-owned configuration | Apply exact-byte managed ownership; create only when absent and preserve any non-matching bytes. |
| Legacy manifests cannot prove prior pin bytes | Define additive compatibility and fail closed for transitions that require unavailable prior bytes; never invent rollback state. |
| Pin data drifts from the composition snapshot | Hash exact rendered bytes, validate them with the manifest, and report mismatch through doctor. |
| Adding Pi creates repository coupling | Add only deterministic host metadata and assets; do not import or invoke Pi code. |
| A recorded path redirects writes outside the managed host directory | Re-derive every path from home plus the fixed map and reject mismatches. |
| Combined A+B work exceeds review capacity | Deliver A then B as chained review units unless the final forecast is demonstrably under budget. |
| Deferring program-lock creates a misleading claim of full SDD-020 completion | Keep SDD-020 lifecycle in progress and state explicitly that promoted-lock installation remains slice C. |

## Rollback

Runtime rollback continues to use the existing previous-composition mechanism. When pin assets are Drenyra-managed and match the recorded current bytes, rollback restores the previous recorded pin bytes together with the existing managed assets. Foreign-modified bytes remain untouched and are reported as preserved.

Delivery rollback is performed per review unit: B can be reverted without removing A's pin capability, and A can be reverted to the slice-1 package-level composition behavior. A rollback must not delete or overwrite foreign host files, install/uninstall hosts, or claim program-lock verification.

## Success criteria

The proposal is successful when implementation and verification demonstrate that:

1. All four hosts are detected from fixed, re-derived config directories without installing host software.
2. Install and sync deterministically render a per-host runtime/model/tool pin record for every present recognized host.
3. Doctor surfaces `pinned-ai-runtime` status and reports missing, mismatched, foreign-modified, or unverifiable state without mutating it.
4. Foreign host and pin content is preserved byte-for-byte across install, sync, upgrade, and rollback.
5. A four-host test covers install, doctor, sync, upgrade, and rollback, including managed pin behavior.
6. Existing package-level composition, path-safety, idempotency, and fail-closed behavior remain intact.
7. Host integration capability wording reflects delivered configuration support without claiming that Pi host-serving or program-lock-aware install is complete.
8. The full test suite, typecheck, and build are green under the repository's configured commands.

## Proposal question round

This proposal proceeds with the following assumptions, which should be reviewed before specification:

1. The canonical Drenyra Pi config directory will be selected as a fixed home-relative path during specification/design and then enforced by re-derivation; no user-supplied redirect will be supported.
2. Until slice C exists, per-host runtime/model/tool pin values come from deterministic package-owned inputs, not from `program-lock`, network discovery, host introspection, or `main`.
3. A foreign pre-existing pin file is preserved and surfaced as unhealthy/unverifiable by doctor rather than adopted automatically.
4. A and B are one product scope but default to sequential review units because their combined upper estimate exceeds the review limit.

Questions for product review:

- What canonical home-relative config directory does the Drenyra Pi host own?
- Which package-owned source defines each host's runtime, model, and tool pin before promoted program-lock resolution is available?
- Should doctor classify a preserved foreign pin as a pin mismatch or as a distinct unmanaged/unverifiable state?
- Is correcting `capabilities.ts` wording part of B's acceptance boundary, or should it remain a separate documentation-only cleanup?

These questions refine host policy and user-visible diagnostics; they do not expand this proposal into slice C or Pi host-serving.
