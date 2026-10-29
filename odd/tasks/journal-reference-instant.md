# Feature: journal-reference-instant

**Objective:** close the `future-capture-date` survivor from #123. A journal entry rejects evidence captured after a caller-supplied reference instant (`asOf`), and the kernel itself never reads a clock. This change is in the kernel; the Shell propagation runs in Drenyra Shell after the 0.8.0 release.
**Branch:** `feat/journal-reference-instant` · **Refs:** #123
**Gates:** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`.

## Specs

- **S1** — Owner: "perfecto avanza", after the recommendation to start with the reference clock ("Es una decisión de diseño acotada y mata el penúltimo sobreviviente"). Design choice: "Obligatorio: fail-closed (recomendado)". Without `asOf`, the kernel rejects the entry (`invalid-as-of`).
- **S2** — `JournalRecordInput` gains a required `asOf: string`, an ISO-8601 instant, used by both `record` and `supersede`. If it is missing, not a string, or unparseable, the entry is rejected with the new code `invalid-as-of`, and nothing is recorded.
- **S3** — When any evidence artifact bound to the entry has `provenance.capturedAt` later than `asOf`, the entry is rejected with the new code `future-evidence`. A capture equal to `asOf` is accepted. Evidence captured after the fiscal period ends stays valid: invoices arrive late.
- **S4** — Journal and evidence validation still read no clock. The same input always gets the same verdict, and `asOf` is not stored on the entry.
- **S5** — The change is breaking for callers of `record`/`supersede` and is released as the pre-1.0 MINOR `0.8.0`, with a migration note. Existing error codes and their order are unchanged for inputs that carry a valid `asOf`.
- **S6** — Drenyra Shell passes `asOf` from its own clock, pins 0.8.0, and moves the control mutation ratchet to 24/25. This is tracked in Shell `odd/tasks/runtime-pin-0.8.0.md`.

## Tasks

- [x] **T1** — RED: journal tests for S2–S4 (missing, unparseable, future, equal, past period, supersede). *(S2, S3, S4)* — `d86cba1`
- [x] **T2** — GREEN: `JournalRecordInput.asOf`, the `invalid-as-of` and `future-evidence` codes, and validation; update the existing test fixtures. *(S2, S3, S4)* — `d86cba1`
- [x] **T3** — CHANGELOG and migration note; gates; PR; merge. *(S5)* — #162 merge `d504042`
- [ ] **T4** — Release 0.8.0 (version PR, signed tag, release workflow). *(S5)*
- [ ] **T5** — Shell propagation, tracked in the Shell. *(S6)*

## Log

### L1 — 2026-10-28 — request (verbatim)

> perfecto avanza

### L2 — 2026-10-28 — design decision (verbatim)

The question asked whether `asOf` is required or optional in `journal.record`. Answer:

> Obligatorio: fail-closed (recomendado)

### L3 — 2026-10-28 — exploration

- `validateRecord` (`journal/validate.ts`) backs both `record` and `supersede`. Evidence binding lives in `assertEvidenceBound`, and `RegisteredEvidence.provenance.capturedAt` is an ISO string validated with `Date.parse` (`evidence/identity/identity.ts:31`).
- Within this repository, nothing outside `journal/` calls `record`/`supersede`. Per #131, `drenyra-command-center` does not import `drenyra-ai/journal`. The only known consumer is Drenyra Shell `lib/journal-proposal.ts`.
- "The kernel reads no clock" holds for journal and evidence validation. `receipts/sign.ts` and `missions/runtime.ts` do read `new Date()`, and this change does not touch them.

### L4 — 2026-10-28 — T1 RED / T2 GREEN

- RED: 9 new cases in `journal/__tests__/journal.test.ts`. The 6 rejection cases failed, as expected, because the kernel had no `asOf`: missing asOf; unparseable, blank, or numeric asOf; future evidence; 1 ms after asOf; supersede issuing no receipt; and a determinism case. The 3 preservation cases passed: capture exactly at asOf, capture after the period ends, and asOf not stored. Total 6 failed, 32 passed.
- GREEN: `asOf` is required on `JournalRecordInput`, with the codes `INVALID_AS_OF` (`invalid-as-of`) and `FUTURE_EVIDENCE` (`future-evidence`). `referenceInstant` runs right after the entry id check. The future check runs per artifact after the scope check, inside `assertEvidenceBound`. An unparseable `capturedAt` also fails closed as `future-evidence`; registered evidence cannot carry one, because the registry validates it. Result: journal 38/38, typecheck clean. Repository-facing docs have no journal call example to update.

### L5 — 2026-10-28 — gates

One `set -euo pipefail` run exited 0. Typecheck: clean. Lint: 188 files, no fixes; the 2 Biome infos already existed. `verify:package`: 113 files and 1519 tests passed (1510 + 9 new), package files OK, release integrity OK. `verify-packed-install`: OK. `git diff --check`: clean.

### L6 — 2026-10-28 — T3 merged; T4 version PR

PR #162 passed CI and was merged with an ordinary merge commit, pinned to the reviewed head `d86cba1`, as `d504042`. T4 starts with `chore/release-0.8.0`: `npm version 0.8.0 --no-git-tag-version --ignore-scripts` updates `package.json` and the two root version fields of `package-lock.json`. The `[Unreleased]` entries (the `asOf` change and the dependency advisories) become `## [0.8.0] - 2026-10-28`, under a migration note.

Release gates on the version tree: `bun install --frozen-lockfile`, typecheck, `verify:package` (1519 tests; release integrity: checksums and SBOM verified; 695 packaged files), and `verify-packed-install` all OK; `git diff --check` clean.
