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

## 5. Diagrams

**Convention (ecosystem-wide).** Every durable architecture, workflow, sequence, data-flow, or state diagram is an [Archify](https://github.com/tt-a1i/archify) artifact — a typed JSON source compiled into a self-contained HTML/SVG map — never a hand-drawn image or a pasted screenshot. The convention is adopted for the whole ecosystem; an artifact exists only where a work unit delivered it, so the roster grows deliberately rather than by habit.

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
