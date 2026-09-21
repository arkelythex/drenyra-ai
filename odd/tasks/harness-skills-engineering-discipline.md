# Feature — Engineering-discipline skills (global harness)

**Status:** done
**Authorization:** the user asked whether repetitive work warrants skills and approved creating all three with the `skill-creator`, plus reporting two findings upstream to Archify.
**Engram mirror:** `odd/harness-skills-engineering-discipline/tasks`

## Why these three and only these three

The `skill-creator`'s own activation contract sets the bar: create a skill when a pattern repeats
and needs guidance, and specifically not when it is trivial, one-off, or better served by ordinary
documentation. Applying that bar to this session's repeated work:

| Candidate | Repetitions | Cost of getting it wrong | Verdict |
| --- | --- | --- | --- |
| Deciding whether a branch's work already landed | ~8 | Wrong twice: path comparison reported 0% for changes that had been archived, and `git cherry` plus commit subjects lie after squash or rebase | **skill** |
| Diagnosing why dependency updates never land | 3 distinct root causes | Three diagnostic rounds, plus six advisories rotting for a month because no dependency PR could pass | **skill** |
| Working in a tree that holds someone else's uncommitted work | ~6 | Nearly published a commit that would have reverted a fresh fix, and lost two rounds to a `checkout` refusal | **skill** |
| Delivering diagrams with Archify | 4 geometry rounds | No: Archify ships its own `SKILL.md` and authoring contract. A second skill duplicates it and then drifts, which is the mistake section 5 of the documentation standard exists to prevent. The findings go upstream instead | **no skill** |
| A local runner attributing lint findings to the last edited file | 6 | Yes, but it is a **bug**, not a procedure. A skill cannot fix a bug; it gets reported | **no skill** |

## Placement decision

Global, in `~/.agents/skills/`, never in `drenyra-skills`. That registry is the product's versioned
fiscal-knowledge layer, validated by `registry.schema.json` and pinned by the `skills:conformance`
gate. Engineering discipline belongs to the harness, not to the product's knowledge surface.

## Contracts applied

Per `skill-creator/references/skill-style-guide.md`: required section order (Activation Contract,
Hard Rules, Decision Gates, Execution Steps, Output Contract, and References unless truly
irrelevant), one-line quoted `description` with trigger words first and at most 250 characters, body
targeted at 180–450 tokens with a recommended maximum of 700, imperative voice, no history or
motivation, no external URLs as primary references, and no `AGENTS.md` registration because these
are global rather than project skills. The three skills are self-contained, so the independent
verifier accepted omission of an empty References section under the guide's explicit exception.

## Tasks

| # | Task | Status |
| --- | --- | --- |
| 1 | Read the normative style guide and the creator's contract | done |
| 2 | Write `branch-redundancy-audit` | done |
| 3 | Write `dependency-pipeline-diagnostics` | done |
| 4 | Write `shared-working-tree-discipline` | done |
| 5 | Verify the three against the creator's contract | done |
| 6 | Independent verification | done |
| 7 | Report the Archify findings upstream | done |

## Evidence for the skills' content

Kept here rather than inside the skills, because the style guide forbids history and motivation in
a skill body:

- **Branch audit.** `git cherry` reported 7 pending commits for work whose every added file was
  byte-identical in `main`; 0 of 21 commit subjects were in `main` because the merges were not
  squashes; and comparing change records by path reported 0% for the fiscal kernel and the Dominion
  reconciliation because both had been archived to `openspec/changes/archive/<date>-<name>/`.
- **Dependency pipeline.** Six advisories open with no path to fix them, because every Dependabot PR
  failed all jobs at `bun install --frozen-lockfile` while the configuration updated only
  `package-lock.json`. A separate class: `Input required and not supplied: token` on Dependabot PRs
  only, because those runs receive Dependabot secrets and the secret lived in Actions secrets — and
  the secret was unnecessary because the target repository is public.
- **Shared working tree.** A pending `ci.yml` authored before the fix re-added the credential I had
  removed; committing it would have reintroduced the broken pipeline. Also: husky's pre-commit shim
  is absent in a fresh worktree, and `git checkout` refuses when a dirty file differs between the
  current and target commits.

## Final verification

- Descriptions are 147, 143, and 132 characters: all meet the 160-character SHOULD.
- Frontmatter parses; required sections are ordered; no title, Keywords section, or external URL is
  present; Pi discovery symlinks resolve to the global skill directories.
- Approximate character-based body sizes remain under the guide's 700-token recommended maximum.
  Exact token conformance is undefined because the guide names no tokenizer.
- Independent `gentle-ai-verify` review initially found unsafe absolutes and an unbound Git diff.
  Corrections now cover additions, modifications, deletions, and renames; bind merge base and branch;
  condition dependency conclusions on observed resolution behavior; forbid branch overwrite and
  automatic hook bypass. Final re-verification reported no remaining blocker.
- Archify findings were reported upstream as `tt-a1i/archify#469`.
