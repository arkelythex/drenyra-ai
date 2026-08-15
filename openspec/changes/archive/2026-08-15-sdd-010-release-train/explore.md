# SDD-010 — Release-Train Closure / Program-Lock Promotion — Exploration

> Change: `sdd-010-release-train` · Date: 2026-08-15 · Author: explorer
> Goal: promote `openspec/programs/drenyra-dominion/program-lock.json` from
> `status: candidate` to a published `promoted` checkpoint with verified sibling
> facts, populated checksums, and a release-attestation workflow (delivery-sequence
> §7 item 4 / B5).

## 1. The lock's current state

Source: `openspec/programs/drenyra-dominion/program-lock.json` (+ its
`program-lock.schema.json`). `lockVersion: 1`, `stage: private`, generated
2026-08-12 (Phase B after Phase-A documentary commits).

### 1.1 Top-level status and waves

- `status: "candidate"` (schema enum: `baseline | candidate | promoted | superseded`).
- `waves.wave-0-constitution: "in-progress"`; waves 1–4 all `pending`.
- `checksums: { note: "Computed at promotion time by the federated integration
  runner; baseline lock records SHAs only." }` — **currently empty, by design**.
- `host`: `repository: drenyra-ai`, `programBaseCommit: 0a00ccb…` (Phase-A HEAD);
  note states the lock commit SHA is never self-referenced (fixed externally).

### 1.2 `snapshot` (historical) vs `currentVerified` (current-claim) — the W2 split

The W2 reconciliation (2026-08-15) added the `currentVerified` block (R12/R13)
so stale values are never presented as current:

- `snapshot`: `temporalClass: historical-snapshot`, captured 2026-08-12. Carries
  the older narrative values (e.g. drenyra-ai version `0.2.0`, `conformance.tests:
  640`).
- `currentVerified`: `temporalClass: current-claim`, `inspectedRevision:
  549ed640e05bca03c0debd383ef523fb19605a5e7`, inspected 2026-08-15T00:06:08Z,
  evidence `[W2E-001…W2E-004, E-005]`.
  - `host`: version `0.2.1` (W2E-004), license `proprietary`, `testTotal: 774`
    (W2E-001 fresh run), typecheck clean, conformance `passing`, githubVisibility
    `PUBLIC`, **`commitSha: null`** (bootstrap rule).
  - `siblingRepositories`: `temporalClass: unknown` — "Current SHAs, versions,
    test totals, and conformance for the five sibling repositories are not
    verifiable from this clone; recorded as awaiting evidence (R13)."

### 1.3 Per-repository rows

All six `repositories[]` entries carry `temporalClass: historical-snapshot`
commit SHAs from the 2026-08-12 snapshot (the values themselves are stale unless
corroborated). Current (2026-08-15) sibling visibility facts come from the
evidence register E-010 (see §3), not from these snapshot rows.

### 1.4 Freshness gap detected during exploration

`package.json` currently reports **`version: 0.3.0`** (read at explore time),
whereas `currentVerified.host.version` is `0.2.1` and `capability-matrix.yaml`
records `current: 774` (W2E-001). The W2 facts were bound to revision `549ed64`
on 2026-08-15. **Any promotion must re-verify over the exact current inspected
tree** (per delivery-sequence §1.1/§4.4 freshness rule): the 0.3.0 version, the
current test total, and current visibility must be freshly corroborated before
`candidate → promoted`. A stale W2E-001/W2E-004 value does not promote.

## 2. The promotion process per release-train / delivery-sequence

Sources: `openspec/programs/drenyra-dominion/release-train.md` (DRAFT v0.1) and
`delivery-sequence.md` (DRAFT v0.1, §1.1, §2, §4, §7).

### 2.1 release-train pipeline

§3 pipeline (candidate → static analysis/SBOM → per-repo tests → federated
conformance → multi-repo journeys → recovery/adversarial → packed install →
**Manifest and checksums** → **Signature + promotion**). §4 defines
`program-lock.json` as the reproducible composition (repo, SHA, version,
contracts, skills, storage schemas, compatibility, conformance, **artifacts and
checksums**).

### 2.2 Two-phase delivery (delivery-sequence §2)

- **Phase A** — independent documentary commits per repo (A1…A6).
- **Phase B** — B1 read six final HEADs; B2 commit B updating the five external
  SHAs + `host.programBaseCommit`; B3 re-run federated verification over those
  exact SHAs; B4 push drenyra-ai first; **B5 external attestation / release
  manifest pins commit B's SHA (never self-referenced)**; B6 open PRs / promote.

### 2.3 What "promoted" requires (delivery-sequence §1.1 + §4)

1. **Fresh or revision-bound green verification over the EXACT inspected
   revision** (e.g. `774/774 at <rev>`). A stale or unrelated green result does
   not promote.
2. **Readback gate** before promotion: validate `program-lock.json` against
   `program-lock.schema.json`; parse `capability-matrix.yaml`; resolve every
   evidence ID against the register. A dangling ID or unsupported current claim
   blocks promotion.
3. **Bootstrap rule**: `currentVerified.host.commitSha` stays `null`; the lock
   commit SHA is fixed externally by the release manifest / attestation (B5).
4. **Checksums**: the `checksums` block is populated at promotion time by the
   federated integration runner (per-repo artifact/commit checksums).
5. **Attestation workflow**: delivery-sequence §7 item 4 — "Add the
   release-manifest attestation workflow (B5) to the federated CI when the
   release train lands (SDD-010)." This is still `[ ]` open.
6. Final: `status: candidate → promoted`, open PRs / promote the checkpoint
   (B6).

## 3. Sibling facts obtainable now

### 3.1 Reachability / visibility (verified 2026-08-15, evidence register E-010)

`openspec/programs/drenyra-dominion/status-and-evidence.md` §3 E-010 (direct
`gh repo view` per sibling, `arkelythex/*`):

| Repo | Role | Visibility (E-010) | Notes |
| --- | --- | --- | --- |
| drenyra-ai | authority-core | PUBLIC | host |
| drenyra-engram | institutional-memory | **PUBLIC** | reachable, Apache-2.0 |
| drenyra-pi | agentic-runtime | **PUBLIC** | reachable |
| drenyra-command-center | command-center | PRIVATE | needs auth |
| drenyra-skills | knowledge-content | PRIVATE | needs auth |
| drenyra-guardian-angel | independent-verification | PRIVATE | needs auth |
| drenyra-app-web | — | (rename redirect) | = command-center |

### 3.2 What can be fetched now

- **Public siblings (engram, pi):** main-branch commit SHAs via
  `gh api repos/arkelythex/drenyra-engram/git/ref/heads/main` and
  `.../drenyra-pi/git/ref/heads/main`; versions via `.../contents/package.json`
  (or `.../releases/latest`). Fetchable **without** auth in this clone.
- **Private siblings (command-center, skills, guardian-angel):** reachable only
  with an authenticated `gh`/PAT in a context that holds the org credential.
  From this read-only exploration I could not execute live `gh api` calls, so
  **current main-branch SHAs/versions for the six repos were not retrieved
  here** — they are obtainable at apply time via `gh api` (public pair) and via
  credentialed access or the federated integration runner (private trio).
- **Snapshot SHAs** for all six repos are present in `program-lock.json`
  `repositories[].commitSha` (historical, 2026-08-12) but are stale-by-design
  and must be refreshed/corroborated before promotion.

E-012 (sibling README alignment, merged 2026-08-15) corroborates pi/engram/
command-center public-claim corrections but is NOT repository SHA/version
evidence — per R11/E-005 notes, public links do not prove visibility and a PR
being public does not prove a repo's composition.

## 4. Existing tooling and consumption

Source: `scripts/` (+ `scripts/__tests__/release-integrity.test.ts`).

- `scripts/checksums.mjs` — walks `dist/`, writes `dist/checksums.txt`
  (SHA-256, `sha256  rel-path`, sorted, self-excluded). Works for the **drenyra-ai
  package artifact set** (`dist/`). It does **not** write the `program-lock`
  `checksums` block.
- `scripts/verify-release-integrity.mjs` — verifies `dist/checksums.txt`
  self-consistency + CycloneDX SBOM fidelity (consistency evidence, not
  authenticity/signatures — explicitly documented).
- `scripts/sbom.mjs` — SBOM generation.
- Tests cover all three with strict TDD (determinism, cwd independence, ordering,
  self-exclusion, fail-closed).
- **Consumption code:** no runtime/install-time code in this repo reads
  `program-lock.json` (grep of `*.mjs`/`*.ts`/`*.js` found only docs/tests and an
  aspirational comment in `configurator/managed-config.ts:271` "derived from
  program-lock, network, host introspection…"). Promotion is a **documentation /
  governance** operation, not a code-path change.

### 4.1 Gap: no program-lock checksum producer

The existing `checksums.mjs` computes artifact checksums for `dist/`, not the
federated per-repo/program-lock checksums the `checksums` block expects. A new
small script (e.g. `scripts/checksum-lock.mjs`) would be needed to compute
program-lock checksums (SHA-256 of the pinned repo SHAs / artifacts) and to emit
a release-manifest/attestation record (B5). The scope is bounded; see §5.

## 5. Promotion change scope and size estimate

The change touches documentation + the lock + (optionally) one new script. All
writes stay inside the program tree + `scripts/`; no production code path.

| Item | Change | Est. size |
| --- | --- | --- |
| `program-lock.json` | Refresh `currentVerified` to the exact current tree (version 0.3.0, fresh test total, fresh visibility); populate `checksums`; set `status: candidate → promoted`; update waves (`wave-0-constitution: complete`?) + sibling facts | ~30–45 lines |
| `program-lock.schema.json` | Likely no structural change (checksums already `{}` object, status enum already allows `promoted`) — only if attestation field added | 0 or ~5 |
| `delivery-sequence.md` | Close §7 item 4 (add release-manifest attestation workflow) + promote wording | ~10–20 |
| `release-train.md` | Optional: mark B5/signing implemented | ~5–10 |
| `capability-matrix.yaml` | Refresh host/sibling facts to current | ~10–15 |
| `status-and-evidence.md` | Add promotion evidence rows (E-0xx) resolving every new claim | ~10–15 |
| `sdds/sdd-010-contracts/README.md` | Update status note / lifecycle reconciliation (still not `complete`? — promotion is part of release-train obligations) | ~4–6 |
| `scripts/checksum-lock.mjs` + test | New: compute program-lock checksums + emit release manifest/attestation (B5) | ~60–100 + ~60 test |
| Readback/integrity | Validate lock vs schema, parse matrix, resolve evidence IDs | ~0 (manual) |

**Total estimate:** ~150–250 changed lines, documentation-heavy, one small new
script. Under the 400-line per-review-unit budget (release-train §6); likely a
single bounded change, no chained PRs required unless policy demands split.

## 6. Risks

1. **Bootstrap self-reference rule (CRITICAL to respect):** the lock must never
   contain the SHA of the commit that carries it. `currentVerified.host.commitSha`
   and any checksums must not include the lock commit's own SHA; the lock commit
   SHA is fixed externally by the release manifest/attestation (B5). A naive
   "pin current HEAD" implementation breaks this and violates the schema note.
2. **Checksum integrity / self-inclusion:** program-lock checksums must cover the
   pinned composition (repo SHAs/artifacts) deterministically and must not
   include the file that references them circularly. Mirror the `checksums.mjs`
   self-exclusion + sorted + fail-closed patterns; verify, never just generate.
3. **Sibling verification limits:** the private trio (command-center, skills,
   guardian-angel) is not directly verifiable from this public clone without a
   credential. Per R13 / E-010, those facts must stay `unknown`/`awaiting
   evidence` (or be corroborated via the credentialed federated runner); **do not
   fabricate promoted SHAs/versions** for repos you cannot query. Only engram+pi
   are fetchable now; app-web is a redirect to command-center.
4. **Stale-evidence trap:** W2 facts (0.2.1 / 774 / 549ed64) are stale for the
   current tree (package.json is now 0.3.0). Promotion requires a **fresh**
   revision-bound green verification over the exact inspected revision; reusing
   W2E-001/W2E-004 without refresh violates the freshness rule and must be
   blocked.
5. **Schema/vocabulary drift:** any new `attestation`/`manifest` field must stay
   within the schema (draft-07) and the five-axis temporal vocabulary; a dangling
   evidence ID or unsupported current claim blocks promotion (readback gate).

## 7. Recommendation / next step

Promotion is a **governance/documentation change** (lock + docs + one bounded
script + attestation workflow), ~150–250 lines, no production code path. The
critical prerequisites are (a) a fresh revision-bound green verification over the
current tree, (b) sibling facts resolved per E-010 reachability (public pair
fetchable; private trio stays `unknown` unless credentialed), (c) a checksum
producer that respects the bootstrap rule, and (d) the §7 item 4 release-manifest
attestation workflow. Proceed to proposal/spec with these constraints; the
exploration itself created no files outside this change directory.

## Evidence references

- `openspec/programs/drenyra-dominion/program-lock.json` (+ `.schema.json`)
- `openspec/programs/drenyra-dominion/delivery-sequence.md` (§1.1, §2, §4, §7)
- `openspec/programs/drenyra-dominion/release-train.md` (§3–§6)
- `openspec/programs/drenyra-dominion/status-and-evidence.md` (§3 E-005/E-010/E-012, §4)
- `openspec/programs/drenyra-dominion/capability-matrix.yaml`
- `openspec/programs/drenyra-dominion/sdds/sdd-010-contracts/README.md`
- `scripts/checksums.mjs`, `scripts/verify-release-integrity.mjs`,
  `scripts/__tests__/release-integrity.test.ts`
- `package.json` (version 0.3.0)
