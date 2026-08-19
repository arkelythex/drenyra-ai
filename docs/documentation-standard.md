# Drenyra Ecosystem — Documentation Quality Bar

Reference exemplars (READ THESE before writing; adapt structure, not copy):

- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/README.md` (408 lines, already at the bar)
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/AGENTS.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/AI_POLICY.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/CONTRIBUTING.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/CHANGELOG.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/docs/intended-usage.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/docs/CODEBASE-GUIDE.md`
- `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/docs/architecture.md`
- Reference README style: `/home/dreamcoder08/Documents/PROYECTOS/gentle-ai/README.md`

## 1. README bar (positioning-first)

1. One-sentence positioning + one-line value proposition at the top (what/why, who it's for).
2. Current-release callout with version policy up top (badge/version + release cadence or stage).
3. **Quick Start** immediately after positioning (concrete, copy-pasteable).
4. What It Does / Key Features — short, benefit-led, details blocks (`<details>`) for secondary content.
5. Live badges where the project has real status (npm/release/CI if they exist; do not invent badges).
6. Explicit "Documentation" section linking `docs/` (intended-usage, CODEBASE-GUIDE, architecture).
7. Next Steps / How to Contribute links.
8. NO aspirational state presented as current reality; NO stale version/status claims.

## 2. Repo file checklist (each repo needs)

| File | Required sections (adapt to repo) |
| --- | --- |
| `AGENTS.md` | Non-Negotiable Rules / Read Before Working (table) / Where Changes Belong / Skills |
| `AI_POLICY.md` | Human Responsibility / Disclosure / Review and Attribution / Submission Quality / Enforcement |
| `CONTRIBUTING.md` | Issue-First Workflow / Ground Rules / Development Setup / Testing / Commit Convention (Conventional Commits, no AI attribution) / Branch Naming / PR Rules / Code of Conduct |
| `CHANGELOG.md` | Keep a Changelog format, `## [Unreleased]` at top, real release history |
| `docs/intended-usage.md` | Definition / philosophy / what the project is NOT / responsibility split / target experience / next steps |
| `docs/CODEBASE-GUIDE.md` | Repository map / Layering (who may import whom) / Where a change goes / invariants / Testing / Conventions / Read next |
| `docs/architecture.md` | Documentation index / Position in the ecosystem / Core invariants / Layer model / Consumer contract / Repository scope |

## 3. Ecosystem CURRENT FACTS (must be consistent everywhere — verified 2026-08-19)

- All **six** Drenyra repos are **public**. Only Elvyra is private (do not mention Elvyra in docs).
- Dependency direction: satellites (`drenyra-command-center`, `drenyra-pi`, `drenyra-engram`, `drenyra-skills`, `drenyra-guardian-angel`) consume the published `drenyra-ai` contracts — never the reverse; `drenyra-ai` never depends on them.
- `drenyra-ai`: **Alpha, v0.5.0** (npm 0.5.0; tags v0.5.0/v0.4.x; contracts frozen; receipts Ed25519-signed).
- `drenyra-pi`: **Pre-alpha** (v0.0.1-prealpha.1; runtime pin 0.3.0 in flight; fiscal harness extracted).
- `drenyra-engram`: **Alpha, v0.2.1** (GitHub releases v0.2.x; Apache-2.0; informs, never authorizes).
- `drenyra-command-center`: **In development** (public).
- `drenyra-skills`: **In development** (content layer: versioned accounting/tax/operational knowledge, PE jurisdiction).
- `drenyra-guardian-angel`: **In development** (independent adversarial verification, consumes frozen contracts).
- Authority model: Drenyra accounting database (PostgreSQL, tenant-isolated) → transactional truth; Engram → institutional memory (informs, never authorizes); AI receipts+ledger → execution proof (Ed25519-signed, append-only); Guardian Angel → independent verification; human accountant → final authority.
- Fiscal conventions (apply when mentioned): money is BigInt cents, never floats; RUC/period scope is mandatory; every material action produces a receipt.

## 4. Quality principles

- Positioning-first: why before how; the reader learns what the project IS before touching code.
- Facts over aspiration: every version, status, and dependency claim must match reality.
- Reduce cognitive load: short sentences, tables for comparison, `<details>` for secondary content.
- Consistent ecosystem references: same statuses, same dependency direction, same authority model everywhere.
- English for all artifacts (repo is public-facing); neutral professional register.
- No AI attribution markers; Conventional Commits only.
