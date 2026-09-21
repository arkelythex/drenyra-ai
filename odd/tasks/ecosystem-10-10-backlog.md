# Feature — Ecosystem 10/10 technical backlog

**Status:** in progress
**Authorization:** the user selected the full technical backlog: documentation, dependencies, branches,
CI, and technical debt. Fiscal, security, constitutional, destructive, and ambiguous decisions retain
human or stronger review gates.
**Engram mirror:** `odd/ecosystem-10-10-backlog/tasks`

## Safety boundary

- Treat every existing dirty worktree entry as foreign in-flight work unless this tracker proves
  otherwise.
- Use clean sibling worktrees from each repository's current default branch for isolated changes.
- Keep writes single-threaded; parallel agents may inspect only.
- Do not merge fiscal, security, constitutional, or ambiguous changes without the required owner or
  critical review.
- Each implementation task closes as a reviewable work unit with focused verification and rollback
  evidence.

## Success standard

“10/10” means no known evidence-backed mechanical defect remains in the selected scope: default
branches have green relevant checks, dependency/security state is known, documentation links and
indexes are coherent, unique branch work is either published or explicitly retained, and every
remaining item has a named decision owner rather than being silently ignored.

## Tasks

| # | Task | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Refresh inventory across all six repositories | done | 33 open PRs; 23 alerts in command-center; 0 alerts elsewhere |
| 2 | Rank backlog by risk, value, and safe autonomy | done | Mechanical, diagnostic, and high-consequence lanes recorded below |
| 3 | Repair green mechanical documentation and generated-index failures | in progress | Start with command-center PRs #171/#172/#177 |
| 4 | Resolve dependency, CI, and version drift that has current evidence | in progress | Engram #29-34, Pi #71, command-center #194/#203/#209/#211/#213/#217/#234/#235 merged; command-center alerts reduced to 10; #195 blocked by #207; #197 requires Go 1.26 decision |
| 5 | Audit retained branches and publish or remove only proven content | pending | — |
| 6 | Review and route fiscal, security, and constitutional decisions | pending | — |
| 7 | Re-verify ecosystem state and close every remaining exception explicitly | pending | — |

## Inventory snapshot

| Repository | Open PRs | Open alerts | Local risk |
| --- | ---: | ---: | --- |
| drenyra-ai | 1 | 0 | 21 foreign dirty entries; PR #100 is constitutional |
| drenyra-skills | 2 | 0 | Clean divergent docs branch |
| drenyra-pi | 2 | 0 | One dirty entry; vendored runtime boundary requires care |
| drenyra-engram | 11 | 0 | Active fiscal stack; two dirty entries |
| drenyra-guardian-angel | 1 | 0 | Clean main; security boundary |
| drenyra-command-center | 16 | 23 | 344 dirty entries; local branch 229 ahead and 11 behind main |

## Ranked lanes

1. **Mechanical autonomous:** regenerate command-center indexes for PRs #171/#172/#177; review
   documentation-only PRs; merge only verified green dependency PRs.
2. **Diagnostic before write:** failing Engram dependency PRs #33/#34, cancelled command-center
   dependency runs, dangling documentation-standard references, and drenyra-ai documentation CI gaps.
3. **Strong review / owner decision:** drenyra-ai #100; Engram fiscal slices #35–#39;
   command-center tenant/security changes #104/#105; any contract or Node-engine change.

## Work-unit ledger

| Unit | Repository / target | Allowed edit surfaces | Checks | Rollback | Gate |
| --- | --- | --- | --- | --- | --- |
| CC-DOC-171 | command-center PR #171 | `docs/00-INDEX.md` | Generator idempotent; links 15/15; `check` and `review` green | Revert `6dde9868f` | Mechanical |
| CC-DOC-172 | command-center PR #172 | `docs/00-INDEX.md` | Generator idempotent; links 15/15; stacked conflict resolved; checks green | Revert `1c3ea0d88` and merge `fec25eb0a` | Mechanical |
| CC-DOC-177 | command-center PR #177 | `scripts/docs/generate-index.ts` | Generator preserves Dominion pointer; links 15/15; `check` and `review` green | Revert `0aacd2707` | Mechanical |
| ENG-DEPS-29 | drenyra-engram PR #29 | `.github/workflows/docker.yml` | Exact pinned action SHA; seven checks green | Revert merge `c02188e11` | Mechanical, merged |
| ENG-DEPS-30 | drenyra-engram PR #30 | `go.mod`, `go.sum` | Seven checks green on refreshed base | Revert merge `dbce0605c` | Mechanical, merged |
| ENG-DEPS-31 | drenyra-engram PR #31 | `.github/workflows/release.yml` | Exact action SHA; seven checks green | Revert merge `3968afc3c` | Mechanical, merged |
| ENG-DEPS-32 | drenyra-engram PR #32 | `.github/workflows/docker.yml` | Refreshed through Git after OAuth workflow-scope refusal; seven checks green | Revert merge `30b8c2025` | Mechanical, merged |
| ENG-DEPS-33 | drenyra-engram PR #33 | `package.json`, `bun.lock` | Node 22: 386 tests, package + packed-install; 7/7 CI including Go race | Revert merge `76772a188` | Vitest 5.0.1 mechanical, merged; Node 26 defect tracked #45 |
| ENG-DEPS-34 | drenyra-engram PR #34 | Docker workflow action pin | 7/7 CI including Go race | Revert merge `598f3366b` | Mechanical, merged |
| PI-DEPS-71 | drenyra-pi PR #71 | manifest, lock, discovery test, generated lock facts/mirror | Frozen install; 799 tests; typecheck/style/capability/package/packed-install; four CI checks | Revert merge `b993476ea` | Mechanical, merged |
| AI-DOC-LINKS | drenyra-ai PR #102 / issue #101 | Docs workflow + two broken link targets | Lychee 439 OK/0 errors; markdownlint; 9 CI checks | Revert merge `0cf630ddb` | R1, merged |
| SKILLS-VISUAL-3 | drenyra-skills PR #3 | README + light/dark banner pair | XML; target checks; forced opposite-theme Chrome | Revert merge `646e55999` | Presentation, merged |
| GUARDIAN-VISUAL-3 | drenyra-guardian-angel PR #3 | README + light/dark banner pair | Same browser/theme proof | Revert merge `d57acd9e9` | Presentation, merged |
| CC-VISUAL-179 | drenyra-command-center PR #179 | README + light/dark banner pair | Browser/theme proof; full restored CI and docs checks green | Revert merge `f281bc833` | Presentation, merged |
| CC-SEC-FASTURI | drenyra-command-center PR #195 | Root `package.json` + owned lock artifacts; revert five unrelated manifest diffs | fast-uri 4.1.4 resolution; zero unrelated drift; frozen install; current-SHA CI | Revert one isolated commit | Patch verified; blocked by #207 typecheck baseline and offline receipt runner |
| CC-CI-203 | drenyra-command-center issues #202/#204/#205/#206, PR #203 | Valid CI structure, remove never-implemented gate, provision Redis CLI, hosted docs runner | strict YAML; actionlint; 7/7 CI; docs + maintenance + review green | Revert merge `e21f4ea43` | Mechanical infrastructure repair, merged |
| CC-CI-208 | drenyra-command-center issue #208 / PR #209 | `contracts-nightly.yml` receipt job runner + Bun pin only | actionlint; frozen installs; TS/Go/Python conformance on hosted runner | Revert merge `4e0a67dc2` | R2-approved, merged |
| CC-DEPS-194 | drenyra-command-center PR #194 | `apps/cli/go.mod`, `go.sum` | Go build/test; full restored CI; Wave 2 10/10 | Revert merge `7d6e262a4` | SQLite 1.58.0 mechanical, merged |
| CC-DEPS-197 | drenyra-command-center PR #197 | proposed `apps/cli/go.mod`, `go.sum` | Canonical `go get` proved Go 1.26 + x/sys update required | None pushed | Blocked platform decision; not mechanical |
| CC-TYPES-207 | drenyra-command-center issue #207 | Future split remediation | Clean API/Web typechecks without weakening flags | Per-slice rollback | 1,363 API errors/444 files + Web TS5102; needs strong review |
| CC-SEC-210 | drenyra-command-center issue #210 / PR #211 | Estado web/admin Next manifests + product pnpm lock + exact ignore exception | pnpm 9.15 frozen install; lock review; both builds/lints; current CI; final R3 review | Revert merge `ec66cb8aa` | Four critical alerts closed; merged |
| CC-SEC-212 | drenyra-command-center issue #212 / PR #213 | Estado root pnpm PostCSS override + product lock only | reproducible lock; bounded graph; both builds/lints; current CI; final R3 review | Revert merge `6d07f70b9` | Four PostCSS alerts closed; merged |
| CC-ANDINO-214 | drenyra-command-center issue #214 / PR #217 | Delete exactly tracked `products/andino/studio_html_backup/**` | complete deletion scope; zero refs; active tree unchanged; CI; secrets/PII scan; R3 review; alert closure | Revert merge `7c87151d2` | Two critical alerts closed; merged |
| CC-ANDINO-215 | drenyra-command-center issue #215 / PR #234 | Active Studio npm/Node lock + Docker/CI reproducibility | exact npm lock; Node 20/22 lint/standalone build; digest-pinned Docker build/start/non-root/HTTP; actionlint; R3 | Revert merge `4867eb2bf` | Merged; reproducible deploy gate restored |
| CC-ANDINO-216 | drenyra-command-center issue #216 / PR #235 | Active Studio Next + eslint-config 16.3.5 + npm lock | exact 2-spec diff; reproducible lock; Node 20/22; Docker smoke; npm audit 0; current CI; R3 | Revert merge `0ea07dff8` | Eight Studio lock alerts closed; merged |

Add later units only after their current evidence and allowed edit surfaces are known.

## Corrections and non-actions

- A three-dot comparison against `docs/readme-visual-system` initially made an old merge-base README
  line look current. Direct `git show origin/main:README.md` proved current main already uses an
  existing Dreamcoder hero asset. No README/banner change was made; the clean exploratory worktree
  remains disposable.
- The three visual-flow PRs (#3 in skills, #3 in guardian-angel, #179 in command-center) use a single
  `prefers-color-scheme` SVG and need theme-pinning refresh before merge.
- Ownership-boundary docs PRs (skills #5 and pi #76) are not presentation-only and remain in the
  human/strong-review lane.
