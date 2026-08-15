# Status and Evidence — Drenyra Dominion Program

> Canonical five-axis status vocabulary and evidence register for the Dominion
> program record. **W1-owned:** this file and its index are not modified by later
> work units; W2-promoted current claims are recorded inside their own W2
> artifacts (each citing the evidence IDs below) and never appended here.
>
> Established: 2026-08-14 · Inspected revision: `4975f4f` (branch
> `docs/drenyra-dominion-program`) · Evidence register: §3 · Vocabulary: §1

## 1. Five-axis status vocabulary

Status values are lowercase in machine-readable records; prose qualifies the axis
where a term could be ambiguous. Each term maps to exactly one axis and meaning.

| Axis | Canonical values | Meaning and term mapping |
| --- | --- | --- |
| Lifecycle | `planned`, `active`, `blocked`, `candidate`, `complete`, `superseded` | Program, SDD, or checkpoint progress only. Existing `DRAFT` → `planned`; `PLANNED` → `lifecycle:planned`; `IN PROGRESS` → `active`; `COMPLETE` → `complete`. `candidate` is a checkpoint lifecycle value, never proof of conformance. |
| Implementation maturity | `absent`, `planned`, `partial`, `implemented` | Capability presence only. Existing `implemented` / `partial` / `planned` capability terms map here unchanged. Never completes an SDD or gate. |
| Evidence | `verified-current`, `verified-revision-bound`, `stale`, `unverified`, `unknown` | Strength and freshness of support. Existing `passing` → `verified-revision-bound` only when bound to an identifiable revision; otherwise `unverified`. |
| Gate decision | `pending`, `approved-pending-evidence`, `satisfied`, `waived`, `blocked` | Decision/prerequisite state. `waived` is valid only with owner, rationale, scope, and durable approval reference. |
| Temporal class | `historical-snapshot`, `current-claim` | Whether text reports a past checkpoint or claims present truth. Every numeric total, SHA, version, visibility, and conformance statement carries this axis. |

Rules:

- `planned` is always qualified (`lifecycle:planned` or `maturity:planned`).
- Lifecycle is never derived from maturity: an `implemented` capability does not
  make its parent SDD `complete` (R3).
- Documentary presence alone never marks a gate row or SDD `complete` (R4).

## 2. Source precedence

1. Current repository contents and executable verification over the inspected revision.
2. Direct current GitHub repository metadata or release/PR records.
3. Persisted verification tied to an identifiable revision.
4. Apply-progress and archive records.
5. Roadmap, capability matrix, program lock, and narrative planning documents.

Precedence is revision-scoped: a higher source prevails only for the revision or
observation it proves. Lower-precedence documents remain claims to reconcile,
never authority to overwrite stronger evidence (R5).

## 3. Evidence register

| `claimId` | Axis / value | Temporal class | Source kind | Source locator | Repository identity | Revision | Captured at (UTC) | Verification method | Freshness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E-001 | lifecycle — inspected tree | current-claim | repository | `HEAD 4975f4f`, branch `docs/drenyra-dominion-program` | arkelythex/drenyra-ai | 4975f4f | 2026-08-14T20:57:27Z | `git rev-parse` / `git status` | verified-current |
| E-002 | evidence — test suite | current-claim | executable-verification | `bun run test` (vitest) | arkelythex/drenyra-ai | 4975f4f | 2026-08-14 (run) | Fresh run: 60 files, 774/774 passed, exit 0 | verified-current |
| E-003 | evidence — typecheck | current-claim | executable-verification | `bun run typecheck` (tsc --noEmit) | arkelythex/drenyra-ai | 4975f4f | 2026-08-14 (run) | Fresh run: clean, exit 0 | verified-current |
| E-004 | evidence — fiscal verification | current-claim (report) | persisted-verification | `openspec/changes/fiscal-authority-kernel/verify-report.md` | arkelythex/drenyra-ai | 4975f4f | 2026-08-14 | Read: 774/774 green, typecheck/build clean, tree clean | verified-revision-bound (4975f4f) |
| E-005 | evidence — GitHub visibility | current-claim | github-metadata | `gh repo view arkelythex/drenyra-ai --json nameWithOwner,visibility,url,defaultBranchRef,pushedAt` | arkelythex/drenyra-ai | n/a (live) | 2026-08-14T20:57:27Z | Direct API query: visibility PUBLIC, default branch main, url <https://github.com/arkelythex/drenyra-ai> | verified-current (observation-scoped) |
| E-006 | evidence — 640-test checkpoint | historical-snapshot | narrative | `capability-matrix.yaml` / `program-lock.json` | arkelythex/drenyra-ai | prior snapshot | 2026-08-11 | Read | stale for current use |
| E-007 | evidence — three CLI failures baseline | historical-snapshot | narrative | `cmd/__tests__/cli.test.ts` (as of sdd-init) | arkelythex/drenyra-ai | prior | 2026-08-11 | Read | superseded by E-002/E-004 |
| E-008 | lifecycle — canonical 12-SDD catalog | current-claim | repository | `openspec/programs/drenyra-dominion/sdds/` | arkelythex/drenyra-ai | 4975f4f | 2026-08-14T20:57:27Z | Directory enumeration: SDD-000…SDD-110 by tens (12) | verified-current |
| E-009 | gate decision — three business inputs | current-claim (durable capture) | decision-record (owner-approved) | Gate 0 §3 (product owner approval, recorded 2026-08-15) | arkelythex/drenyra-ai | b4d3cbf | 2026-08-15T01:45Z | Durable attributable approval captured: ICP = Peruvian accounting firms (SME/mid-market) with monthly close obligations + internal finance teams; operators = professional accounting firms + internal accounting teams; first journey = Peruvian monthly close. Owner: arkelythex (product owner), via orchestration directive 2026-08-14/15. | verified-current (durable record in gate-0.md §3) |
| E-010 | evidence — sibling visibility | current-claim | github-metadata | `gh repo view` per sibling (drenyra-engram, drenyra-pi, drenyra-command-center, drenyra-skills, drenyra-guardian-angel, drenyra-app-web) | arkelythex/* | n/a (live) | 2026-08-15T~01:40Z | Direct API queries: engram PUBLIC, pi PUBLIC, command-center PRIVATE, skills PRIVATE, guardian-angel PRIVATE, app-web = command-center (rename redirect) | verified-current (observation-scoped) |
| E-011 | evidence — host README alignment | current-claim | repository | `README.md` (this repo, updated 2026-08-15) | arkelythex/drenyra-ai | gate0-unblock branch | 2026-08-15T01:45Z | Stale "private repository" claim corrected to public source (open-core intention, charter §9); commercial artifacts remain contractual | verified-current |
| E-012 | evidence — sibling README alignment | current-claim | github-metadata | sibling READMEs via `gh api .../readme` (drenyra-pi #36, drenyra-engram #25, drenyra-command-center #180 merged 2026-08-15) | arkelythex/* | merged | 2026-08-15T01:42Z | Stale "private ecosystem" claims corrected in pi/engram/command-center (app-web = redirect); skills/guardian-angel already correct | verified-current (merged) |
| 010E-009 | evidence — engram sibling fact (refresh) | current-claim (observation-scoped) | github-metadata | `gh api repos/arkelythex/drenyra-engram` + `git/ref/heads/main` | arkelythex/drenyra-engram | 94417fd718069007e396b8d674df6ca87dbfd9fb | 2026-08-15T18:21:55Z | Direct API queries: visibility public, default branch main, immutable main SHA (post RelationsForScope to_id hardening commit) | verified-current (observation-scoped); corroborates E-010 |
| 010E-010 | evidence — pi sibling fact (refresh) | current-claim (observation-scoped) | github-metadata | `gh api repos/arkelythex/drenyra-pi` + `git/ref/heads/main` | arkelythex/drenyra-pi | 340da3b2de7c73bcff007b9fa924d2dac7cd9e2c | 2026-08-15T18:21:55Z | Direct API queries: visibility public, default branch main, immutable main SHA | verified-current (observation-scoped); corroborates E-010 |

Notes:

- E-006 and E-007 are historical; they are never rewritten as current truth (R7).
- E-004 corroborates E-002 at the same revision; a promoted current claim may
  cite either, bound to revision `4975f4f` (R12).
- E-005 proves only the queried repository at observation time; a public PR is
  evidence the PR URL is reachable, not that the repository is public (R11).

## 4. Freshness rules

- Repository/executable evidence is `verified-current` only while the candidate
  tree equals the inspected tree; after content changes, recapture or treat as
  revision-bound.
- Persisted reports are `verified-revision-bound` when the revision is
  identifiable; they never silently become current for another revision.
- GitHub metadata is `verified-current` only for the reconciliation observation
  and exact repository identity; refresh at each integrated checkpoint or mark
  `stale` / `unverified`.
- Lock and matrix values are `historical-snapshot` until corroborated by
  stronger evidence.
- External-repository facts that cannot be queried directly are `unknown`;
  public links do not prove visibility.

## 5. Historical/current index

| Claim | Temporal class | Status under vocabulary |
| --- | --- | --- |
| 640-test program snapshot | historical-snapshot | Retained as history; not current (E-006) |
| Three CLI failures baseline | historical-snapshot | Superseded by green evidence; not current (E-007) |
| 774/774 fiscal verification at `4975f4f` | verified-revision-bound | Current for `4975f4f` only (E-004); corroborated by fresh run E-002 |
| Repository visibility PUBLIC | verified-current | Current for observation 2026-08-14T20:57:27Z (E-005) |
| SDD-000 / SDD-010 lifecycle | current-claim | `lifecycle:active` — see SDD READMEs; Gate 0 rows 3–4 satisfied 2026-08-15 (E-009..E-012); SDD-000 content-contract phases and SDD-010 release-train remain (R3/R4) |
| Gate 0 rows 3–4 | current-claim | `satisfied` 2026-08-15 (E-009..E-012); SDD-020 permitted (gate-0.md §4) |

Related but non-duplicative: `ecosystem-coherence` exclusively owns its EC
inconsistency inventory, governance-decision register, propagation units, and
readback log. This record references it only at the boundary (pointer in
gate-0.md §4); nothing from that record is copied, modified, superseded, or
marked complete here (R16).
