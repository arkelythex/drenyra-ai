# Feature — Ecosystem propagation of the diagram convention

**Status:** complete (canonical published; four pointer branches local and ready for review)
**Authorization:** user authorized advancing the whole ecosystem, then explicitly authorized commits and pushes, under normal engineering practice plus ODD discipline.
**Predecessor:** `odd/tasks/archify-diagram-convention.md` (pilot, complete)
**Engram mirror:** `odd/ecosystem-diagram-convention-propagation/tasks`

## Outcome

The convention is published and the pointers exist, each as an independent reviewable unit based
on the default branch. Nothing was written into another repository's in-flight work.

## Task 1 — reconnaissance (delegated to `gentle-ai-explore`, read-only)

Two premise corrections came out of it, both re-verified by the parent:

1. **`drenyra-ai-native-go` is not a sibling repository.** `git worktree list` reports it and
   `drenyra-ai` under one repository, and `--git-common-dir` resolves to `drenyra-ai/.git`. It is a
   linked worktree on `feat/native-go-runtime`. The earlier claim of a standard "duplicated across
   two repositories" was wrong; it is one file on two branches, and synchronizing it is merge
   hygiene, not propagation.
2. **Two repositories share one branch name.** `drenyra-skills` and `drenyra-pi` are both on
   `docs/align-skill-ownership`, a live cross-repository documentation change.

Insertion points resolved: `drenyra-skills` and `drenyra-guardian-angel` take the canonical
3-column index row; `drenyra-pi` has no documentation index and takes a row in the
`## Read Before Working` table of `AGENTS.md`, which already carries an absolute ecosystem URL;
`drenyra-engram` has no root `AGENTS.md` and no table in `docs/architecture.md`, so its only docs
surface is the `## Documentation` list in `README.md`.

## Task 2 — ruling (delegated to `gentle-ai-governor`, read-only)

Execute, but only after the canonical document lands. Canonical home approved as `drenyra-ai`
section 5, pointed at with an absolute `blob/main` URL plus the `#5-diagrams` anchor; writing
pointers before the commit **denied**, because an absolute URL to uncommitted content is a dangling
link; scope approved as the four repositories above; English for all four; the work **split per
repository and branch**, never one mixed review; three items escalated to the human.

Stop condition: *if the canonical document is not committed and the anchor verified live, stop
before the first pointer write.*

The condition was satisfied deliberately rather than assumed, in three stages: the committed tree
first proved to lack the section (`git show HEAD:...`), then after the push GitHub's own served
metadata proved the slug (`{"text":"5. Diagrams","anchor":"5-diagrams"}`), and finally a real
browser navigation proved the fragment works (page scrolled to `scrollY 2334` with the heading
visible 125px from the top, matching GitHub's own permalink `href="#5-diagrams"`).

## Task 3 and 4 — publication and pointers

**Published to `arkelythex/drenyra-ai` `main` (push `87542f6..4487434`):**

| Commit | Content |
| --- | --- |
| `6610449` | `docs(diagrams)`: the reference map — `docs/diagrams/` only, 9 files |
| `4487434` | `docs`: section 5 of the standard plus the index row and inline SVG |

Both messages are Conventional Commits and carry no AI attribution marker. Neither commit staged
any of the pre-existing in-flight changes, which remain uncommitted and unstaged.

**Pointer branches, each one commit based on `origin/main`, one line, one file, deliberately not pushed:**

| Repository | Commit | File | Base |
| --- | --- | --- | --- |
| `drenyra-skills` | `71670b6` | `docs/architecture.md` | `b808459` |
| `drenyra-pi` | `cfd87a2` | `AGENTS.md` | `7611df0` |
| `drenyra-engram` | `78ec3f6` | `README.md` | `827fd64` |
| `drenyra-guardian-angel` | `e4e0243` | `docs/architecture.md` | `11b1850` |

All four sit on the branch `docs/ecosystem-diagram-convention` and each adds exactly one line
(`1 0`), pointing at the canonical URL. Each repository was restored to the branch it was on
before this work, and every temporary worktree was removed.

The first attempt cut three of the four branches from whatever branch each repository happened to
be on. The independent verifier caught that `drenyra-engram`'s base was unpublished, which would
have made its branch unpushable without carrying an unrelated feature commit. All three were
rebuilt from `origin/main` in temporary worktrees so the working trees were never disturbed.

## Task 5 — independent verification (delegated to `gentle-ai-verify`)

The verifier was instructed to falsify, and it did. Findings it settled:

- Canonical publication verified: `main` == `origin/main` == `4487434`, the pushed blob is
  byte-identical to the local file, artifact hashes in the commit match the accepted values, and
  the published SVG serves `HTTP 200` as `image/svg+xml` with identical bytes.
- Commit hygiene verified: correct file sets, no attribution markers.
- Pointer branches verified: one commit each, `1 0` numstat, correct URL, English, table pipe
  counts consistent with their siblings, and nowhere pushed.
- No new lint issue: the only findings anywhere were two pre-existing `MD040` in `drenyra-engram`'s
  `README.md` (lines 57 and 177, before the inserted line), identical at the base commit.

Findings it raised that were acted on:

1. **The `drenyra-ai-native-go` worktree still carried an uncommitted copy of section 5.** The
   bytes were identical to the commit now on `main`, so the delta was reverted and that branch is
   clean apart from its pre-existing untracked `openspec` directory.
2. **`drenyra-engram`'s branch was stacked on an unpublished commit**, fixed by the rebase above.

Findings it raised that are not defects in this work: `4487434`'s parent is `6610449` rather than
`87542f6` (they are sequential commits, so the wording of the claim was loose, not the history);
the second commit is the one that changes the standard while the first only adds artifacts, which
is the intended order so every commit stays coherent; and `drenyra-ai` has 79 unpushed commits on
other local branches, which predates this work.

## Anomaly found by the verifier that is not ours, and the action taken

At 23:07:29-23:07:35 on the same day, roughly one minute before the pointer branches were created
and seconds after the canonical push, a **separate workstream** created branches named
`docs/archify-diagrams` in about twelve repositories, with worktrees under
`/PROYECTOS/arkelythex-worktrees/org-docs-archify/`, its own `BRIEF.md`, and tooling including
`export-svg.mjs` and `shot-svg.mjs`. It covers the same subject in the same repositories,
including `drenyra-command-center`. Two other Pi sessions are live under
`/home/dreamcoder08/Documents/PROYECTOS/arkelythex`.

That workstream is not ours and was not touched. Concern: two agents writing the same documentation
surface in the same repositories can duplicate or contradict each other. A coordination message was
sent to the peer session stating our exact surface, the four branches and commits, and asking it not
to duplicate the convention pointer. State it plainly to the human: this is a live parallel effort
that the human owns and that this feature cannot control.

## Delivery (authorized push and pull requests)

The four pointer branches were pushed and one pull request was opened per repository, each against
its own default branch:

| Repository | Pull request | Commit on the remote | Published diff | CI |
| --- | --- | --- | --- | --- |
| `drenyra-skills` | [#6](https://github.com/arkelythex/drenyra-skills/pull/6) | `71670b6` | one added line, URL once | no checks configured |
| `drenyra-pi` | [#77](https://github.com/arkelythex/drenyra-pi/pull/77) | `cfd87a2` | one added line, URL once | package, style — pass |
| `drenyra-engram` | [#40](https://github.com/arkelythex/drenyra-engram/pull/40) | `78ec3f6` | one added line, URL once | Go Build + Vet, Go Format — pass |
| `drenyra-guardian-angel` | [#4](https://github.com/arkelythex/drenyra-guardian-angel/pull/4) | `e4e0243` | one added line, URL once | no checks configured |

Verification of the published state, not of the local intent: each remote branch resolves to the
expected commit via `git ls-remote`, each pull request reports one added line with no deletions on a
single file against `main` and is not a draft, and each published diff contains the canonical URL
exactly once in a one-line hunk. Where continuous integration exists it is green.

## Merged (authorized)

All four pull requests were merged with a rebase so each lands as a single well-formed
conventional commit and history stays linear. Every repository permits squash, merge, and rebase;
rebase was chosen because a one-line change does not deserve a merge commit.

| Repository | Pull request | Merge commit | Pointer on `origin/main` |
| --- | --- | --- | --- |
| `drenyra-skills` | #6 | `ae04240` | verified |
| `drenyra-pi` | #77 | `cfbf5b2` | verified |
| `drenyra-engram` | #40 | `c2327bc` | verified |
| `drenyra-guardian-angel` | #4 | `783833b` | verified |

Verified after the fact rather than assumed: `gh api` reports `merged: true` for each, the
pointer line is present exactly once in each file on `origin/main`, and the remote branches were
deleted. Local branches were then deleted as well (forced, because a rebase merge rewrites the
commit identity) and `drenyra-guardian-angel` was returned to `main` at its merge commit.
one check on `drenyra-engram` (#40) was still `pending` at merge time: `Go Race Detector`,
which never reported a result. Six other checks passed, including `Go Tests`; the change was a
one-line README edit, so the pending run could not have been affected by it.

## Verified outcome

- The pointer is present on `origin/main` in five of six repositories: the canonical repository's
own index row plus the four merged pointers. `drenyra-command-center` remains the open governance
decision.
- **The map renders inline on GitHub**, which was the whole point of the export. Fetching the
  rendered page for `docs/architecture.md` on `main` returns
  `<a href=".../drenyra-ai.architecture.svg"><img src="...`, so any reader sees the diagram without
  opening the HTML artifact or running a tool.
- The native-go merge obligation is **not** an action item. Verified with the merge base: the
  `feat/native-go-runtime` branch contains zero commits touching `docs/documentation-standard.md`
  after the fork point, section 5 is present on `main` and absent on the branch, so the eventual
  merge keeps `main`'s version without a conflict.

## Enforcement delivered (pull request)

The markdownlint configuration existed with no runner anywhere, so the quality bar it describes was
unenforced. It is now wired, as pull request
[#89](https://github.com/arkelythex/drenyra-ai/pull/89), because `ci.yml` is modified by in-flight
work and touching it would have mixed two changes; a separate workflow file avoids that.

**First attempt, and why it was replaced.** The initial version excluded all of `openspec/` with one
glob. It passed, but it hid reachable defects: the exclusion covered live change records as well as
frozen ones. The exclusion now names only what genuinely cannot comply —
`openspec/changes/archive/**` (frozen historical records, never edited again) and
`**/apply-progress.md` (append-only logs where repeated headings are the record format, 133 of the
194 findings). Everything else is linted, and the linted set grew from 57 to **114 files** still at
**zero issues**.

**Twelve findings fixed, one of them a real rendering defect.** Four fences gained a language; three
lines that were emphasis and nothing else became labelled sentences; three table rows had unescaped
pipes inside code spans, which is why those tables rendered with the wrong columns; and three
indented lines in the delivery sequence were parsed as an indented code block, so a normative rule
about external repositories **rendered as code instead of prose**. No claim, task state, or evidence
was reworded.

Self-verified rather than asserted: the pull request's own continuous integration ran the new job
over the widened set and it passed, alongside the seven pre-existing jobs.

## Escalations

1. **`drenyra-command-center` was not touched and still needs a decision.** It maintains its own
   divergent standard, its `docs/architecture.md` is already modified inside a 344-file working set,
   and its docs are Spanish-heavy. Adding an ecosystem pointer there places two competing standards
   side by side, which is a governance decision.
2. **The parallel `org-docs-archify` workstream**, above.
3. **The four pointers are delivered and awaiting human review.** They are open pull requests; merging is a human decision under ordinary repository policy.

## Observations reported, not acted on

- GitHub reported 6 pre-existing dependabot vulnerabilities on the default branch (4 high, 2 moderate).
- `.markdownlint-cli2.jsonc` is still configured but never run; a repository-wide run reports 194
  issues across 36 files, so wiring it as a gate needs a cleanup work unit first.
- `drenyra-ai-native-go` will need `docs/documentation-standard.md` reconciled when
  `feat/native-go-runtime` merges, or the convention forks across branches.
- `drenyra-engram` has no `AGENTS.md`; creating one is a separate decision.
