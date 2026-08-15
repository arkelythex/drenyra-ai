# Authorization and Segregation of Duties Specification

## Purpose

Defines the deterministic, fail-closed authorization decision surface for the SDD-060 Multi-Operator Control Plane: a closed permission vocabulary, per-organization operator roles, a frozen role-to-permission matrix, per-org role assignment built on `tenant-core`'s `ValidatedTenantScope`, a fail-closed `authorize()` decision with typed denial, and an organization-wide segregation-of-duties (SoD) rule over monthly-close steps.

Authority is granted per tenant/organization, NEVER globally (SDD-060 governance amendment: least authority per tenant/org; SoD distinct-identities is a hard acceptance criterion). This slice is a pure library capability: it computes and explains decisions; it does not wire them into the live approval path. Decisions are computed from explicit validated inputs and are independent of Drenyra, Drenyra Pi, Drenyra Engram, commands, and MCP.

## Non-goals

- No wiring into `gates/approval.ts` or `flow/close.ts`; the live monthly-close approval path stays byte-identical.
- No change to monthly-close, missions, candidates, Guardian, or any existing gate.
- No actor plumbing into mission commands; no replacement of the hardcoded close-flow actor.
- No identity provider, operator directory, authentication, or key-to-operator model.
- No per-org policy engine, approval hierarchy, view, or connector.
- No general expression language or dynamically configurable ABAC.
- No command, CLI, MCP, agent, or Command Center surface.
- No capability-matrix promotion; no `tenant-isolation/` export; no frozen `contracts/**` change.
- No ledger, journal, evidence, memory, SUNAT, or connector behavior change.

## Requirements

### Requirement: REQ-AUTH-001 — Closed permission vocabulary

The module MUST expose a finite, closed permission vocabulary whose members are exactly: `close:propose`, `close:approve`, `close:review`, `close:audit-read`, `mission:operate`, and `tenant:admin`. Each permission MUST have a fixed meaning:

- `close:propose` — propose a monthly-close step or artifact.
- `close:approve` — approve a monthly-close step or artifact.
- `close:review` — review a monthly-close step or artifact.
- `close:audit-read` — read-only access to the close audit trail within the assigned scope.
- `mission:operate` — operate a mission within the assigned scope.
- `tenant:admin` — administer operator role assignments within the assigned scope.

Any string outside this vocabulary MUST NOT be coerced, mapped, or treated as a known permission. The vocabulary MUST be frozen; unknown strings never become grants.

#### Scenario: SC-AUTH-001 — Known permissions are recognized

- GIVEN the exported permission vocabulary
- WHEN each of the six defined permission strings is presented
- THEN each is recognized as a member of the closed set

#### Scenario: SC-AUTH-002 — Unknown permission fails closed

- GIVEN a permission string not in the vocabulary, e.g. `"close:delete"` or `"*"`
- WHEN an authorization decision is requested with it
- THEN the decision denies with code `unknown-permission`, and the unknown string is never treated as a grant

### Requirement: REQ-AUTH-002 — Closed organization role vocabulary

The module MUST define exactly four roles — `preparer`, `reviewer`, `approver`, and `admin` — whose meanings are fixed by the frozen role-to-permission matrix (REQ-AUTH-004). A role MUST have authority only within the tenant/org scope to which an identity is assigned. No role, including `admin`, is global, and no role may bypass tenant boundaries or autonomy ceilings.

#### Scenario: SC-AUTH-003 — Only the four defined roles exist

- GIVEN the exported role vocabulary
- WHEN any other role string, e.g. `"superuser"`, is presented
- THEN it is not recognized, and any authorization relying on it fails closed

#### Scenario: SC-AUTH-004 — Admin is not global and cannot bypass

- GIVEN an identity assigned `admin` for org A
- WHEN an authorization decision is requested for org B, or outside any scope
- THEN the decision denies; `admin` confers no global or cross-org authority

### Requirement: REQ-AUTH-003 — Per-org role assignment

Every role assignment MUST bind exactly one explicit identity and a non-empty set of known roles to exactly one `ValidatedTenantScope` (from `tenant-core`). Assignment MUST reject — producing no operator value and a typed failure from the closed denial-code vocabulary — any input that is structurally malformed (code `invalid-assignment`), has an empty or whitespace-only identity (code `invalid-assignment`), has an empty role set (code `invalid-assignment`), contains a role outside the closed set (code `unknown-role`), or lacks or invalidates the tenant scope (code `missing-scope`). A role set MUST behave as a set: duplicate roles MUST NOT multiply or expand grants, and no implied global scope may exist.

#### Scenario: SC-AUTH-005 — Valid assignment is produced

- GIVEN identity `"op-1"`, roles `["preparer"]`, and a valid tenant scope for company A, RUC `20123456789`, period `202603`
- WHEN the assignment is created
- THEN a validated per-org operator value bound to exactly that scope is produced

#### Scenario: SC-AUTH-006 — Empty role set is rejected

- GIVEN identity `"op-1"`, an empty role list, and a valid tenant scope
- WHEN the assignment is attempted
- THEN assignment fails closed with code `invalid-assignment` and no operator value is produced

#### Scenario: SC-AUTH-007 — Unknown role is rejected

- GIVEN identity `"op-1"`, roles `["preparer", "superuser"]`, and a valid tenant scope
- WHEN the assignment is attempted
- THEN assignment fails closed with code `unknown-role` and no operator value is produced

#### Scenario: SC-AUTH-008 — Global assignment is rejected

- GIVEN an assignment input that omits or invalidates the tenant scope, or otherwise implies authority without an org
- WHEN the assignment is attempted
- THEN it fails closed with code `missing-scope`; no global operator value can exist

### Requirement: REQ-AUTH-004 — Frozen role-to-permission matrix

The module MUST expose exactly one immutable role-to-permission matrix as the single source of truth, with this fixed mapping:

| Role | Permissions |
| --- | --- |
| `preparer` | `close:propose`, `mission:operate`, `close:audit-read` |
| `reviewer` | `close:review`, `close:audit-read` |
| `approver` | `close:approve`, `close:audit-read` |
| `admin` | `tenant:admin`, `close:audit-read` |

Authorization MUST consult this matrix and MUST NOT accept grants expanded at runtime or by client configuration. Attempts to modify the matrix MUST fail and MUST NOT change any decision. Material matrix changes are explicit, reviewable changes to this specification.

#### Scenario: SC-AUTH-009 — Each granted pair allows

- GIVEN the frozen matrix
- WHEN every (role, permission) pair listed in the table above is evaluated
- THEN each listed pair is a grant

#### Scenario: SC-AUTH-010 — Each ungranted pair denies

- GIVEN the frozen matrix
- WHEN any (role, permission) pair not listed in the table is evaluated
- THEN the pair is not a grant and no decision may treat it as one (e.g. `preparer` has no `close:approve`, `approver` has no `close:propose`, `admin` has neither `close:approve` nor `close:propose`)

#### Scenario: SC-AUTH-011 — Matrix is immutable

- GIVEN the exported matrix
- WHEN a caller attempts to add, remove, or alter any entry
- THEN the attempt fails and the matrix remains exactly as specified

### Requirement: REQ-AUTH-005 — Fail-closed authorization

The module MUST provide a pure decision function with the illustrative signature `authorize({ identity, permission, scope })` returning `{ allowed: true }` or `{ allowed: false, denial: { code, cause, continuation } }`. A decision is allow ONLY when ALL of the following hold:

- the identity resolves to exactly one valid per-org assignment at exactly the target scope;
- the permission is a member of the closed vocabulary (REQ-AUTH-001);
- at least one assigned role grants the permission per the frozen matrix (REQ-AUTH-004);
- the target scope is a valid `ValidatedTenantScope` equal to the assignment scope;
- any defined ABAC refinement (REQ-AUTH-008) is satisfied.

Everything else MUST deny. Missing identities, unknown permissions, invalid roles, malformed context, absent grants, and scope mismatches MUST NOT receive a permissive default.

#### Scenario: SC-AUTH-012 — Grant allows

- GIVEN identity `"op-1"` assigned `preparer` for scope S and target scope S
- WHEN `authorize` is called with `close:propose`
- THEN the decision allows

#### Scenario: SC-AUTH-013 — Absent grant denies

- GIVEN identity `"op-1"` assigned only `preparer` for scope S and target scope S
- WHEN `authorize` is called with `close:approve`
- THEN the decision denies with code `insufficient-permission`

#### Scenario: SC-AUTH-014 — Multiple roles union their grants

- GIVEN identity `"op-2"` assigned both `preparer` and `approver` for scope S
- WHEN `authorize` is called with `close:propose` and with `close:approve` for scope S
- THEN both decisions allow; SoD remains an independent hard denial (REQ-AUTH-009)

#### Scenario: SC-AUTH-015 — Unknown permission denies

- GIVEN a valid assignment and `permission: "close:delete"`
- WHEN `authorize` is called
- THEN the decision denies with code `unknown-permission`

### Requirement: REQ-AUTH-006 — Typed denial

Every denial MUST carry a typed code from a closed vocabulary, a safe cause, and an actionable continuation. The closed denial-code vocabulary is exactly:

| Code | Meaning | Continuation intent |
| --- | --- | --- |
| `unknown-identity` | identity does not resolve to a valid assignment at the target scope | assign the identity a role for the target org, or use an identity assigned to it |
| `unknown-permission` | permission not in the closed vocabulary | use a permission from the vocabulary |
| `unknown-role` | role not in the closed role set | use one of the four defined roles |
| `invalid-assignment` | assignment input structurally invalid (empty/whitespace identity, empty role set) | provide a non-empty identity and role set |
| `missing-scope` | target scope absent or invalid | provide a valid `ValidatedTenantScope` |
| `scope-mismatch` | assignment scope differs from target scope | run the decision with matching assignment and target scope |
| `insufficient-permission` | no assigned role grants the permission | request an assignment that grants the permission in the org |
| `malformed-context` | context structurally invalid | provide a well-formed context |
| `sod-violation` | proposer appears among approvers of the same close step | choose an approver who did not propose the step |
| `sod-invalid-input` | segregation input malformed | provide non-empty string IDs and a well-formed approver list |

The `sod-*` codes belong to the segregation denial vocabulary; authorization and segregation denials MUST be distinguishable by their code sets. Denial causes MUST be safe: they MUST NOT reveal whether an identity holds assignments in other organizations. Continuations MUST be deterministic and actionable, suitable for deterministic callers and tests.

#### Scenario: SC-AUTH-016 — Denial is typed and actionable

- GIVEN `authorize` denies an `insufficient-permission` case
- WHEN the denial is inspected
- THEN it carries the exact code `insufficient-permission`, a safe cause naming no other org, and a continuation describing the next step

#### Scenario: SC-AUTH-017 — Cross-org denial leaks nothing

- GIVEN identity `"op-1"` assigned for org A and a request targeted at org B
- WHEN the decision is made
- THEN it denies, and the denial is identical whether `"op-1"` also holds an assignment in some other org or nowhere else

### Requirement: REQ-AUTH-007 — Least authority and isolation

An assignment for organization A MUST NOT authorize any action for organization B, and no role, permission, or operator authority MAY be global. Cross-org role lookup MUST fail closed: an identity is only as authoritative as its assignment at the exact target scope.

#### Scenario: SC-AUTH-018 — Org A operator denied for org B

- GIVEN identity `"op-1"` assigned `preparer` for scope A
- WHEN `authorize` is called with `close:propose` and target scope B, where A and B differ
- THEN the decision denies with `scope-mismatch` and grants nothing in B

#### Scenario: SC-AUTH-019 — Same identity, different org, different authority

- GIVEN identity `"op-1"` assigned `preparer` for scope A and `approver` for scope B
- WHEN `authorize` is called with `close:approve` for scope A and with `close:approve` for scope B
- THEN the scope-A decision denies and the scope-B decision allows

### Requirement: REQ-AUTH-008 — Minimal ABAC refinement

The decision context MUST identify the target organization as a `ValidatedTenantScope` and MAY include a materiality attribute. Attributes MUST only restrict or select an already-defined grant; they MUST NEVER create or widen permission. This slice defines no materiality-based restriction: materiality, when present, MUST NOT create or widen a grant and MUST NOT change any decision outcome in this slice. Any future attribute rule MUST only tighten authority.

#### Scenario: SC-AUTH-020 — Materiality never invents permission

- GIVEN identity `"op-1"` assigned `approver` for scope S (no `close:propose`)
- WHEN `authorize` is called with `close:propose` and any materiality attribute for scope S
- THEN the decision still denies with `insufficient-permission`; no attribute creates a grant

#### Scenario: SC-AUTH-021 — Materiality is inert in this slice

- GIVEN identity `"op-1"` assigned `approver` for scope S
- WHEN `authorize` is called with `close:approve` for scope S, once with and once without a materiality attribute
- THEN both decisions allow identically

### Requirement: REQ-AUTH-009 — Segregation of duties

The module MUST provide a pure function with the illustrative signature `assertSegregation({ closeStepId, proposerId, approverIds })` whose semantics for one monthly-close step or artifact are: no single identity may be both proposer and approver. The function MUST return an allowed result when the proposer is not among the approvers, and MUST deny with code `sod-violation` when the proposer appears among the approvers, using plain string equality. The approver list MUST behave as a set for overlap purposes: duplicates MUST NOT create additional identities. An empty `approverIds` list MUST be well-formed and MUST allow, because no overlap is possible and approver counting is R3's invariant (REQ-AUTH-011). The function MUST be pure: it MUST NOT mutate workflow state and MUST NOT depend on I/O, clock, or network.

#### Scenario: SC-AUTH-022 — Distinct proposer and approvers allow

- GIVEN `closeStepId: "step-1"`, `proposerId: "op-1"`, `approverIds: ["op-2", "op-3"]`
- WHEN `assertSegregation` is called
- THEN the result allows

#### Scenario: SC-AUTH-023 — Proposer among approvers denies

- GIVEN `closeStepId: "step-1"`, `proposerId: "op-1"`, `approverIds: ["op-2", "op-1"]`
- WHEN `assertSegregation` is called
- THEN the result denies with code `sod-violation`

#### Scenario: SC-AUTH-024 — Empty approver set allows

- GIVEN `closeStepId: "step-1"`, `proposerId: "op-1"`, `approverIds: []`
- WHEN `assertSegregation` is called
- THEN the result allows (no overlap; R3 counting is a separate invariant)

#### Scenario: SC-AUTH-025 — Malformed input denies with the segregation type

- GIVEN a call with a missing or non-string `closeStepId`, a missing or non-string `proposerId`, or `approverIds` that is not a list of non-empty strings
- WHEN `assertSegregation` is called
- THEN the result denies with code `sod-invalid-input`, never with an authorization denial

### Requirement: REQ-AUTH-010 — Input-agnostic identity IDs

The segregation API MUST accept explicit plain string IDs for `closeStepId`, `proposerId`, and each `approverId`, and MUST NOT depend on an identity provider, receipt signer, mission command, or close-flow actor. String equality MUST be the sole overlap criterion.

#### Scenario: SC-AUTH-026 — Plain string IDs work without identity plumbing

- GIVEN `proposerId: "op-1"` and `approverIds: ["op-1"]` supplied as plain strings with no identity provider or actor model present
- WHEN `assertSegregation` is called
- THEN the overlap is detected by string equality and the result denies with `sod-violation`

### Requirement: REQ-AUTH-011 — R3 compatibility

Segregation MUST preserve, and MUST NOT redefine or weaken, the hard requirement for two distinct R3 approvers (the `distinctApprovers` invariant in `gates/approval.ts`). SoD is an independent overlap invariant: it MUST NOT be implemented as merely counting approvers, and this slice MUST NOT alter `distinctApprovers` or any existing gate.

#### Scenario: SC-AUTH-027 — SoD allows while R3 still counts separately

- GIVEN `proposerId: "op-1"` and `approverIds: ["op-2", "op-3"]` for an R3 step
- WHEN `assertSegregation` allows and the R3 dual-approval invariant is applied
- THEN both hold: the two distinct approvers satisfy R3 and neither equals the proposer

#### Scenario: SC-AUTH-028 — SoD is not approver counting

- GIVEN `proposerId: "op-1"` and `approverIds: ["op-2"]` (one distinct approver)
- WHEN `assertSegregation` is called
- THEN SoD allows (no overlap), while R3 still requires a second distinct approver; SoD alone never substitutes for R3

### Requirement: REQ-AUTH-012 — Public export

The package MUST expose the supported authorization and segregation surface through the `./authorization` package subpath, and consumers MUST NOT need internal-file imports. The export MUST NOT widen unrelated APIs or change existing exports.

#### Scenario: SC-AUTH-029 — Subpath export smoke

- GIVEN a consumer importing from `./authorization`
- WHEN the module is loaded
- THEN the permission vocabulary, role vocabulary, frozen matrix, assignment, `authorize`, and `assertSegregation` are all reachable through the subpath

#### Scenario: SC-AUTH-030 — No unrelated surface widens

- GIVEN the pre-change package exports
- WHEN this slice's exports are added
- THEN no existing export changes and no unrelated module gains new exports

### Requirement: REQ-AUTH-013 — Unit verification

Tests MUST cover the role-to-permission matrix over roles × organizations × capabilities, per-org assignment and cross-org isolation, fail-closed denials with typed codes, SoD identity scenarios including the empty-approver and malformed-input edges, and determinism. This slice MUST NOT wire authorization or SoD into `gates/approval.ts`, `flow/close.ts`, `cmd/`, or `mcp/`; the live approval path MUST remain unchanged.

#### Scenario: SC-AUTH-031 — Matrix and decisions are regression-proven

- GIVEN the authorization test suite
- WHEN it runs under `bun run test`
- THEN every (role, permission) pair, cross-org denial, typed denial, SoD scenario, and isolation case passes

#### Scenario: SC-AUTH-032 — Live approval path unchanged

- GIVEN the existing approval and close flows
- WHEN this slice is added and the full suite runs
- THEN `gates/approval.ts` and `flow/close.ts` behavior is unchanged and the full suite remains green

### Requirement: REQ-AUTH-014 — English technical surface

Public identifiers, denial codes, denial causes, continuations, documentation, and tests introduced by this slice MUST use English.

#### Scenario: SC-AUTH-033 — Surface is English

- GIVEN the exported surface and its tests
- WHEN every public identifier, denial code, cause, continuation, doc string, and test name is inspected
- THEN all are in English

### Requirement: REQ-AUTH-015 — Deterministic and side-effect-free

Authorization and segregation MUST be pure and deterministic: equal inputs MUST produce equal decisions, including identical denial code, cause, and continuation, across repeated evaluations. The role-to-permission matrix and role-assignment inputs MUST be immutable/frozen. The module MUST NOT perform I/O, read the clock, or access a network.

#### Scenario: SC-AUTH-034 — Equal inputs yield equal decisions

- GIVEN a fixed operator, permission, and scope
- WHEN `authorize` is evaluated twice
- THEN both decisions are identical, including the denial code, cause, and continuation when denied

#### Scenario: SC-AUTH-035 — No external state is consulted

- GIVEN repeated `authorize` and `assertSegregation` calls
- WHEN the environment or clock would otherwise vary
- THEN decisions do not change, and no I/O, clock, or network access occurs
