# Evidence-First Dominion Program Reconciliation

## Decision summary

Reconciliation is a read-evidence-project procedure, not a rewrite of history. The change first captures an immutable evidence register for the inspected repository revision and directly queried GitHub metadata, then derives current administrative claims through fixed precedence and freshness rules, and only then edits an explicit documentation allowlist. Historical checkpoints remain labeled history. Unsupported claims become `unknown`, `unverified`, or blocked.

The three Gate 0 inputs are closed business decisions supplied by the user: professional accounting firms, internal accounting teams, and the Peruvian monthly close as the first journey. Their initial gate state is `approved-pending-evidence`; reconciliation captures attributable evidence but never reopens them or creates a new product-decision gate.

No product capability, runtime behavior, frozen contract, `ecosystem-coherence` record, protected user-owned path, or SDD-020 work is in scope.

## Reconciliation pipeline

1. **Freeze the inspection context.** Record repository identity, inspected commit/tree, branch only as context, timestamp, working-tree state, and the exact active-change inventory. Capture baseline hashes for every protected path.
2. **Collect evidence without editing.** Inspect repository contents; run only applicable verification needed to support a current claim; read revision-bound reports; query current GitHub metadata; and record unavailable sibling-repository facts as unknown.
3. **Build the evidence register.** Give every claim a stable ID, source, revision or observation time, verification method, freshness, and temporal class. Record the three Gate 0 approvals as user-provided inputs pending durable capture.
4. **Resolve contradictions.** Apply source precedence before wording changes. Higher-ranked evidence wins only for the revision or observation it proves. Lower-ranked documents remain historical claims or are marked stale.
5. **Project edits.** Generate a claim-to-target plan restricted to the allowlist below. Every changed current claim cites an evidence ID. No evidence means no positive claim.
6. **Apply one bounded work unit.** Stage only that unit's allowed paths. Never combine units when the candidate would reach 300 changed lines.
7. **Read back and validate.** Parse JSON/YAML, check links and vocabulary, enumerate the 12-SDD catalog, verify Gate 0 logic, compare protected hashes, and verify the changed-path set and line budget.
8. **Verify remote visibility.** For any delivered unit, inspect the GitHub PR/commit file list and rendered records against the local candidate. Current repository visibility is stated only from direct metadata captured for the exact repository identity.
9. **Publish the gate result.** Gate 0 explicitly states whether SDD-020 is blocked or permitted. Any incomplete row blocks unless a durable waiver names owner, rationale, scope, and approval reference.

## Five-axis status vocabulary

Status values are lowercase in machine-readable records and rendered with an explicit axis in prose where ambiguity is possible.

| Axis | Canonical values | Meaning and mapping |
| --- | --- | --- |
| Lifecycle | `planned`, `active`, `blocked`, `candidate`, `complete`, `superseded` | Program, SDD, or checkpoint progress only. Existing `DRAFT` maps to `planned`; `IN PROGRESS` maps to `active`; `COMPLETE` maps to `complete`. `candidate` is a checkpoint lifecycle value, not proof of conformance. |
| Implementation maturity | `absent`, `planned`, `partial`, `implemented` | Capability presence only. It never completes an SDD or gate. Existing capability terms map here unchanged. |
| Evidence | `verified-current`, `verified-revision-bound`, `stale`, `unverified`, `unknown` | Strength and freshness of support. Existing `passing` becomes `verified-revision-bound` only when tied to an identifiable revision; otherwise it is `unverified`. |
| Gate decision | `pending`, `approved-pending-evidence`, `satisfied`, `waived`, `blocked` | Decision/prerequisite state. `waived` is valid only with owner, rationale, scope, and durable approval reference. |
| Temporal class | `historical-snapshot`, `current-claim` | Whether text reports a past checkpoint or claims present truth. Every numeric total, SHA, version, visibility, and conformance statement must carry this axis. |

The term `planned` must be qualified as either `lifecycle:planned` or `maturity:planned`. SDD-000 and SDD-010 are not promoted to `complete` merely because foundations landed; reconciliation chooses their lifecycle state from gate and evidence obligations while separately exposing implemented maturity.

## Evidence model

Each evidence entry uses this schema:

| Field | Requirement |
| --- | --- |
| `claimId` | Stable identifier used by target documents. |
| `axis` / `value` | One vocabulary axis and canonical value. |
| `temporalClass` | `historical-snapshot` or `current-claim`. |
| `sourceKind` | `repository`, `executable-verification`, `github-metadata`, `persisted-verification`, `apply-archive`, or `narrative`. |
| `sourceLocator` | Repository-relative path, command/result identifier, or GitHub API resource; no credentials or local absolute paths. |
| `repositoryIdentity` | Exact owner/name for remote facts or the local repository identity. |
| `revision` | Commit/tree or source-bound revision when available; otherwise `null`. |
| `capturedAt` / `verifiedAt` | UTC observation timestamps. |
| `verificationMethod` | Read, parser, command, API query, or owner-attributable approval capture. |
| `freshness` | One evidence-axis value plus a reason. |
| `supersedes` | Prior claim IDs superseded for current use, without deleting them. |
| `notes` | Limits, unavailable facts, or bootstrap constraints. |

### Source precedence

1. Current repository contents and executable verification over the inspected revision.
2. Direct current GitHub repository metadata or release/PR records.
3. Persisted verification tied to an identifiable revision.
4. Apply-progress and archive records.
5. Roadmap, matrix, lock, and narrative planning documents.

Precedence does not erase scope: a local test run proves only the inspected tree; GitHub metadata proves only the queried repository at `capturedAt`; a persisted report remains revision-bound rather than perpetually current.

### Freshness rules

- Repository and executable evidence is `verified-current` only while the candidate tree equals the inspected tree. After a content change it must be recaptured or treated as revision-bound.
- Persisted reports are `verified-revision-bound` when their revision is identifiable. They never silently become current for another revision.
- GitHub metadata is `verified-current` only for the reconciliation observation and exact repository identity. Refresh it at each integrated checkpoint; otherwise mark it `stale` or `unverified`.
- Lock and matrix values are historical snapshots until corroborated by stronger evidence.
- External-repository facts that cannot be queried directly are `unknown`; public links do not prove visibility.
- The 640-test and three-CLI-failure records remain `historical-snapshot`. A current green claim requires fresh or revision-bound green evidence.

## Exact documentation edit allowlist

Only the following paths may be edited during apply. Section restrictions are part of the allowlist.

| Work unit | Path | Allowed edit |
| --- | --- | --- |
| W1 | `openspec/programs/drenyra-dominion/status-and-evidence.md` | New canonical vocabulary, evidence register, precedence, freshness, and historical/current index. |
| W1 | `openspec/programs/drenyra-dominion/gate-0.md` | Full Gate 0 reconciliation, active-change inventory, approval-evidence state, and SDD-020 decision. |
| W1 | `openspec/programs/drenyra-dominion/charter.md` | Section 7 Gate 0 summary/link only. |
| W1 | `openspec/programs/drenyra-dominion/dependency-graph.md` | Section 9 Gate 0 pointer/status wording only. |
| W1 | `openspec/programs/drenyra-dominion/sdds/sdd-000-dominion/README.md` | Status/progress and evidence references only. |
| W1 | `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md` | Status/progress, evidence contract, and governance amendment only. |
| W2 | `openspec/programs/drenyra-dominion/capability-matrix.yaml` | Evidence/freshness metadata and evidence-backed repository/capability snapshot values only. |
| W2 | `openspec/programs/drenyra-dominion/program-lock.json` | Historical/current composition metadata, attributable facts, and bootstrap-safe references only. |
| W2 | `openspec/programs/drenyra-dominion/program-lock.schema.json` | Schema changes strictly required by the added evidence/composition metadata. |
| W2 | `openspec/programs/drenyra-dominion/delivery-sequence.md` | Lock freshness, promotion, and bootstrap/readback wording only. |
| W2 | `ROADMAP.md` | Current visibility/status sentence and Dominion checkpoint references only. |
| W3 | `openspec/programs/drenyra-dominion/sdds/sdd-060-multi-operator/README.md` | Tenant-scoped least-authority and segregation amendment only. |
| W3 | `openspec/programs/drenyra-dominion/sdds/sdd-070-skills/README.md` | Provenance, vigencia, pinning, and rollback amendment only. |
| W3 | `openspec/programs/drenyra-dominion/sdds/sdd-080-engram/README.md` | Non-authorizing context and separation-of-authority amendment only. |
| W3 | `openspec/programs/drenyra-dominion/sdds/sdd-090-guardian/README.md` | Independent adversarial findings and non-approval amendment only. |
| W3 | `openspec/programs/drenyra-dominion/sdds/sdd-110-production/README.md` | Restricted authority, credentials, observability, incident evidence, and production acceptance amendment only. |

Any newly discovered target, including another roadmap mirror, requires a design/tasks amendment before apply. It must not be added opportunistically.

## Protected-path integrity

The following are read-only and must remain byte-for-byte unchanged:

- `openspec/programs/drenyra-dominion/README.md`
- `openspec/programs/drenyra-dominion/ecosystem-coherence.md`
- `openspec/changes/ecosystem-coherence/**`
- `openspec/changes/fiscal-authority-kernel/verify-report.md`
- all frozen contracts, source code, tests, generated runtime artifacts, and every path outside the allowlist

Before W1, capture blob IDs or SHA-256 hashes for each protected file and a deterministic path/hash manifest for each protected directory. After every unit and at final readback, recalculate and compare them. Also fail if `git diff --name-only` contains any non-allowlisted path. `ecosystem-coherence` may receive only a boundary-level pointer from an allowlisted document; its inventory, decisions, propagation units, and readback log are never copied or completed here.

## Work units, budget, and rollback

Each unit is a separately reviewable candidate with fewer than 300 total changed lines (insertions plus deletions). Measure before review; at 300 or above, split within the same unit by claim group and rerun integrity checks. Units are ordered W1 → W2 → W3 because composition and amendments consume the vocabulary established in W1. No unit starts SDD-020 or product implementation.

| Unit | Outcome | Rollback |
| --- | --- | --- |
| W1 — vocabulary and gate | Establish semantics, reconcile SDD-000/010 and Gate 0, and publish an explicit SDD-020 decision. | Revert W1 paths together; if gate evidence disappears, SDD-020 returns to `blocked`. Preserve captured historical entries. |
| W2 — composition and visibility | Reconcile matrix, lock, release sequence, tests, CLI history, and direct visibility evidence. | Revert only W2 paths to the prior snapshot; retain the prior lock as historical and never introduce a self-reference. |
| W3 — governance allocation | Add the five amendments to their six owning SDDs without capability claims. | Revert only amendment paragraphs; no runtime or authority state exists to migrate. |

A later unit may reference an earlier unit's committed evidence IDs. If earlier evidence is invalidated, stop, roll back dependent wording, and recapture; do not patch around the precedence model.

## GitHub visibility and delivery verification

1. Resolve the exact local remote owner/name without treating the remote URL as visibility evidence.
2. Query authenticated GitHub repository metadata for that exact identity, capturing `nameWithOwner`, `visibility`/`private`, URL, default branch, and observation time. A direct `gh repo view ... --json` or equivalent GitHub API response is acceptable.
3. If authentication, authorization, identity matching, or response integrity is unavailable, set visibility to `unverified`. Do not infer it from ROADMAP prose, license, product stage, source availability, or public PR URLs.
4. Keep `license`, `productStage`, `sourceAvailability`, and `githubVisibility` as independent fields/claims.
5. After delivery, query the PR/commit metadata and changed-file list. It must match the unit allowlist and protected-path manifest; rendered GitHub text must preserve evidence IDs and historical/current labels.
6. A public PR is evidence that the PR URL is reachable, not that the repository is public.

## Evidence matrix

| Claim / contradiction | Strongest source to capture | Target | Allowed outcome |
| --- | --- | --- | --- |
| SDD-000 says `PLANNED` while constitution/program artifacts exist | Current program tree plus attributable gate evidence | SDD-000, status/evidence index | Lifecycle `active`, `blocked`, or `complete` from obligations; landed items use maturity `implemented`. Never infer completion. |
| SDD-010 says `PLANNED` while lock/release artifacts exist | Current lock/schema/release records plus verification | SDD-010, status/evidence index | Lifecycle `active`, `blocked`, or `complete`; composition maturity separate. |
| Gate 0 uses a dated inventory and pending actions | Current OpenSpec inventory and direct evidence per row | Gate 0; charter/dependency summaries | Each row `satisfied`, `pending`, `blocked`, or valid `waived`; SDD-020 explicitly blocked unless all required rows permit it. |
| Three approved Gate 0 business inputs lack durable repository evidence | User-provided approvals, then owner-attributable durable record if captured | Gate 0, status/evidence index | `approved-pending-evidence`; promote to `satisfied` only with a citation. Never reopen. |
| Matrix/lock say 640 tests | Fresh run over inspected revision, else revision-bound fiscal verification | Matrix, lock, status/evidence index | 640 retained as historical; current total only if proven, otherwise `unverified`. |
| Three CLI failures are described as current | Revision-bound baseline plus later green report/fresh run | Status/evidence index and any allowlisted current summary | Historical failure baseline plus superseding green revision; never erase either. |
| Fiscal report records 774/774 | Protected revision-bound verify report and, if needed, a fresh run | Matrix/lock current claim | `verified-revision-bound` for its exact revision; `verified-current` only for an identical inspected tree or fresh run. |
| Lock has stale SHAs, versions, conformance, or status | Direct repository/release facts and exact revisions | Lock, schema, delivery sequence | Current verified composition, historical snapshot, or `unknown`; host lock never self-references. |
| Sibling-repository facts cannot be checked | Direct sibling repository/API evidence | Matrix and lock | `unknown` or `unverified`; never guessed from narrative. |
| ROADMAP says repository private while public PR history exists | Direct GitHub metadata for exact repo identity | ROADMAP, status/evidence index | Direct metadata value with timestamp, else `unverified`; PR visibility is not repository visibility. |
| Status terms conflict across documents | Canonical five-axis vocabulary | All allowlisted status-bearing records | Exactly one qualified axis/value per term. |
| Canonical program count could drift | Directory/catalog enumeration, protected README readback | Status/evidence index and validation report | Exactly SDD-000 through SDD-110 by tens; any other count blocks completion. |
| Evidence precedence/freshness/reproducible cross-repo claims | Specification plus evidence schema | SDD-010 | Governance requirement allocated; no claim release train is implemented. |
| Tenant-scoped least authority and segregation | Specification allocation | SDD-060 | Acceptance/governance wording only; no RBAC/ABAC implementation claim. |
| Normative provenance, vigencia, pinning, rollback | Specification allocation | SDD-070 | Acceptance/governance wording only; absent/planned capabilities remain so. |
| Non-authorizing memory/context | Specification allocation | SDD-080 | Memory remains informative and non-authoritative; no new capability claim. |
| Independent adversarial findings | Specification allocation | SDD-090 | Guardian findings remain read-only and outside approval; no implementation claim. |
| Restricted authority, credentials, accountable operations | Specification allocation | SDD-110 | Future acceptance wording for connectors/KMS/observability/incidents only. |
| `ecosystem-coherence` overlaps administratively | Protected boundary and ownership declaration | Boundary pointer in status/evidence index only | Related, non-duplicative, read-only; no copied inventory or completion state. |
| Protected user-owned records might be swept into edits | Pre/post hashes and changed-path audit | Validation evidence only | Byte-for-byte unchanged or the unit fails. |

## Validation contract

A unit is acceptable only when all applicable checks pass:

- changed paths and changed sections are within the exact allowlist;
- total changed lines are below 300;
- JSON validates against the lock schema and YAML parses;
- evidence IDs resolve and every current claim has source plus freshness;
- historical 640-test and CLI-failure checkpoints remain identifiable;
- SDD lifecycle never derives from capability maturity;
- the three Gate 0 approvals are not reopened;
- Gate 0 explicitly blocks or permits SDD-020 with evidence and valid waiver semantics;
- direct GitHub metadata supports visibility, or visibility is `unverified`;
- exactly 12 canonical SDDs remain;
- protected hashes match and `ecosystem-coherence` is unchanged;
- no code, product capability, frozen contract, or runtime behavior changed.
