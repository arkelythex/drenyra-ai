# SDD-060 — Authorization and Segregation of Duties: Tasks

## Scope recap

Add a pure, additive `authorization/` library module implementing closed RBAC
vocabularies, a frozen role-to-permission matrix, per-org role assignment,
fail-closed `authorize()` with typed denial, and a same-close-step segregation
(SoD) decision. No live consumer in this slice.

**Non-goals (do NOT do):** wire into `gates/approval.ts` or `flow/close.ts`;
change any existing gate/flow/command/MCP/agent/contract/tenant/projection
file; add an identity provider, actor model, or authorization endpoint.

**Deliverables:** `authorization/{types,roles,authorize,segregation,index}.ts`,
5 test files under `authorization/__tests__/`, a `./authorization` package
subpath export in `package.json`, and a root `index.ts` barrel re-export.

## Delivery shape

Single PR with a documented size exception (~820 authored lines), per the
program's standing precedent (prior exceptions at 425/588/1043, user-approved
continuation). Strict TDD is active (`bun run test`, `bun run typecheck`,
`bun run build`).

**Split fallback (only if the single PR is rejected at review):**

- PR 1 — module + types + export scaffolding (~313 lines): `types.ts`,
  `roles.ts`, `package.json` subpath, root barrel, `exports.test.ts`.
- PR 2 — decisions + tests (~510 lines): `authorize.ts`, `segregation.ts`,
  `roles/authorize/isolation/segregation` tests.

Each unit below is independently reviewable within the unit boundary; the split
only changes packaging boundaries, never task content.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~820 (impl ~305, tests ~510, exports ~8) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | single PR (documented size exception) |
| Delivery strategy | exception-ok |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High
```

---

## Phase 0 — Preflight

- [x] Confirm a clean working tree and that baseline tests pass:
      `bun run test` green (1044/1044 at `757cf97`) before any edit.
      <!-- sdd-owner: implementation -->
- [x] Confirm `bun run typecheck` and `bun run build` are green on the baseline.
      <!-- sdd-owner: implementation -->

## Phase 1 — RED/GREEN units (strict TDD)

Strict TDD: for each unit, write the RED test first and confirm it fails for the
intended reason, then add the smallest GREEN implementation, then TRIANGULATE
and REFACTOR only while green.

### T-AUTH-001 — Closed types + role vocabulary + frozen matrix

Files: `authorization/types.ts`, `authorization/roles.ts`,
`authorization/__tests__/roles.test.ts`.

- RED: table-drive all 24 role × permission pairs (9 grants, 15 denials — normative REQ-AUTH-004; corrected from draft 10/14) with
  an exhaustive `satisfies`; assert exactly six `PERMISSIONS`, exactly four
  `ROLES`, and that `admin` holds no proposal/approval grant.
- GREEN: define `PERMISSIONS`, `ROLES`, `Role`, `Permission`, `Identity`,
  denial-code unions, and frozen `ROLE_PERMISSIONS`; implement
  `permissionsForRole()` returning a fresh frozen array.
- TRIANGULATE: cover `unknown-role` / non-role strings and wildcard
  `"*"` handling; confirm unknown strings never become grants.
- REFACTOR: keep vocabulary arrays frozen and matrix `satisfies` exhaustive.
- Covers REQ-AUTH-001/002/004/013 and SC-AUTH-001/002/003/009/010/011/031.
      <!-- sdd-owner: implementation -->

### T-AUTH-002 — assignRoles construction boundary

Files: `authorization/authorize.ts`, `authorization/__tests__/authorize.test.ts`.

- RED: valid assignment returns one frozen per-org value; reject empty /
  whitespace identity, empty role set, unknown role, and omitted/forged/global
  scope each with the exact typed error and no partial operator value.
- GREEN: `assignRoles()` revalidates scope via `validateTenantScope()` (maps to
  `missing-scope`), rejects empty/whitespace identity and empty roles
  (`invalid-assignment`), rejects unknown role (`unknown-role`), throws
  `AuthorizationInputError` (may retain `TenantScopeError` as internal cause);
  deduplicates roles preserving first-seen order; freezes scope copy, roles,
  and assignment.
- TRIANGULATE: role-set duplicate behavior (no grant multiplication), global /
  scope-less input `missing-scope`.
- REFACTOR: keep `assignRoles` as the only construction throw boundary (D3).
- Covers REQ-AUTH-003/004 and SC-AUTH-005/006/007/008.
      <!-- sdd-owner: implementation -->

### T-AUTH-003 — authorize() decisions and typed denial

Files: `authorization/authorize.ts`, `authorization/__tests__/authorize.test.ts`.

- RED: grant allows; absent grant denies `insufficient-permission`; multiple
  roles union matrix grants; unknown permission denies `unknown-permission`;
  unknown role / malformed context / missing identity / missing scope deny with
  their exact codes; inert and invalid `materiality` are covered; denials
  repeat byte-identically.
- GREEN: implement `authorize()` following D5's deterministic lookup order;
  validate request and assignments, reject unknown permission, resolve exactly
  one exact-scope assignment (`unknown-identity` / `scope-mismatch` /
  `malformed-context`), evaluate the matrix, treat `materiality` as inert but
  reject out-of-vocabulary values as `malformed-context`; return frozen
  decisions with the validated scope in an allow.
- TRIANGULATE: full ten-code set; each denial carries the exact `code`, safe
  `cause` naming no other org, and deterministic `continuation`.
- REFACTOR: deny precedence is stable; denial tables are frozen English
  constants with no interpolated identity/role/permission/tenant values.
- Covers REQ-AUTH-005/006/008/010/014/015 and SC-AUTH-012/013/014/015/016/017/
  020/021/026/033/034/035.
      <!-- sdd-owner: implementation -->

### T-AUTH-004 — Isolation and least authority

Files: `authorization/__tests__/isolation.test.ts`.

- RED: same identity different roles in org A/B — org-A decision denies and
  org-B allows; exact canonical scope equality; org-A operator denied for org-B
  with `scope-mismatch`; `admin` denied cross-org; duplicate same-identity /
  same-scope assignment records deny `malformed-context`; cross-org denials
  reveal no tenant/role/count detail.
- GREEN: `authorize()` already validates supplied assignments and compares scope
  via `sameTenantScope()` / canonical `tenantScopeKey()` equality (D5); add
  tests that pass against it.
- TRIANGULATE: same identity assigned in an unrelated org does not change the
  outcome for a known identity; denial identical whether the identity holds an
  extra assignment or none (SC-AUTH-017).
- Covers REQ-AUTH-007 and SC-AUTH-004/017/018/019.
      <!-- sdd-owner: implementation -->

### T-AUTH-005 — Segregation of duties

Files: `authorization/segregation.ts`, `authorization/__tests__/segregation.test.ts`.

- RED: distinct proposer/approvers allow; proposer among approvers denies
  `sod-violation`; duplicate approvers are set-like; empty `approverIds` allows;
  malformed IDs/list deny `sod-invalid-input` (never an authorization denial);
  one distinct approver still passes SoD because R3 counting is separate;
  decisions repeat.
- GREEN: implement pure `assertSegregation()` (D9) validating non-empty
  `closeStepId`, non-empty `proposerId`, non-empty-string approver array,
  building a local `Set` for overlap without mutating the caller's array;
  empty approvers allow vacuously; return frozen decisions.
- TRIANGULATE: string-only overlap; no identity provider / actor model present.
- REFACTOR: keep SoD independent of R3's `distinctApprovers` (D9, D10).
- Covers REQ-AUTH-009/010/011/015 and SC-AUTH-022/023/024/025/027/028.
      <!-- sdd-owner: implementation -->

### T-AUTH-006 — Immutability and mutation isolation

Files: `authorization/__tests__/roles.test.ts`, `authorization/__tests__/authorize.test.ts`.

- RED: mutation attempts cannot alter vocabularies, matrix, assignments,
  decisions, or later results; `permissionsForRole()` returns distinct frozen
  arrays; supplied assignment inputs stay unchanged after `authorize()`.
- GREEN: relies on `Object.freeze` (D8) and fresh frozen accessor copies; add
  tests asserting runtime immutability.
- Covers REQ-AUTH-004/013/015 and SC-AUTH-011/031/034/035.
      <!-- sdd-owner: implementation -->

### T-AUTH-007 — Exports and no-wiring smoke

Files: `authorization/index.ts`, `package.json`, `index.ts`,
`authorization/__tests__/exports.test.ts`.

- RED: importing from `./authorization` exposes the permission/role
  vocabularies, frozen matrix, `assignRoles`, `authorize`,
  `assertSegregation`, `AuthorizationInputError`, and public types; root barrel
  re-exports them; no private helpers leak; existing package subpaths unchanged.
- GREEN: add narrow `authorization/index.ts` barrel, `./authorization` subpath
  in `package.json`, and `export * from "./authorization/index.js"` in root
  `index.ts`; write smoke test.
- TRIANGULATE: confirm `gates/approval.ts` and `flow/close.ts` remain
  byte-identical and are not imported (no-wiring regression evidence).
- Covers REQ-AUTH-012/013/014 and SC-AUTH-029/030/032.
      <!-- sdd-owner: implementation -->

## Phase 2 — Gates

- [x] Run `bun run typecheck` — clean.
      <!-- sdd-owner: implementation -->
- [x] Run focused tests: `bun run test authorization` — all new units green.
      <!-- sdd-owner: implementation -->
- [x] Run full `bun run test` — no regressions; existing gate/close tests pass
      (no-wiring proof, SC-AUTH-032).
      <!-- sdd-owner: implementation -->
- [x] Run `bun run build` — clean; packed/install verification per repo scripts.
      <!-- sdd-owner: implementation -->

## Phase 3 — Close

- [x] Update the change record (state) to `implemented`; record delivery as
      single PR with documented size exception.
      <!-- sdd-owner: implementation -->
- [x] Orchestrator: commit the change and open the single PR with the size
      exception noted in the description.
      <!-- sdd-owner: parent -->
- [x] Start or reuse bounded review of the resulting candidate.
      <!-- sdd-owner: parent -->

---

## Acceptance mapping (REQ-AUTH-001..015)

| Requirement | Covered by |
| --- | --- |
| REQ-AUTH-001 closed permission vocabulary | T-AUTH-001 |
| REQ-AUTH-002 closed role vocabulary | T-AUTH-001 |
| REQ-AUTH-003 per-org role assignment | T-AUTH-002 |
| REQ-AUTH-004 frozen role-to-permission matrix | T-AUTH-001, T-AUTH-002 |
| REQ-AUTH-005 fail-closed authorization | T-AUTH-003 |
| REQ-AUTH-006 typed denial | T-AUTH-003 |
| REQ-AUTH-007 least authority and isolation | T-AUTH-004 |
| REQ-AUTH-008 minimal ABAC refinement | T-AUTH-003 |
| REQ-AUTH-009 segregation of duties | T-AUTH-005 |
| REQ-AUTH-010 input-agnostic identity IDs | T-AUTH-003, T-AUTH-005 |
| REQ-AUTH-011 R3 compatibility | T-AUTH-005 |
| REQ-AUTH-012 public export | T-AUTH-007 |
| REQ-AUTH-013 unit verification | T-AUTH-001..T-AUTH-007 |
| REQ-AUTH-014 English technical surface | T-AUTH-003..T-AUTH-007 (assert English) |
| REQ-AUTH-015 deterministic and side-effect-free | T-AUTH-003, T-AUTH-005, T-AUTH-006 |

Verification gate: every acceptance criterion above passes under `bun run test`
with `gates/approval.ts` and `flow/close.ts` byte-identical.
