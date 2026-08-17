# Contributing to Drenyra AI

Thank you for your interest in contributing to **Drenyra AI** — the verifiable accounting agent ecosystem (RDA core, frozen contracts, missions, gates, receipts, and ledger).

> [!IMPORTANT]
> **Fiscal correctness is a product safety requirement.** This repository processes fiscal operations. Never break receipts, ledger integrity, gates, or audit trails — and never use floats for money. Monetary values are whole-number cents (BigInt); version and sequence numbers are JSON integers, never floats.

Before you dive in, read this guide fully. We have a structured workflow to keep the project — and its fiscal guarantees — organized and maintainable.

---

## Table of Contents

- [Issue-First Workflow](#issue-first-workflow)
- [Looking for Something to Work On](#looking-for-something-to-work-on)
- [AI-Assisted Contributions](#ai-assisted-contributions)
- [Ground Rules](#ground-rules)
- [Label System](#label-system)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Commit Convention](#commit-convention)
- [Branch Naming](#branch-naming)
- [Pull Request Rules](#pull-request-rules)
- [Contract Changes](#contract-changes)
- [Code of Conduct](#code-of-conduct)
- [Questions?](#questions)

---

## Issue-First Workflow

**No PR without an issue. No exceptions.**

This project follows a strict issue-first workflow:

1. **Open an issue** using the appropriate template ([Bug Report](https://github.com/arkelythex/drenyra-ai/issues/new?template=bug_report.yml) or [Feature Request](https://github.com/arkelythex/drenyra-ai/issues/new?template=feature_request.yml)).
2. **Wait for approval** — a maintainer adds the `status:approved` label when the issue is ready to be worked on.
3. **Comment on the issue** to let others know you are working on it.
4. **Open a PR** referencing the approved issue with `Closes #<N>`.

PRs that are not linked to an issue will be rejected by maintainers during review.

For bug reports, the template asks for the **component** (contracts, receipts, ledger, gates, recovery, CLI/MCP, …), the **severity** (blocker / high / medium / low), and — for fiscal behavior — the RUC/company and period scope. Fill it in: fiscal bugs are investigated with evidence, not guesses.

---

## Looking for Something to Work On?

Start at the [ROADMAP](ROADMAP.md) and the [v1 gap analysis](docs/roadmaps/2026-08-10-v1-gap-analysis.md).

Issues labelled [`good first issue`](https://github.com/arkelythex/drenyra-ai/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are scoped, low-risk entry points. Issues labelled [`help wanted`](https://github.com/arkelythex/drenyra-ai/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) want contribution. Comment that you are taking one and go.

An issue **without** `status:approved` is usually still in discussion — implementing before the decision lands means the work gets thrown away.

---

## AI-Assisted Contributions

**AI assistance is allowed, but you must understand and own the complete submission.** Before opening a PR:

- [ ] Confirm the change matches the approved issue scope.
- [ ] Inspect every changed line.
- [ ] Remove invented, unverifiable, or unrelated output.
- [ ] Identify the responsible cause or invariant; confirm the fix resolves it rather than masking or shifting the symptom.
- [ ] Remove duplicate authority, unnecessary abstractions, and unrelated complexity; keep the fix proportionate.
- [ ] Run applicable tests and report the actual outcomes.
- [ ] Be ready to explain the design and tradeoffs.
- [ ] Disclose material AI assistance in the PR.

For disclosure boundaries, required details, attribution rules, and reviewer expectations, see the canonical [AI-Assisted Contribution Policy](AI_POLICY.md).

---

## Ground Rules

These are the non-negotiable rules for every contribution. They are also enforced by the review gate.

- **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model. No monetary amount is ever a JavaScript `Number`. Sequence/index/version fields are JSON integers, never floats.
- **Tenant/RUC scope is mandatory.** Every query and mutation verifies company/RUC/period isolation. Never access data across RUCs without explicit context.
- **Every material action produces a receipt.** No receipt, no mutation. Nothing material happens without one.
- **Contracts are frozen public surface.** Changing a contract requires a version bump, a migration path, and explicit approval (see [Contract Changes](#contract-changes)).
- **No `any`.** Use precise types, `unknown`, or justified generics.
- **No secrets.** No credentials, tokens, or customer data in code, docs, or tests.
- **Docs-as-code.** Update docs in the same PR as code. Stale docs are a bug.
- **Tests with code.** Add tests for changed business logic — canonical vectors for anything receipt/ledger/crypto related.
- **No AI attribution.** Conventional Commits only; no `Co-Authored-By` or "Generated with" markers.

---

## Label System

### Applied to Issues

| Label | Meaning |
| --- | --- |
| `bug` | Defect report (added by the bug template) |
| `enhancement` | New capability or improvement (added by the feature template) |
| `status:approved` | Approved for implementation — work can begin |
| `help wanted` | The issue wants contribution |
| `good first issue` | Scoped, low-risk entry point |
| `question` | Discussion or clarification wanted |
| `duplicate` / `invalid` / `wontfix` | Triage outcomes |

### Applied to Pull Requests

| Label | Meaning |
| --- | --- |
| `type:feature` | New feature or enhancement |
| `type:docs` | Documentation only |
| `dependencies` | Dependency updates |
| `javascript` | JavaScript/TypeScript code changes |

Maintainers apply triage and type labels during review; contributors do not need to guess the full taxonomy.

---

## Development Setup

### Prerequisites

- **Node.js >= 22** (the package declares `engines.node >= 22`)
- **Bun** (the CI and local scripts use `bun run`; CI pins `bun 1.3.14`)
- **Git 2.38+**
- A GitHub account with access to [arkelythex/drenyra-ai](https://github.com/arkelythex/drenyra-ai)

### Clone and Install

```bash
git clone https://github.com/arkelythex/drenyra-ai.git
cd drenyra-ai
bun install --frozen-lockfile
```

### Run the CLI Locally

```bash
bun run build          # build dist/ via scripts/build.mjs
node dist/cmd/cli.js --help
```

The package ships a prebuilt ESM artifact (`dist/`, Node >= 22) plus library subpaths for each subsystem (`./missions`, `./receipts`, `./ledger`, `./gates`, `./candidates`, `./recovery`, `./tenant`, …).

---

## Testing

### Unit Tests

Run the full test suite (Vitest):

```bash
bun run test
```

Run tests for one subsystem:

```bash
bun run test -- missions
```

### Typecheck

```bash
bun run typecheck        # tsc --noEmit
```

### Lint

```bash
bun run lint             # biome lint
```

Biome is the configured formatter and linter (`biome.json`); never commit formatting drift.

### Conformance Suites

Frozen contracts are pinned by conformance suites that run in CI and **fail on drift**:

```bash
bun run brand:conformance    # pins contracts/brand-system.md (derivation, banner SVG, raster coverage)
bun run skills:conformance   # pins skills/registry.json against the drenyra-skills authoring manifest
```

**Run the conformance suite for any contract you touch.** Canonical vectors for receipt verification, ledger hashing, and other deterministic behavior are updated **in lockstep** with contract changes.

### Package Verification

Before publishing, the package surface is verified end-to-end:

```bash
bun run verify:package           # build + full suite + release artifacts + file manifest
node scripts/verify-packed-install.mjs   # npm pack → install .tgz → smoke-test the bin under plain Node
```

`prepack` runs `verify:package` automatically; `prepublishOnly` runs typecheck + package verification + packed-install verification, so the protection does not depend on CI alone.

### What CI Runs

Every push to `main` and every pull request runs these jobs (`.github/workflows/ci.yml`):

| Job | Command | Purpose |
| --- | --- | --- |
| **typecheck** | `bun run typecheck` | Type errors block the merge |
| **lint** | `bun run lint` | Biome lint must pass |
| **test** | `bun run test` | Full Vitest suite must pass |
| **brand-conformance** | `bun run brand:conformance` | Brand contract drift fails the build |
| **skills-conformance** | `bun run skills:conformance -- --manifest drenyra-skills/skills/registry.json` | Skills registry drift fails the build |
| **package** | `bun run verify:package` + `node scripts/verify-packed-install.mjs` | The published artifact must actually work |

**All jobs must pass** before a PR can be merged.

---

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

Commit messages **must** match this pattern:

```text
^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9\._-]+\))?!?: .+
```

### Format

```text
<type>(<optional-scope>)!: <description>

[optional body]

[optional footer]
```

### Allowed Types

| Type | Purpose |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change (no behavior change) |
| `chore` | Maintenance, dependencies, tooling |
| `style` | Formatting, linting (no logic change) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or external deps |
| `ci` | CI configuration |
| `revert` | Reverts a previous commit |

### Examples

```text
feat(missions): add optimistic concurrency to MissionRuntime
fix(receipts): fail closed when signer material is missing
docs: update contributing guide
chore(deps): bump biome to 2.5.8
refactor(ledger): extract hash-chain walker
test(candidates): pin canonical vectors for mutated-subject rejection
ci: split typecheck and package jobs
```

### Breaking Changes

Add `!` after the type/scope and include a `BREAKING CHANGE:` footer:

```text
feat(receipt)!: change canonical vector hashing scheme

BREAKING CHANGE: receipt canonicalization changed; all frozen vectors
were regenerated. Consumers must re-verify against the new vectors.
```

**Never** add `Co-Authored-By`, `Reviewed-by`, or "Generated with" AI markers to commits or PR bodies.

---

## Branch Naming

Branch names **must** match this pattern:

```text
^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$
```

**Rules:**

- All lowercase
- Use hyphens, dots, or underscores as separators (no spaces, no uppercase)
- Keep the description short and descriptive

**Examples:** `feat/mission-recovery`, `fix/receipt-fail-closed`, `docs/contributing-guide`, `ci/package-job`

For medium/large changes, prefer an **isolated worktree** over a long-lived branch:

```bash
git worktree add ../drenyra-ai-wt -b feat/mission-recovery
```

---

## Pull Request Rules

### PR Size Budget

Keep PRs at or below **400 changed lines** (`additions + deletions`). This is a deliberate cognitive-load limit: a PR should be reviewable in roughly **60 minutes** without pushing reviewers into fatigue. Fiscal review requires attention; an oversized diff hides the risk.

If your change cannot fit that budget, split it into **chained or stacked PRs** so each review remains focused. The PR template includes a **Chained-PR note** for exactly this case: *ask before merging a single oversized PR*.

### Work-Unit Commits

Structure commits by deliverable unit, not by file type. A good commit includes the code, tests, and docs needed to understand and verify one behavior or workflow.

- Prefer `feat(missions): replay event log on recovery` over separate `models`, `services`, and `tests` commits.
- Keep rollback reasonable: reverting one commit should not remove unrelated work.
- When a PR grows near 400 changed lines, promote work-unit commits into chained or stacked PRs.

### Review Comments

Review feedback should be warm, direct, and useful quickly. Start with the actionable point, explain why when needed, and avoid recapping the PR before giving feedback. Fiscal review feedback names the invariant at risk (receipt integrity, tenant isolation, gate legality), not just the symptom.

### Before Opening a PR

- [ ] There is a linked issue (`Closes #<N>`) approved with `status:approved`
- [ ] The PR is at or below 400 changed lines, or the chained-PR note was followed
- [ ] Commits are organized by deliverable work unit
- [ ] Commits follow Conventional Commits format
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] Conformance vectors updated and passing, if contracts/crypto changed
- [ ] Packed-install smoke test passes, if the package surface changed
- [ ] Docs updated in this same PR (docs-as-code) and `CHANGELOG.md` updated
- [ ] Code is self-reviewed
- [ ] I understand and take responsibility for the complete submission, and have disclosed any material AI assistance in the PR

The [PR template](.github/PULL_REQUEST_TEMPLATE.md) asks for scope, files touched, files deliberately **not** touched, a review path, and a workload forecast — fill it in. The "Files NOT touched" section saves reviewers from hunting for expected-but-absent changes.

### PR Title

Use the same Conventional Commits format as commit messages:

```text
feat(missions): add optimistic concurrency to MissionRuntime
fix(receipts): fail closed when signer material is missing
docs: update contributing guide
```

### Linking Your Issue

In the PR body, include one of:

```text
Closes #42
Fixes #42
Resolves #42
```

---

## Contract Changes

Any change to `contracts/` is a **public contract change** — the contracts are the frozen, versioned surface consumed by Drenyra, Drenyra Pi, ERPs, other SaaS, and agent hosts. The full regime lives in [contracts/README.md](contracts/README.md); in short:

- Bump the affected contract version explicitly (major = breaking).
- Document the migration path.
- Keep verification and canonical vectors in lockstep — a frozen contract is pinned by a conformance suite that fails on drift.
- Get explicit approval. Freezing is the baseline; changing a frozen contract is a major event.

> [!NOTE]
> A change that only adds a *declared* capability (for example, a new library subpath) is not a contract change. A change to the normative shape of `receipt`, `candidate`, `gate`, `ledger`, `mission-protocol`, or `recovery` is.

---

## Code of Conduct

Be respectful. We are building a fiscal system together.

- Critique code, not people
- Be constructive in reviews
- Welcome newcomers

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Violations may result in removal from the project.

---

## Questions?

- Open a [discussion](https://github.com/arkelythex/drenyra-ai/discussions) for questions and ideas — not issues.
- Report a vulnerability via **Private Vulnerability Reporting** — see [SECURITY.md](SECURITY.md). Never open a public issue for security defects.
- Read the release process → [RELEASING.md](RELEASING.md)
- See what is planned and what shipped → [ROADMAP.md](ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md)
- Understand the intended usage and frontier → [Intended Usage](docs/intended-usage.md)
