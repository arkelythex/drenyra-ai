# Delivery Sequence — Drenyra Dominion Program

> Status: DRAFT (v0.1) · Owner: Drenyra Dominion Program
> This document defines the EXACT commit/PR sequence for landing a federated
> checkpoint. It exists because `program-lock.json` has a bootstrap problem:
> a lock that pins commit SHAs becomes stale the moment the documentation
> commits land, and a commit can never contain its own SHA.

## 1. The bootstrap problem

`program-lock.json` pins the exact `commitSha` of every repository. Two facts
make a naive single commit impossible:

1. **Stale-on-arrival:** the SHAs recorded at generation time (2026-08-11,
   `status: baseline`) are the pre-documentation HEADs. Committing the
   documentation changes every repo's HEAD, so the recorded SHAs stop
   describing the ecosystem the moment the first commit lands.
2. **Circular self-reference:** the commit that carries `program-lock.json`
   inside `drenyra-ai` cannot pin its own SHA — the SHA only exists after the
   commit is created.

**Rule (host repo):** `program-lock.json` NEVER contains the SHA of the commit
that contains it. For the host (`drenyra-ai`) it records `programBaseCommit`
(the commit that introduces the program tree); the SHA of the final lock
commit is fixed by an external attestation / release manifest.

    **Rule (external repos):** `repositories[].commitSha` always refers to the
    other five repositories' committed SHAs — these exist independently of the
    lock commit and are always verifiable.

## 1.1 Lock freshness, promotion, and readback (W2 reconciliation 2026-08-15)

- **Freshness:** lock values are `historical-snapshot` until corroborated by
  stronger evidence. `program-lock.json` separates the historical snapshot from
  the `currentVerified` block (revision-bound facts), so stale SHAs, versions,
  test totals, and conformance are never presented as current (R13).
- **Promotion:** `status: candidate` → `promoted` requires a fresh or
  revision-bound green verification over the EXACT inspected revision (e.g.
  W2E-001: 774/774 at `6326eee`), per the evidence register
  (`status-and-evidence.md` §3); a stale or unrelated green result does not
  promote.
- **Bootstrap:** the host lock never contains the SHA of the commit that
  carries it. `currentVerified.host.commitSha` stays `null`; the lock commit
  SHA is fixed externally by the release manifest / attestation (B5).
- **Readback:** before promotion, validate `program-lock.json` against
  `program-lock.schema.json`, parse `capability-matrix.yaml`, and resolve every
  evidence ID against the register; a dangling ID or unsupported current claim
  blocks promotion.

## 2. Two-phase federated release

```
Phase A — Documentary commits (per repo, independent)
  A1. drenyra-ai     : docs + openspec/programs/** (program-lock.json keeps baseline SHAs)
  A2. command-center : README + docs/00-INDEX + strategy
  A3. drenyra-pi     : README + ROADMAP
  A4. drenyra-engram : README + ROADMAP
  A5. drenyra-skills : README
  A6. guardian-angel : README

Phase B — Lock update + verification + promotion
  B1. Read the six final HEADs after Phase A.
  B2. Commit B in drenyra-ai: update program-lock.json with the five
      external SHAs + host.programBaseCommit = Phase-A drenyra-ai HEAD.
  B3. Re-run federated verification over those EXACT SHAs.
  B4. Push drenyra-ai first, then the other five repos.
  B5. External attestation / release manifest pins the SHA of commit B
      (the lock commit) — never self-referenced inside the repo.
  B6. Open PRs / promote the checkpoint.
```

## 3. Phase A — exact commit contents

Commit ONLY the listed paths. Pre-existing dirty files MUST be excluded from
every commit (see §5).

| Repo | Commit A paths | Conventional commit |
| --- | --- | --- |
| drenyra-ai | `README.md`, `ROADMAP.md`, `docs/governance.md`, `openspec/programs/**` | `docs(program): add Drenyra Dominion Program master + 12 vertical SDDs` |
| drenyra-command-center | `README.md`, `docs/00-INDEX.md`, `openspec/strategy-drenyra-superiority-2026.md` | `docs(program): reference Drenyra Dominion Program (SDD-050/060/100)` |
| drenyra-pi | `README.md`, `ROADMAP.md` | `docs(program): reference Drenyra Dominion Program (SDD-020/030/040)` |
| drenyra-engram | `README.md`, `ROADMAP.md` | `docs(program): reference Drenyra Dominion Program (SDD-080/050)` |
| drenyra-skills | `README.md` | `docs(program): reference Drenyra Dominion Program (SDD-070/050)` |
| drenyra-guardian-angel | `README.md` | `docs(program): reference Drenyra Dominion Program (SDD-090/040)` |

Ordering within Phase A is not strictly required for correctness (the five
consumer repos reference `drenyra-ai` via absolute GitHub URLs that resolve
only after push), but committing `drenyra-ai` first keeps the reference links
valid as soon as possible.

## 4. Phase B — lock update, exactly

1. After all Phase-A commits, read the new HEADs:

   ```bash
   git -C drenyra-command-center rev-parse HEAD   # -> external SHA 1
   git -C drenyra-pi rev-parse HEAD               # -> external SHA 2
   git -C drenyra-engram rev-parse HEAD           # -> external SHA 3
   git -C drenyra-skills rev-parse HEAD           # -> external SHA 4
   git -C drenyra-guardian-angel rev-parse HEAD   # -> external SHA 5
   git -C drenyra-ai rev-parse HEAD               # -> host.programBaseCommit (Phase-A HEAD)
   ```

2. Update `program-lock.json` in drenyra-ai:
   - `repositories[].commitSha` for the five external repos → new HEADs.
   - Add `host.programBaseCommit` = Phase-A `drenyra-ai` HEAD.
   - `status: candidate` (verified next), then `promoted` after B6.
   - Do NOT add the SHA of commit B itself.
3. Commit B: `chore(program): lock ecosystem checkpoint <checkpoint-id> after documentation commits`
4. **Re-run the federated verification** (`gentle-ai-verify` equivalent, or
   the conformance CI + multi-repo journeys) over those exact SHAs:
   contracts conformance, per-repo suites, cross-tenant tests, link audit.
   Freshness rule: only a green result over the exact recorded SHAs
   supports promotion; a stale or unrelated result does not (§1.1).
5. Push `drenyra-ai` first, then the remaining repos.
6. Record commit B's SHA in the external **release manifest / attestation**
   (signed, out-of-tree or as a release artifact). This is what makes
   "Drenyra v0.x" a reproducible composition — the manifest pins the lock
   commit, the lock pins everything else.
7. Open PRs (or push direct per repo policy) and promote the checkpoint.

## 5. Pre-existing dirty files to EXCLUDE from Phase-A commits

The doc task touched ONLY the listed paths; the following were dirty before
this task and belong to other work — they must NOT be swept into these commits:

| Repo | Exclude (pre-existing) |
| --- | --- |
| drenyra-ai | `missions/__tests__/postgres.integration.test.ts`, `openspec/changes/fiscal-authority-kernel/apply-progress.md`, `skills/__tests__/pe-skills.test.ts` |
| drenyra-command-center | 35 modified `packages/**` + 7 untracked `packages/mission-domain/*.d.ts` (branch `chore/typecheck-strict-compliance`) |
| drenyra-pi | `__tests__/agents.test.ts`, `__tests__/extension.test.ts`, `scripts/verify-package-files.mjs` |
| drenyra-engram | `internal/server/api.go`, `http.go`, `http_test.go`, `internal/store/store.go`, `openspec/changes/audit-register-closure/**`, untracked `internal/server/cross_tenant_matrix_test.go` |
| drenyra-skills | none |
| drenyra-guardian-angel | none |

Use path-scoped `git add <path>` (never `git add -A` / `git add .`) so the
pre-existing changes stay untouched and uncommitted.

## 6. Pre-commit validation gate (already run)

| Check | Result |
| --- | --- |
| `git diff --check` (6 repos) | PASS — no whitespace errors |
| New files included explicitly | PASS — `openspec/programs/**` untracked; staged via explicit path |
| JSON / JSON Schema valid | PASS — `program-lock.json` + `program-lock.schema.json` parse and validate |
| YAML parseable | PASS — `capability-matrix.yaml` |
| Relative links from each location | PASS — 22 files, 0 broken |
| No frozen contract modified | PASS — zero `contracts/` paths in any diff |
| No pre-existing change mixed | PASS — task touched only the (a) set; (b) listed above |
| Visibility vs private stage | FIXED during delivery — command-center README:18 badge changed MIT → Proprietary (matches LICENSE); capability-matrix.yaml:59 synced |

## 7. Open items for the promotion decision

- [x] Fix command-center README badge (MIT → Proprietary) — gate-0 item 3. Done during delivery.
- [ ] Confirm ICP / operators / first journey (gate-0 item 4) before SDD-020.
- [ ] Commit + push Phase A, then Phase B, per this sequence.
- [ ] Add the release-manifest attestation workflow (B5) to the federated CI
      when the release train lands (SDD-010).
