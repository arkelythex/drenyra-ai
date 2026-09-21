# Feature — Archify diagram convention (Drenyra ecosystem)

**Status:** complete (pilot)
**Owner decision (2026-09-18):** adopt Archify as the diagram convention and install the skill; pilot scope is `drenyra-ai` only, then authorized to advance the whole ecosystem.
**Engram mirror:** `odd/archify-diagram-convention/tasks`

## Authorization record

- Intent authorized: adopt as convention + installed skill, pilot in `drenyra-ai`.
- Second authorization: "advance everything, 10/10" — read as: close every open item in this feature rather than leaving follow-ups.
- Out of scope: any change under `contracts/` (frozen public surface), any fiscal behavior, any
  monetary, tenant, or ledger code path. No code file was touched.

## Decisions taken (reversible)

1. **Anchoring point** — the convention lands in `docs/documentation-standard.md` as new
   section 5; `docs/architecture.md` (documentation index) links to it. No `AGENTS.md` rule
   change: the standard is the single writer-facing surface.
2. **Artifact layout** — `docs/diagrams/<subject>.<type>.{json,html,svg}`, where the JSON is the
   authoritative source and the reviewable unit, the HTML is the interactive artifact, and the
   SVG is the inline view.
3. **The inline view is mandatory, the fence stays.** GitHub renders images (PNG, SVG) but not
   HTML documents, so an `.html` artifact is invisible in the repository browser. A map a GitHub
   reader must see carries a view GitHub renders inline, and an artifact never silently deletes
   the fence that already provided one.
4. **Repo-agnostic wording in the standard.** The standard is duplicated in two repositories, so
   no sentence may be true in one copy and false in the other.

## Tasks

| # | Task | Status |
| --- | --- | --- |
| 1 | Survey the documentation surface and fix the convention anchor | done |
| 2 | Install Archify as a skill and verify the CLI end to end | done |
| 3 | Write the diagram convention into the documentation standard | done |
| 4 | Generate the `drenyra-ai` reference map from real repository evidence | done |
| 5 | Verify: artifact acceptance, link resolution, diff review | done |
| 6 | Resolve the inline-view question against official platform evidence | done |
| 7 | Export the standalone inline SVG through the supported viewer path | done |
| 8 | Eliminate the standard's duplication drift and record the governance gaps | done |

## Evidence ledger

**Task 2 — skill installation and CLI.** Extract of the canonical `archify.zip` release
(v2.17.0-dev.1, 79 files) into `~/.agents/skills/archify`, the real store behind the
`~/.pi/agent/skills` symlinks. `archify doctor` green on Node v26.7.0. The runtime has no npm
dependencies: `bin/archify.mjs` imports only Node builtins.

**Task 4 — reference map.** Source `docs/diagrams/drenyra-ai.architecture.json`, artifact
`drenyra-ai.architecture.html`.

- Revision **87542f6**; all 15 cited source paths verified present at that revision with
  `git cat-file`, so the evidence links are not worktree-only.
- `deliver` exit 0 · specification sha256 `f194da20…` (5819 bytes) · artifact sha256 `6e67ab9d…`
  (812552 bytes) · 9/9 artifact checks · composition `pass` · 0 errors · 0 warnings ·
  **13** repository evidence references verified against the revision.
- `visual-check` `pass`: containment, readability, and viewer chrome pass at 1440x900,
  1600x1000, 1920x1080, and 2048x1320, with no overflow on either axis and node text at 8.8px
  against a 6px minimum.
- Both hashes still match the delivered values at the end of this work, proving the candidate
  was frozen rather than edited after acceptance.

Three acceptance rounds, each repaired with the single suggested control: an overlapping label,
then desktop readability (viewBox 1700, too wide), then desktop containment (viewBox 1110x818,
too tall). Delivered composition: two rows, viewBox 1170x408.

**Task 6 — inline view, decided by official evidence.** GitHub's own documentation states that
GitHub "can display several common image formats, including PNG, JPG, GIF, PSD, and SVG", and
that it does not "directly support rendered views of commits to HTML documents". So an `.html`
artifact cannot be read in the repository, and the plan to replace the ASCII fences with a link
to it would have removed the map from GitHub's reading surface. The fences stay; the artifact is
linked; an exported image supplies the inline view.

**Task 7 — inline SVG.** The CLI has no export command (its commands are render, compare,
deliver, preview, validate, migrate, inspect, check, visual-check, guide, brands, examples,
doctor, demo), and the delivery contract states that viewer exports are not validation claims.
Export was therefore driven through the supported viewer path — the artifact opened in a real
browser, **Export → Download SVG** — producing `drenyra-ai.architecture.svg` (150425 bytes).

Verified standalone, not assumed: the file carries its own `<style>` with embedded JetBrains
Mono WOFF2 subsets and **0** external references; loaded as a bare SVG document it reports
`documentElement.tagName === "svg"`, 33 text nodes with real labels, 15 semantically coloured
rectangles, 21 stroke shapes, `fill: rgb(15, 23, 42)`, and the resolved `JetBrains Mono` stack.
A hand-cut `<svg>` from the artifact would have failed this: the artifact keeps its 86 classes in
the document stylesheet, not inside the SVG.

**Task 7 — perceptual review.** The delivered artifact was inspected as an image at 1440x900 and
2048x1320, both themes. Readable main path, correct semantic colouring, truthful legend
(Backend 4 · Database 1 · Security 3 · External 1 = 9 nodes), cards closing the composition, no
visual collision. Residual finding: at 2048x1320 the composition ends around 80% of viewport
height. This is structural, not authorial — viewer chrome plus the conclusion cards occupy
roughly 330-470px, and the diagram scale is capped by the 1440px reading width, so filling
1320px would require an authored viewBox of about 709px, which overflows 1440x900 by more than
270px. The two required viewports cannot both be filled; the hard no-overflow constraint wins,
and the measured slack at the smallest viewport is about 95px.

**Task 8 — duplication drift, found and repaired.** `drenyra-ai-native-go` is the native Go port
of this same project and carries a byte-identical copy of `docs/documentation-standard.md`
(58 lines before this work). The first edit to the `drenyra-ai` copy therefore created real
drift. Both copies are now identical at 96 lines with `diff` empty, re-synced after every
subsequent wording change. Repo-specific wording was removed from section 5 so that identity
across copies stays true.

**Task 5 — verification.** `markdownlint-cli2` run directly against the four touched files under
the repository's own rule set: **0 issues**. Repository CI is typecheck, lint, test, coverage,
brand-conformance, skills-conformance, and package; none reads `docs/*.md`, and `docs/` is absent
from the package `files` list, so this change cannot affect CI or the published package. No code
file was touched: `package.json` was already modified before this work began. Test residue from
the browser-driven export was removed from the working tree.

## Governance gaps found (owner-gated, not resolved here)

1. **The standard is duplicated** across `drenyra-ai` and `drenyra-ai-native-go`, with no
   mechanism keeping the copies aligned; this work had to repair drift it created within minutes.
2. **The duplicated copy carries drenyra-ai absolute paths** such as
   `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/README.md` in its reference-exemplar list,
   which is meaningless on any other machine. Pre-existing; left untouched deliberately.
3. **`drenyra-command-center` has its own divergent standard** (`docs/meta/documentation-standards-2026.md`
   plus `AGENTS.md#documentation-standards`), referenced by 34 files. `drenyra-skills`,
   `drenyra-pi`, `drenyra-engram`, and `drenyra-guardian-angel` reference no standard at all.
4. **`markdownlint-cli2` is configured but never runs.** `.markdownlint-cli2.jsonc` exists; there
   is no runner in CI, no script in `package.json`, and no local install. Running it today reports
   **194 issues across 36 files**, 99 of them in
   `openspec/changes/archive/2026-08-15-fiscal-authority-kernel`. Wiring it into CI as-is would
   fail immediately, so the gate needs a cleanup work unit first.

The copy-propagation pattern in gaps 1-3 is the same class of incoherence that the in-flight
`ecosystem-coherence` change owns, and its program files were already modified when this work
began. Propagating the convention to the remaining repositories was therefore not performed
unilaterally: it belongs to that change's owner-gated cross-repository declarations.

## Follow-ups (not started)

1. Propagate the convention to the other repositories — owner-gated, per the gaps above, one
   work unit per repository.
2. Export inline images for the ecosystem and layer diagrams and retire their ASCII fences, once
   the export-and-commit procedure in section 5 is routine.
3. Decide the fate of `markdownlint-cli2`: wire it as a real gate after a cleanup work unit, or
   delete the config so the repository stops advertising a check nothing performs.
