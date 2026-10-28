# Feature: journal-proposal-gaps

**Objective:** make `journal.record` reject five defective proposals it records today, found by Drenyra Shell's control mutation suite. Two other survivors are deferred with their reasons. Refs #123.
**Branch:** `fix/journal-proposal-gaps`
**Gates:** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run verify:package`, markdownlint.

## Specs

From #123 (verbatim): "Each proposal is rejected with a typed error code, as the other 18 defects already are."

- **S1 — Zero amount.** A line with `amountCents` `0n` is rejected with `invalid-amount`. Amounts must be positive BigInt cents.
- **S2 — Empty account code.** A line whose `accountCode` is empty after trimming is rejected with the new code `invalid-account`.
- **S3 — Empty entry id.** An entry whose `id` is empty after trimming is rejected with the new code `invalid-entry-id`.
- **S4 — Evidence with no items.** An entry whose bound evidence artifact carries no items is rejected with `missing-evidence`. `registerEvidence` keeps accepting an empty item list (its existing, tested contract): the defect is a journal entry treating an empty artifact as support.
- **S5 — Duplicate evidence item ids.** `registerEvidence` and `acceptEvidence` reject an artifact listing the same item `id` twice, with `INVALID_ITEM`.
- **S6 — Deferred, not fixed here.**
  - *RUC check digit.* `specs/drenyra-ecosystem-cleanup/spec.md` makes checksummed RUC "decision-gated" and says it "MUST NOT be implemented as an in-place public behavior change". The Shell already rejects a wrong check digit before it stores a scope.
  - *Future `capturedAt`.* The kernel reads no clock by design, so verdicts are deterministic for the same input. Rejecting "the future" needs an injected reference instant (`asOf`), which is a design decision.
- **S7 — Additive surface.** The new `JOURNAL_ERROR` codes are additions; no existing code or export changes. Rejected input creates no entry.

## Tasks

- [x] **T1** — RED: journal tests for S1–S4 through `record`; evidence tests for S5 through `acceptEvidence`/`registerEvidence`. *(S1–S5, S7)* — `c8c89b6`
- [x] **T2** — GREEN in `journal/validate.ts`, `journal/types.ts`, and `evidence/authority/authority.ts`. *(S1–S5, S7)* — `c8c89b6`
- [x] **T3** — CHANGELOG, plus a comment on #123 with what closed and what is deferred. *(S6)* — `c8c89b6`
- [x] **T4** — Gates and PR. *(all)* — `c8c89b6`

## Log

### L1 — 2026-10-28 — request (verbatim)

Previous turn: "Mi recomendación es arrancar por #123: es la que más mejora el producto y se mide con un número. ¿Avanzo con eso?" Answer:

> yes te autorizo todo y avanza de forma autonoma

### L2 — 2026-10-28 — evidence and decisions

- `journal/__tests__/journal.test.ts` asserted "accepts the non-negative zero boundary (0n)". The journal spec (archived `fiscal-authority-kernel/specs/journal/spec.md`) does not require it: it was an implementation boundary choice, recorded as "`0n` accepted" in that change's verify report. The sibling engine `close-calculations` already rejects non-positive amounts ("rejects a non-positive amount"). Decision: reverse the journal boundary to positive-only, for one rule across the kernel. The existing test is rewritten to assert the rejection.
- `evidence/authority/__tests__/authority.test.ts` asserts "accepts an empty item list". That stays: an evidence registry may hold an empty artifact. The journal rejects binding one as an entry's support (S4).
- No code in `arkelythex/drenyra-command-center` imports `drenyra-ai/journal` or `drenyra-ai/evidence`, or calls `acceptEvidence` (GitHub code search: 0, 0, 0). In this repository, the only non-test callers of `record` and `registerEvidence` are `journal/` and `evidence/` themselves.

### L3 — 2026-10-28 — verification (`c8c89b6`)

- RED: exactly the 8 new cases failed (zero boundary, blank account ×2, blank id ×2, empty artifact, duplicate ids ×2); the other 40 in the two files passed. GREEN: 48/48.
- Full gates: typecheck and lint exit 0; `bun run test` 112 files / 1500 passed (no other module relied on the old behavior); `verify:package` OK including release integrity; `verify-packed-install` OK; markdownlint 0 issues.
- End to end: Drenyra Shell's `bun run eval:controls`, run in a scratch directory with `drenyra-ai` linked to this build, reports `detection: 23/25 defects rejected (9200 bps)` and `false alarms: 0/3`. The survivors are exactly the two deferred cases (S6). The pinned 0.6.0 baseline is 18/25.
