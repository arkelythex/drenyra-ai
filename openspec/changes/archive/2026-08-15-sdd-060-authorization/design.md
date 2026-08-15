# Design — SDD-060 Authorization and Segregation of Duties

## Overview

This change adds a pure `authorization/` library module containing tenant-scoped RBAC,
a minimal non-authorizing ABAC context, and a same-close-step segregation-of-duties
(SoD) decision. It is additive and has no runtime consumer in this slice.

The module follows the repository layer direction:

`contracts/ -> library modules -> agents/ -> cmd/`

`authorization/` is a library module. It imports only tenant scope primitives from
`tenant-core/` and the `Materiality` type from `candidates/`. It performs no I/O and
has no dependency on agents, commands, MCP, Drenyra, Drenyra Pi, or Drenyra Engram.
No contract file changes. No `node:crypto` operation is needed; therefore this module
stays within the library's “node:crypto only” dependency ceiling without importing it.

No money is represented by this module. The BigInt-cents convention is therefore not
applicable. No version or sequence fields are introduced.

## Decisions

### D1 — Use a file-per-concern module with a narrow barrel

The module is split into public types, closed vocabularies and matrix, assignment and
authorization evaluation, and segregation evaluation. This mirrors `projection/`'s
`types.ts` + concern implementation + `index.ts` convention while keeping the role
matrix independent from decision orchestration.

Rationale: the matrix is a reviewable authority source, while assignment validation,
authorization lookup, and SoD have different invariants and test tables. Combining
these concerns would make authority changes harder to inspect.

### D2 — Plain strings identify operators

`Identity` is an alias for `string`; it is not branded and is not connected to keys,
receipts, actors, or an identity provider. Identity equality and SoD overlap use exact
JavaScript string equality after validation. Values are not trimmed into a different
identity: whitespace at either end remains part of a non-empty identity.
Whitespace-only values are invalid.

Rationale: the repository has no canonical operator identity. Normalizing IDs would
invent identity equivalence not authorized by the specification.

### D3 — Assignment construction throws; decisions deny

`assignRoles()` is a construction boundary. It either returns one frozen valid
`RoleAssignment` or throws `AuthorizationInputError` with an assignment-related code.
It never returns a partial assignment.

`authorize()` and `assertSegregation()` are decision boundaries. They never throw for
caller-shaped malformed or unknown values; they return a frozen typed denial. This is
required for deterministic, fail-closed evaluation and specifically preserves
SC-AUTH-025 (`sod-invalid-input`). Unexpected internal exceptions are not converted
into allows.

Rationale: invalid object construction is a programmer/boundary error, while denied
authority and untrusted decision context are expected business outcomes. This follows
`TenantScopeError` for validated construction and projection's typed result pattern.

### D4 — Assignments are explicit immutable inputs

`authorize()` receives `readonly RoleAssignment[]` in its input. There is no global
registry, singleton, environment lookup, or callback. `assignRoles()` freezes the
scope copy, deduplicated role array, and assignment object. `authorize()` treats its
input as read-only and never caches or mutates it.

Rationale: explicit inputs make the function pure, deterministic, testable, and
incapable of silently introducing global authority.

### D5 — Scope matching uses canonical tenant equality

Every assignment scope is revalidated through `validateTenantScope()` during
construction. Authorization validates the target and defensively validates supplied
assignments, then compares scope with `sameTenantScope()` (equivalent to canonical
`tenantScopeKey()` equality). Object identity is never used.

Lookup order is deterministic:

1. validate request shape and target scope;
2. reject an unknown permission;
3. validate the complete assignment collection;
4. find assignments with exact identity equality;
5. if none exist, deny `unknown-identity`;
6. if the identity exists but has no exact target-scope assignment, deny
   `scope-mismatch` with no foreign scope details;
7. if more than one assignment exists for the identity at the same scope, deny
   `malformed-context` rather than unioning ambiguous records;
8. evaluate the one exact-scope assignment against the matrix.

Rationale: REQ-AUTH-005 requires exactly one assignment at the target scope. The
scope-mismatch denial reveals no company, RUC, period, role, or count. Extra
assignments in unrelated organizations do not change the result for a known identity
whose supplied assignment mismatches the target.

### D6 — Multiple roles union only matrix grants

One assignment may contain multiple roles. Duplicate role names are removed while
preserving first-seen order. A permission is granted when at least one assigned role
contains it in the frozen matrix. Roles do not imply other roles, and `admin` has no
proposal or approval grant.

Rationale: this implements SC-AUTH-014 without creating hierarchy or bypass semantics.
SoD remains a separate decision and can deny independently of an RBAC grant.

### D7 — Materiality is inert and cannot grant

`AuthorizationInput.materiality` is optional and typed as the existing `Materiality`.
Known values do not alter the decision in this slice. A supplied runtime value outside
the closed materiality vocabulary denies `malformed-context`; it is never ignored as
an opportunity to grant.

Rationale: this preserves a minimal ABAC-shaped context without duplicating the
canonical materiality type or inventing an unfinished policy. Future ABAC rules may
only tighten a matrix grant.

### D8 — Closed constants and returned values are frozen

Vocabulary arrays, matrix entries, matrix object, assignments, denial objects, and
decision objects are frozen with `Object.freeze`. The implementation owns canonical
arrays and exposes no mutable internal alias. `permissionsForRole()` returns a newly
allocated frozen array on every valid read.

Rationale: TypeScript `readonly` is compile-time only. Runtime freezing plus fresh
copies prevents callers from changing later decisions through casts or aliases.

### D9 — SoD is overlap only, not approver counting

`assertSegregation()` validates a non-empty `closeStepId`, non-empty `proposerId`, and
an array containing only non-empty string approver IDs. It builds a local `Set` for
overlap, without mutating the caller's array. Duplicate approvers collapse naturally.
An empty approver array allows vacuously. Exact proposer membership denies.

Rationale: this matches the input-agnostic `distinctApprovers` precedent while
remaining independent of R3's separate requirement for two distinct approvers.

### D10 — No live wiring

This change does not modify or import from `gates/approval.ts` or `flow/close.ts` and
does not alter mission commands. Existing R3 and hardcoded close actor behavior stay
unchanged. Integration requires a later identity-plumbing proposal.

## Module layout and file map

```text
authorization/
  types.ts                         Public closed types, denials, error, inputs/results
  roles.ts                         Vocabularies, matrix, guards, permissionsForRole
  authorize.ts                     assignRoles and authorize
  segregation.ts                   assertSegregation
  index.ts                         Narrow public barrel
  __tests__/
    roles.test.ts                  Vocabulary and 24-pair matrix table
    authorize.test.ts              Construction, decisions, ABAC, determinism
    isolation.test.ts              Exact-scope and same-identity cross-org behavior
    segregation.test.ts            SoD table and malformed inputs
    exports.test.ts                Subpath/root smoke and no internal imports
package.json                       Add only `./authorization`
index.ts                           Re-export only `authorization/index.js`
```

No existing gate, flow, command, MCP, contract, agent, tenant, or projection file is
changed.

## Type definitions and function signatures

Illustrative public TypeScript; implementations MUST retain these shapes and closed
sets while validating unsafe JavaScript or cast values at runtime.

```ts
import type { Materiality } from "../candidates/index.js";
import type { ValidatedTenantScope } from "../tenant-core/index.js";

export const PERMISSIONS = ["close:propose", "close:approve", "close:review",
  "close:audit-read", "mission:operate", "tenant:admin"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const ROLES = ["preparer", "reviewer", "approver", "admin"] as const;
export type Role = (typeof ROLES)[number];
export type Identity = string;

export interface RoleAssignment {
  readonly identity: Identity;
  readonly scope: ValidatedTenantScope;
  readonly roles: readonly Role[];
}
export type RoleAssignmentInput = RoleAssignment;

export type AuthorizationDenialCode =
  | "unknown-identity" | "unknown-permission" | "unknown-role"
  | "invalid-assignment" | "missing-scope" | "scope-mismatch"
  | "insufficient-permission" | "malformed-context"
  | "sod-violation" | "sod-invalid-input";
export type AssignmentErrorCode = Extract<AuthorizationDenialCode,
  "unknown-role" | "invalid-assignment" | "missing-scope">;
export type RbacDenialCode = Exclude<AuthorizationDenialCode,
  "sod-violation" | "sod-invalid-input">;
export type SegregationDenialCode = Extract<AuthorizationDenialCode,
  "sod-violation" | "sod-invalid-input">;

export interface Denial<C extends AuthorizationDenialCode> {
  readonly code: C;
  readonly cause: string;
  readonly continuation: string;
}
export interface AuthorizationInput {
  readonly assignments: readonly RoleAssignment[];
  readonly identity: Identity;
  readonly permission: Permission;
  readonly scope: ValidatedTenantScope;
  readonly materiality?: Materiality;
}
export type AuthorizationDecision =
  | { readonly allowed: true; readonly scope: ValidatedTenantScope }
  | { readonly allowed: false; readonly denial: Denial<RbacDenialCode> };
export interface SegregationInput {
  readonly closeStepId: string;
  readonly proposerId: Identity;
  readonly approverIds: readonly Identity[];
}
export type SegregationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly denial: Denial<SegregationDenialCode> };
export class AuthorizationInputError extends Error {
  readonly code: AssignmentErrorCode;
}

export function assignRoles(input: RoleAssignmentInput): RoleAssignment;
export function authorize(input: AuthorizationInput): AuthorizationDecision;
export function assertSegregation(input: SegregationInput): SegregationDecision;
export function permissionsForRole(role: Role): readonly Permission[];
```

The ten-code union is exact; subsets prevent RBAC/SoD code mixing. Causes and
continuations come from private frozen English constants and interpolate no identity,
role, permission, or tenant value. Unknown runtime strings are denied.

`assignRoles()` throws `AuthorizationInputError`: tenant validation maps to
`missing-scope`, empty identity/roles to `invalid-assignment`, and an unknown role to
`unknown-role`. It may retain `TenantScopeError` as an internal `cause`, without tenant
values in its public message. The two decision functions do not throw for malformed
request values. Authorization includes the validated target scope in an allow so the
grant cannot be detached from scope.

## Fail-closed denial mechanics

Denial precedence is stable so equal inputs produce byte-equivalent data:

- authorization: malformed request or assignment collection -> relevant
  `missing-scope`, `unknown-role`, `invalid-assignment`, or `malformed-context`;
  unknown permission -> `unknown-permission`; no identity -> `unknown-identity`;
  identity only outside target -> `scope-mismatch`; no matrix grant ->
  `insufficient-permission`;
- segregation: malformed shape/value -> `sod-invalid-input`; proposer overlap ->
  `sod-violation`; otherwise allow.

Every branch returns a newly created frozen decision whose values come from frozen
constant tables. No permissive default exists. No denial reports foreign assignment
scope, foreign roles, assignment counts, or whether a matching identity exists in a
repository not supplied to the call.

## Role matrix and immutability

```ts
export const ROLE_PERMISSIONS = Object.freeze({
  preparer: Object.freeze([
    "close:propose", "mission:operate", "close:audit-read",
  ]),
  reviewer: Object.freeze(["close:review", "close:audit-read"]),
  approver: Object.freeze(["close:approve", "close:audit-read"]),
  admin: Object.freeze(["tenant:admin", "close:audit-read"]),
} as const satisfies Record<Role, readonly Permission[]>);
```

Adding a role without a matrix entry fails typecheck. Adding a permission to a role is
an explicit source change and matrix-test change. `permissionsForRole()` validates the
role and returns `Object.freeze([...ROLE_PERMISSIONS[role]])`; authorization similarly
reads without returning the canonical array. There is no runtime grant parameter and
no wildcard interpretation.

## Export plan

`authorization/index.ts` exports only:

- `PERMISSIONS`, `ROLES`, `ROLE_PERMISSIONS`;
- `permissionsForRole`, `assignRoles`, `authorize`, `assertSegregation`;
- `AuthorizationInputError`;
- the public types shown above.

`package.json` adds exactly:

```json
"./authorization": "./dist/authorization/index.js"
```

The root `index.ts` adds exactly:

```ts
export * from "./authorization/index.js";
```

Internal guard functions and denial-detail tables remain private. Existing exports
are unchanged; only the intended authorization surface is added.

## Test plan and TDD order

Strict TDD is active. Every numbered slice starts RED, adds the smallest GREEN
implementation, and refactors only while green.

1. **Vocabularies/matrix:** exact six permissions and four roles; table-drive all 24
   role × permission pairs (10 grants, 14 denials); prove admin is administrative-only
   and `satisfies` is exhaustive.
2. **Assignment:** valid frozen construction and duplicate-role set behavior; reject
   empty/whitespace identity, empty roles, unknown roles, and omitted/malformed/forged
   or global scope with the exact typed error and no partial value.
3. **Authorization:** cover all role/permission decisions, multiple-role union, unknown
   permission/role, malformed context, missing identity/scope, insufficient grant,
   inert/invalid materiality, denial precedence, and repeated-result equality.
4. **Isolation:** same identity with different roles in org A/B; exact canonical scope;
   A denied in B; admin denied cross-org; duplicate same-identity/scope records denied;
   no tenant or role detail in cross-org denials.
5. **Immutability:** mutation attempts cannot alter vocabularies, matrix, assignments,
   decisions, or later results; accessor reads are distinct frozen arrays; inputs stay
   unchanged.
6. **SoD:** distinct IDs allow; proposer overlap denies; duplicates are set-like; empty
   approvers allow; malformed IDs/list deny `sod-invalid-input`; decisions repeat; one
   approver still passes SoD because R3 counting is separate.
7. **Exports:** smoke-test the subpath and root barrel, absence of private helpers, and
   unchanged existing package subpaths.
8. Run `bun run typecheck`, focused tests, `bun run test`, and `bun run build`; existing
   gate/close tests provide no-wiring regression evidence.

## Honest changed-line estimate

The expected authored delta remains approximately **820 lines**:

- implementation: about **305** lines;
- tests: about **510** lines;
- package and root exports: about **8** lines.

This exceeds the 300-line session budget and 400-line review-unit threshold. The
design does not reduce required tests to fit an artificial budget. Selection between
a documented single-PR size exception and a chained split is a tasks-phase delivery
decision, not an architecture decision.

## Open risks

1. **Identity (medium):** plain IDs are intentional; live enforcement awaits
   authenticated operator identity plumbing.
2. **Enforcement claims (medium):** this is only a decision primitive; close flow is not
   protected in this slice.
3. **Forged inputs (medium):** runtime validation remains mandatory despite TS types.
4. **Escalation (medium):** matrix changes require spec/type/table updates; runtime
   policy injection stays prohibited.
5. **Review size (high):** tasks must select an explicit delivery treatment.
6. **Future ABAC (low):** any materiality rule may only remove an existing grant.

No normative design conflict remains unresolved. The specification's assignment
“typed failure” is implemented as a typed thrown construction error, while its
decision scenarios remain typed denial results. SoD malformed-input denial takes
precedence over the general construction-error convention because SC-AUTH-025 is
explicit.
