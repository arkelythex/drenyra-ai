# Drenyra Ecosystem — Documentation Quality Bar

← [Back to README](../README.md)

A good page lets its reader take the next safe step without reconstructing the
project. This is the editorial and visual standard for documentation in this
repository: explain the outcome, expose the evidence, and keep deeper reference
one link away.

Reference exemplars — adapt the structure, never copy another project's claims:

- [Gentle-AI README](https://github.com/Gentleman-Programming/gentle-ai) — benefit-led features, visual explanations, and progressive disclosure.
- [Project README](../README.md) — positioning and entry paths.
- [Agent Guide](../AGENTS.md) — compact rules and ownership.
- [Intended Usage](intended-usage.md) — authority and non-goals.

## 1. README bar (positioning-first)

1. One-sentence positioning + one-line value proposition at the top (what/why, who it's for).
2. Current-release callout with version policy up top (badge/version + release cadence or stage).
3. A visible **Get started** entry link near the positioning, followed by a concise, copy-pasteable installation section. Features may explain the mental model first.
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

## 3. Verify facts before publishing

Facts are not a palette: do not copy a dated snapshot into every page.

| Claim | Source to check |
| --- | --- |
| Current package version | `package.json`, the release tag, npm `latest`, and [CHANGELOG](../CHANGELOG.md) |
| Contract version and status | The header of each file under [contracts/](../contracts/README.md) |
| CLI syntax and output | `cmd/` and the built CLI's `--help` |
| Library exports | `package.json` and each subsystem's `index.ts` |
| Ecosystem names and boundaries | [Ecosystem Integration](architecture/ecosystem-integration.md) and the [program](../program/drenyra-dominion/README.md) |
| Visual tokens | [brand-system v0.4](../contracts/brand-system.md) and its [tokens](../contracts/brand-system/tokens.json) |

The current release verified for this documentation pass is **v0.6.0**. Current
product names are **Drenyra Console** and **Drenyra Shell**. Historical release
entries and dated program/spec evidence retain the names and versions that were
true when recorded. Satellite release status is not inferred from this repository.

The authority model stays constant: the accounting database holds transactional
truth; Engram informs but never authorizes; receipts and the append-only audit
ledger prove execution; Guardian provides independent verification; the human
professional retains fiscal and business decision authority. Money is BigInt cents,
RUC/company/period isolation is mandatory, and material actions require receipts.

## 4. Quality principles

- Positioning-first: why before how; the reader learns what the project IS before touching code.
- Facts over aspiration: every version, status, and dependency claim must match reality.
- Reduce cognitive load: short sentences, tables for comparison, `<details>` for secondary content.
- Consistent ecosystem references: same statuses, same dependency direction, same authority model everywhere.
- English for all artifacts (repo is public-facing); neutral professional register.
- No AI attribution markers; Conventional Commits only.

## 5. Diagrams

**Convention: two visual jobs, two authoring paths.** README brand and feature
illustrations are hand-authored SVG compositions generated from a single template
for both themes. Durable technical maps remain [Archify](https://github.com/tt-a1i/archify)
artifacts: typed JSON sources with traceable repository evidence and exported
HTML/SVG views. A feature illustration explains one concept; a technical map
explains the real topology. Neither is a screenshot of text.

### README visuals

Sources live in `scripts/docs-visuals/`. Regenerate, never hand-edit the SVGs:

```bash
bun run docs:visuals
bun run brand:conformance
node scripts/brand-conformance.mjs docs/assets/diagrams
```

Outputs live in `docs/assets/brand/` (banner and divider mark) and
`docs/assets/diagrams/` (feature illustrations). Every composition has a Light/Dark
pair, descriptive alt text, and accessible SVG `title`/`desc` elements. Use the
same layout in both themes, not two independently maintained copies. Only colors
from `contracts/brand-system/tokens.json` are allowed; opacity may vary. The
brand checker also rejects off-palette hex colors in ordinary `fill`, `stroke`,
`stop-color`, and `color` declarations in SVG `<style>` blocks.

| Semantic role | Dreamcoder Light | Dreamcoder Dark |
| --- | --- | --- |
| Canvas | `#F3EADC` | `#000000` |
| Surface | `#FFF7EA` | `#0B0B0B` |
| Heading | `#100C07` | `#F5F5F5` |
| Main path | `#824F16` | `#A5B4FC` |
| Verified | `#315B31` | `#34D399` |
| Scope / information | `#0D4A68` | `#7DD3FC` |
| Human authority | `#57478B` | `#D4B5FD` |
| Error | `#842F24` | `#FB8585` |

Black is the Dark canvas, not the functional surface ladder. Keep readable text,
restrained accents, and enough negative space to explain the concept. Do not
reproduce Gentle-AI's rose, identity, product claims, or screenshots.

### Technical maps

**Layout.**

```text
docs/diagrams/<subject>.<type>.json         authoritative source; the reviewable unit
docs/diagrams/<subject>.<type>.html         deterministic output; regenerable, never hand-edited
docs/diagrams/<subject>.<type>.light.svg    inline view, pinned to light
docs/diagrams/<subject>.<type>.dark.svg     inline view, pinned to dark
```

`<type>` is one of `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle`, chosen by the question the reader has — not by preference, and not by what is easiest to draw.

**Inline view.** The CLI has no image export: `deliver` writes HTML only, and exporting a PNG or SVG is a viewer action (see below). GitHub renders images such as PNG and SVG, but it does not render HTML documents — a committed `.html` artifact appears as source, never as a page. So an artifact is not by itself readable in the repository: a map that a GitHub reader must see also carries a view GitHub renders inline, either a markdown fence (ASCII or mermaid, both rendered) or a committed exported image.

**Exporting the inline image.** The CLI cannot export images; the viewer can. Open the delivered HTML in a browser and use **Export → Download SVG**, which yields a self-contained `.svg` with its styles and font subsets inlined and no external references. One export is enough, because the file carries both palettes — but it leaves the choice to `prefers-color-scheme`, so as written it follows the reader's operating system rather than GitHub's theme. A reader whose GitHub is light while their desktop is dark gets a dark diagram on a white page.

So write two files from that one export, each with `data-theme="light"` or `data-theme="dark"` on the root `<svg>` element. Those selectors win over the media query by specificity, which was checked in a real browser by forcing the operating-system preference: the pinned files kept their own palette while the unpinned file followed the system. Then embed the pair with the theme fragments GitHub supports:

```markdown
![…](docs/diagrams/<subject>.<type>.light.svg#gh-light-mode-only)
![…](docs/diagrams/<subject>.<type>.dark.svg#gh-dark-mode-only)
```

After an Archify export, apply the deterministic Dreamcoder post-processor:

```bash
node scripts/archify-dreamcoder.mjs docs/diagrams/*.svg
node scripts/brand-conformance.mjs docs/diagrams/*.svg
```

This step re-themes inline SVG views only; the interactive HTML retains the
Archify viewer palette. Do not claim that the viewer has been re-themed.
Repeated conversion must preserve identical bytes, including canonical amber
used by Dark messagebus elements; do not remap a token that the converter emits.

Verify before committing: each file must open as a bare SVG document that keeps its own styling. An `<svg>` cut out of the artifact by hand does not, because the artifact carries its classes in the document stylesheet rather than inside the SVG.

**Authoring rules.**

1. **Evidence, not invention.** A map that describes real code sets `meta.repository` (URL plus a full 40-character commit revision) and cites real `sources[]` paths and line numbers, so every node is traceable to a revision. Never author a topology the repository does not have.
2. **Prose stays authoritative.** A diagram is an orientation aid: it never introduces a claim the normative prose does not already make, and it never contradicts it. When they disagree, the prose is right and the diagram is a defect.
3. **The non-negotiable rules apply to diagrams too.** A map must not depict money as a float, data access without RUC/period scope, or a material action without a receipt.
4. **Never lose the inline view.** An artifact never silently replaces the fence that a GitHub reader depends on. Adding the artifact and exporting an inline image are separate, reviewable work units — never a drive-by deletion.

**Acceptance.** Install the skill once with `npx skills add tt-a1i/archify -g`, then validate and deliver every artifact:

```bash
ARCHIFY="${ARCHIFY:-$HOME/.agents/skills/archify/bin/archify.mjs}"
node "$ARCHIFY" validate architecture docs/diagrams/<subject>.architecture.json --quality showcase --repo-root . --json
node "$ARCHIFY" deliver  architecture docs/diagrams/<subject>.architecture.json docs/diagrams/<subject>.architecture.html --quality showcase --repo-root . --json
node "$ARCHIFY" visual-check docs/diagrams/<subject>.architecture.html --json
```

- A **showcase** pass reports all **9** artifact checks with **0** composition errors and **0** warnings. Fewer checks is basic validation, not acceptance.
- `deliver` must exit **0** and report the SHA-256 of both the specification and the artifact. A non-zero exit is never described as success, and a failed delivery leaves the previous output untouched.
- `visual-check` must pass containment with no overflow at 1440×900, 1600×1000, 1920×1080, and 2048×1320. These are machine measurements, not perceptual approval: real visual review still needs a human.
- Commit the `.json` source, the `.html` artifact, the `.visual-check.json` receipt, and any exported inline image. Screenshot sidecars are regenerable evidence: keep them only for a canonical reference map, and delete them otherwise, so an ordinary diagram does not add binary weight to review.

## 6. Page anatomy

1. Start with an H1 and a return link to the nearest index.
2. Explain the reader's problem in two or three sentences.
3. Use a status callout only when there is a real boundary, version, or warning.
4. Put a **Quick path** near the top of procedural pages. Examples must work with
   the inputs they name; label fragments and placeholders instead of pretending
   they are complete sessions.
5. Group details by reader task. Use tables for choices and `<details>` for long,
   secondary reference material. Preserve published heading anchors.
6. End with two to four **Read next** links that explain why each page matters.

Normative contracts, requirements, dated plans, and historical ODD task records
are not marketing copy. Improve their framing and navigation without rewriting
requirements, dates, identifiers, or evidence. The same quality bar does not mean
an identical template forced onto a changelog, policy, or frozen contract.

## Read next

- [Quickstart](quickstart.md) — check whether a new reader can execute the happy path.
- [Contracts](../contracts/README.md) — respect the public change regime.
- [Deterministic Testing](testing-deterministic.md) — connect documentation claims to evidence.
