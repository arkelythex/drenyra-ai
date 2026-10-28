# Feature — Gentleman-grade documentation and Dreamcoder visuals

**Status:** complete — locally verified · **Branch:** `docs/gentleman-grade-docs` · **Engram mirror:** `odd/gentleman-grade-docs/tasks`
Rewrite the README and every Markdown document to the editorial bar of the Gentle-AI README, with
SVGs, diagrams, and visuals drawn from the Dreamcoder Light and Dreamcoder Dark palettes.

## Specs

- **S1** — The README MUST follow the Gentle-AI README model: "me encanta el readme de este proyecto , <https://github.com/Gentleman-Programming/gentle-ai> , asi debe ser para este proyecto". Concretely: hero banner, palette-matched `for-the-badge` badges, a pain-first pitch, a `Features` section where each concept gets one full-width visual, one problem-first paragraph and a `Docs →` link, then Get started, a Documentation table, ecosystem, and closing — with section dividers and "Back to top" links.
- **S2** — The whole documentation set MUST reach the same quality: "y toda su documentacion con la calidad de gentleman". Scope (owner decision 2026-10-28): **all repository Markdown (~97 files)**.
- **S3** — SVGs, diagrams, and other visuals MUST take their inspiration from the Dreamcoder themes: "ademas para los svgs , diagramas y mas visuales deben inspirarse de dreamcmoder light y dreamcoder dark". Tokens come from `dreamcoder-dots/DreamcoderThemes/dreamcoder/tokens.json` (`modes.light`, `modes.dark`).
- **S4** — Diagram approach (owner decision 2026-10-28): **hybrid**. Hand-crafted SVGs for README brand and feature visuals; Archify artifacts re-themed to Dreamcoder for the technical maps under `docs/`. `docs/documentation-standard.md` §5 MUST be amended to record the hybrid rule.
- **S5** — Every visual MUST ship as a Light/Dark pair embedded with `#gh-light-mode-only` / `#gh-dark-mode-only` (or `<picture>`), with descriptive `alt` text, and MUST NOT depict a claim the prose does not make (money as floats, unscoped access, unreceipted actions).
- **S6** — Facts MUST stay true: versions, statuses, and contract states match the repository (for example `package.json` is `0.6.0`; the README still says `v0.5.0`).
- **S7** — Normative surfaces (`contracts/`, `specs/`, `program/`) get presentation-only changes: navigation, headers, callouts, tables. Normative wording, requirement IDs, and versions MUST NOT change.

## Tasks

| ID | Specs | Task | Status | Commit |
| --- | --- | --- | --- | --- |
| T0 | S3 | brand-system v0.4: Dreamcoder Dark tokens, checker accent fix, schema v0.4 | done | `5c3e7c2` |
| T1 | S3, S4 | Dreamcoder docs palette and amended diagram rule in `documentation-standard.md` | done | `9ba65c8` |
| T2 | S1, S3, S5 | Brand kit: hero banner, divider mark, badge palette (Light/Dark) | done | `ba7eff1, 113c019, 46e1ce3` |
| T3 | S1, S3, S5, S6 | README rewrite with feature diagrams (Light/Dark) | done | e1937ac, 2c96806 |
| T4 | S3, S4, S5 | Re-theme the Archify maps to Dreamcoder Light/Dark | done | `663c57f` |
| T5 | S2, S6 | Entry docs: quickstart, intended-usage, usage, sdk | done | 4b39a68, 432d44d |
| T6 | S2 | `docs/architecture.md` and `docs/architecture/*` | done | 905e6da |
| T7 | S2 | CODEBASE-GUIDE, testing-deterministic, governance, fiscal-authority-kernel-chain | done | 0549b58 |
| T8 | S2, S6 | Root files: AGENTS, CONTRIBUTING, AI_POLICY, SECURITY, CODE_OF_CONDUCT, RELEASING, ROADMAP, CHANGELOG, CONTRIBUTORS, PR template | done | edbb8ce |
| T9 | S2, S7 | `contracts/` presentation pass | done | 1c93edc |
| T10 | S2 | `docs/design`, `docs/runbooks`, `docs/roadmaps`, `docs/assets/brand/*.md` | done | 17ba30b, f9f7966 |
| T11 | S2, S7 | `program/drenyra-dominion` presentation pass | done | a70c79c |
| T12 | S2, S7 | `specs/` presentation pass | done | 99b0b89 |
| T13 | S2, S5 | Verification: markdownlint, relative links, SVG validity, render check | done | 3713b5a, dc050e0; closing evidence commit |

## Log

- **L1** (2026-10-28, owner): "me encana el readme de este proyecto , <https://github.com/Gentleman-Programming/gentle-ai> , asi debe ser para este proyecto y toda su documentacion con la calidad de gentleman , ademas para los svgs , diagramas y mas visuales deben inspirarse de dreamcmoder light y dreamcoder dark ❯ pwd /home/dreamcoder08/Documents/PROYECTOS/dreamcoder-dots"
- **L2** (2026-10-28, owner): scope "Todo el repo (~97 .md)"; diagrams "Híbrido" (hand-crafted SVG for README brand/features; Archify themed to Dreamcoder for technical maps).
- **L3** (2026-10-28, evidence): existing `docs/assets/brand/*.svg` already use Dreamcoder Light only; the Archify maps in `docs/diagrams/` use Archify's default slate palette in both modes; `docs/documentation-standard.md` §5 currently forbids hand-drawn diagrams.
- **L4** (2026-10-28, evidence): `contracts/brand-system` v0.3 pinned the dark theme to Anthracite Steel (`#070A13`) and banned OLED black, while the current Dreamcoder Dark in `dreamcoder-dots` is OLED `#000000` with indigo `#A5B4FC` / lavender `#D4B5FD`. The checker also collected the banned `cyan`/`violet` accents instead of `cocoa`/`terracotta`, and `tokens.schema.json` was still v0.2.
- **L5** (2026-10-28, owner): "Dreamcoder Dark actual de dots" — approve brand-system v0.4 with the current Dreamcoder Dark (contract change, added as T0).
- **L6** (2026-10-28, owner): "yes te autorizo todo y avanza de forma autonoma usando buenas practicas de ingeneria de softwart + filosofia de gentleman"
- **L7** (2026-10-28, decision — page anatomy for S2, derived from the Gentle-AI `docs/` pages). Every rewritten page follows this anatomy:
  1. `# Title` — the page name, nothing else on the line.
  2. A back link on the next line: `← [Back to README](<relative>/README.md)` for `docs/**` and root files; `contracts/`, `specs/` and `program/` pages link back to their own index `README.md` (and the index links back to the root README).
  3. A lede of two or three sentences: the problem this page solves and who it is for — problem first, never a feature list.
  4. A `> [!NOTE]` / `> [!IMPORTANT]` callout only for a real status or version fact. Current facts: release `v0.6.0` (npm `latest` 0.6.0, tag `v0.6.0`); six FROZEN contracts (`mission-protocol`, `candidate`, `receipt`, `gate`, `ledger`, `recovery`); `brand-system` v0.4 DRAFT; ecosystem products are named **Drenyra Desktop** (formerly Command Center) and **Drenyra Shell** (formerly drenyra-pi). Historical records (CHANGELOG entries, dated program/spec evidence) keep the facts of their date.
  5. A `## Quick path` near the top when the page is procedural: copy-pasteable commands, in order.
  6. Task-named `##` headings ("Verify a receipt", not "Receipt verification module"); short sentences; tables for comparisons; `<details><summary>…</summary>` for long reference material that most readers skip.
  7. `---` separators only between major groups on long pages.
  8. A closing `## Next steps` (or `## Read next`) with two to four links, each with a one-line reason.
  9. Voice: neutral professional English, no emojis, no exclamation marks, no marketing filler. Identifiers, commands and paths in backticks. Money is BigInt cents.
  10. Normative text in `contracts/`, `specs/` and `program/` is never reworded: requirement IDs, RFC 2119 keywords, versions, scenarios and tables stay byte-identical; only navigation, lede, callouts, and section framing are added around them.
  11. Anchors are a public surface: before renaming a heading, `grep -rn "<file>#<anchor>"` across the repository and either keep the heading or add `<a id="<old-anchor>"></a>` above the new one.
  12. `bun x markdownlint-cli2 <file>` passes and every relative link resolves.

- **L8** (recovery): All seven writer tasks failed (two left partial visual scripts/assets; five text passes produced no changes). No final worker report or verification was accepted. Local recovery normalized named SVG colors in `scripts/archify-dreamcoder.mjs`; all four technical SVGs and generated brand/feature assets pass brand conformance. Light/Dark banners were rendered and inspected. `bun run lint` exits 0 with existing Biome schema/deprecation notices. T1/T2/T4 remain partial, not complete. README and documentation rewrites have not landed.
- **L9** (verification limitation): Native `gentle_review assess` could not capture a candidate because untracked files require declaration; RDD stays off, no native lifecycle operation was run. Decision needed: restore the worker runtime before resuming delegation, or explicitly route the remaining documentation units inline.

- **L10** (owner): "te autorizo todo y continue de forma autonoma" — resume inline after the failed writer runtime; preserve the original scope and verification bar.

- **L11**: T1 complete inline. Hybrid authoring paths, Dreamcoder palette, re-theme command and page anatomy documented. Markdownlint: 0 issues across 97 files.

- **L12**: T2 complete with paired banners/mark, deterministic generation, XML parsing, raster inspection and public-script tests. T4 complete: static palette variables resolved for librsvg, four maps recolored with geometry unchanged; runtime Light and candidate Dark inspected. Slice boundaries: primitives (`ba7eff1`), brand kit (`113c019`), generation (`46e1ce3`), Archify portability (`663c57f`). Generated SVG output is reviewed with its source; the portability unit exceeds the nominal line budget because four exported views carry embedded styles. No PR or publishing was authorized by these commits.

- **L13**: T3 complete with five feature illustrations and paired themes. T5 complete: global/local install distinction, valid create JSON, staged versus executed work, audit settings moved to Usage, runnable SDK snippet. CLI examples checked in isolated `.tmp/docs-examples` (create/status/project exit 0); SDK stdout exactly `inspected`, stderr empty. Markdownlint passes. Editorial README is one cohesive review slice; generated diagram pairs are reviewed against their single source.

- **L14**: T6/T7 complete inline. Added reader-specific framing/navigation; corrected stale claims that MCP and PostgreSQL adapters were absent; distinguished adapter existence from deployment proof. Removed software-delivery language from fiscal gate explanations, preserved historical chain evidence, clarified ODD test-first and the proprietary license. Markdownlint passes across the repository.

- **L15**: T8/T9 complete. Root obligations and contributor identities preserved. Contract framing is additive; all original lines retained in order for 10 normative/reference documents relative to the post-v0.4 baseline. Contract index now agrees on brand-system v0.4. Conformance: 144/144 tests, seven files, exit 0. Markdownlint clean.

- **L16**: T10 complete in 17ba30b. Approved designs retain original text in order. Runbooks now distinguish operator-specific integrations from CLI diagnostics; ledger validation takes a JSON file, not a directory. Roadmap snapshot is explicitly revision-bound. Initial Markdownlint found nine formatting issues; corrected, then 97 files passed. Review slices remain separated by document family; no combined PR is claimed.

- **L17**: T11 complete, a70c79c: 25 program pages retain every original line in order. W1-owned status-and-evidence.md deliberately unchanged; its evidence index is not rewritten. Reading routes distinguish historical checkpoints from live product claims. Runbook ledger input correction: f9f7966. T12 adds requirement-to-change navigation without rewriting requirements or scenarios.

- **L18**: T12 complete in 99b0b89; six requirements documents preserve every original line in order. T13 found a real regeneration defect: Dark messagebus amber was emitted as #fbbf24 then treated as legacy indigo on a second run. Public-script test RED (exit 1; one failed/four passed), GREEN (exit 0; five passed), fixed in 3713b5a. All four actual maps now report unchanged on reprocessing. Theme-paired badges and the current-versus-archived artwork roster landed in dc050e0.
- **L19**: Final functional checks after the fix: typecheck exit 0; lint exit 0 (existing Biome schema/deprecation notices remain); test exit 0 (1499 tests in 113 files); build exit 0. Contract-only run: 144 tests passed. Markdownlint: 97 files, zero issues. Link/anchor scan: 710 relative references, zero missing targets or anchors. The initial scanner counted an inline-code example as a link; corrected its code-span exclusion, not repository content. External badge/avatar/network availability was not certified.
- **L20**: Visual verification: 18 active paired SVGs parsed as XML, each with image role, title, and description; all counterparts exist. Full generation plus Archify conversion preserves byte hashes. All 18 render nonblank through librsvg; final montage inspected, alongside the earlier full-size feature and map previews. Palette conformance passes and a separate full-source CSS/attribute hex scan confirms canonical colors, including ordinary stylesheet declarations. Current authored diagrams have theme-paired embedding and descriptive alt; decorative marks intentionally use empty alt. External contributor avatars remain unmodified attribution content, not brand artwork. Old unembedded Light-only editorial source assets remain as references, not current README visuals.
- **L21**: Independent gentle-ai-verify completed (mvsfkaqw-8-o69v): 17 focused tests passed, conformance scan passed, fail-closed rejection probe preserved bytes, and 41 normative documents passed the ordered-subsequence check against 5c3e7c2. Its S3/S7 verdicts are scoped PASS; S5 embedding was outside its read scope and is covered by the parent's checks in L20, not misreported as independently audited. Parent additionally checked 47 normative/approved documents including designs and receipt-schema README against the approved v0.4 baseline: every original line retained. W1-owned status-and-evidence.md and eight historical ODD feature records intentionally stay untouched. All 97 Markdown files were in the validation set; 88 are changed from the actual feature base.
- **L22**: Known pre-existing advisory, not changed here: brand-conformance.mjs ignores ordinary CSS class declarations (e.g. .bad { fill: #123456 }); standalone postprocessor and explicit full-source scan provide evidence for the current SVGs, not a claim that the generic checker is complete. Recorded in Engram for a separately scoped fix. Native assess remained unavailable because of untracked scratch capture; RDD stayed off, no native review approval or receipt claimed. Local independent technical verification did run. Cross-repository adoption, live PostgreSQL/connector/vault operation, and ecosystem-wide conformance are not certified by this documentation pass.
- **L23**: Delivery boundary: 20 reviewable implementation commits before this closing record, grouped by documentation family and generated-source unit; generated SVG portability and README units carry the over-budget rationale in L12/L13. Actual feature base is 91b5903 (before 5c3e7c2), not the now-newer origin/main: the branch does not include three remote-only commits. No file was deleted by this feature, no remote merge/rebase was attempted, and no push/PR was performed. Any publication must reconcile the base and preserve bounded review slices rather than propose one accumulated oversized PR. T0–T13 are locally complete; retained scratch .tmp/ is untracked and excluded from commits.
