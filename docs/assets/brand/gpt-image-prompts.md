# Drenyra Ecosystem — gpt-image Prompts for README Banners

> **Normative source:** [`brand-system.md`](../../../contracts/brand-system.md) (v0.2
> DRAFT) + [`tokens.json`](../../../contracts/brand-system/tokens.json).
>
> **Creative inspiration:** the Dreamcoder OS design system
> (`dreamcoder-dots/DreamcoderThemes/dreamcoder/tokens.json`) — "Anthracite
> Steel" dark + "Dreamcoder Light" (cocoa/lúcuma) + Dusk. The Drenyra banners
> borrow Dreamcoder's **compositional soul** (layered elevation, aurora glows,
> soft focus, curved geometry, spark accents, visual-health guardrails) while
> keeping the **Drenyra accent identity** (cyan/violet) for validation.

## How to use

1. Open **ChatGPT → Images** (ChatGPT Images 2.0; "Images with thinking" on
   paid plans gives better prompt adherence).
2. Paste the full prompt (Shared DNA + your product's section) verbatim.
3. Generate **2–3 candidates**, keep the strongest.
4. Validate with the conformance checker. Iterate with its off-palette
   feedback if coverage < 0.85.
5. Swap the README `<img>` to the passing PNG.

**Conformance gate (non-negotiable):**

```bash
node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs <path-to-banner.png>
# expect: ✓ <file> (coverage >= 0.85) ... PASS
```

**Anti-palette exclusions (baked into every prompt):** no legacy blue
`#1a73e8`, no off-system cyan `#22d3ee`, no royal blue `#041c78`, no purple
outside the violet set, no warm beige/ember tones, no pure-white glows.

---

## Dark mode — how we improve on the plain navy (Dreamcoder lessons)

These are the design decisions that make the dark banners feel premium instead
of generic. The prompts already encode them; keep them when iterating.

1. **Layered elevation, not flat panels.** The canvas is near-black (`#0B0E11`)
   and every raised element climbs a surface ladder (`#12161B` → `#1A1F26` →
   `#20262E`) with subtle inner shadows — Dreamcoder's anthracite trick. Depth
   comes from elevation, never from noise.
2. **Aurora ambient glow.** Two soft radial glows (cyan and violet, 5–8%
   opacity) at opposing corners — the Dreamcoder `active_rgba` treatment
   (rgba(124,179,217,0.24)). This is what separates "lit" from "backlit".
3. **Micro-grain + blueprint grid.** A 2–3% white grid AND a faint 1% film
   grain kill gradient banding on large dark fields.
4. **Soft focus ring.** The hero element carries a low-opacity accent halo
   (cyan/violet at ~12%) — the Dreamcoder `focus` discipline (accent as
   outline, not as flood).
5. **Curved geometry.** Hard rectangles become orbital arcs, concentric rings,
   and sweeping Bézier curves. Corners respect the 0.5rem radius language.
6. **Spark accents.** Tiny luminous dots ("sparks of verified truth") sit at
   arc intersections and curve endpoints — the only pure-bright elements in
   the composition.
7. **Contrast discipline.** Text hierarchy `#EDEFF2` → `#A8B0BC` → `#6B7480`
   (WCAG AAA on the canvas); accents never carry text.
8. **Dusk cooldown (visual health).** For long-form docs, a warmer variant of
   the banner (light theme) is available — Dreamcoder's eye-health guardrail
   applied to brand imagery.

---

## 1. Shared DNA — identical opening for EVERY product

Keep this block byte-for-byte identical in all six prompts. It is what makes
the ecosystem read as one family.

```text
Drenyra ecosystem brand banner in the Dreamcoder-inspired visual language:
calm, premium, architectural. Background: deep anthracite-navy canvas #0B0E11
with a faint blueprint grid at ~3% white opacity and a subtle 1% film grain to
smooth gradients. Two aurora glows at low intensity (5-8% opacity): cyan
#3CE6D8 on the upper right, violet #9B7FE8 on the lower left, both diffused
into the canvas with no hard edges. Accent colors allowed ONLY: cyan #3CE6D8
(lighter #6AEFE4, dimmer #1F8A80), violet #9B7FE8 (lighter #B8A2F0, dimmer
#7B66C0), success green #4ADE94, muted blue-gray #A8B0BC, plus the surface
ladder #12161B, #1A1F26, #20262E for layered panels and elevation shadows.
All gradients blend exclusively between these colors. Composition language:
layered elevation with soft inner shadows, curved geometry (orbital arcs,
concentric rings, sweeping Bézier curves), and tiny luminous spark accents at
arc intersections. NO cartoon, NO mascot, NO photorealism, NO organic texture.
NO TEXT of any kind — no letters, words, numbers, or logos; the product name
lives in the README, never in the raster. Aspect ratio exactly 1400:460
(banner). Keep C2PA provenance metadata and the imperceptible watermark
enabled.
```

---

## 2. Product prompts

Append the product section to the Shared DNA block. Only the motif changes;
composition, palette, and constraints stay identical.

### Drenyra — Command Center (flagship)

```text
Subject: an abstract accounting command center. Focal point on the right
third: three stacked translucent console panels (surfaces #12161B, #1A1F26,
#20262E) with rising ledger bars in cyan #3CE6D8, success green #4ADE94 and
muted blue-gray #A8B0BC. Wrapped around the console: two concentric orbital
rings — one cyan #3CE6D8, one violet #9B7FE8 — tilted in 3D, with small
spark dots at the points where a sweeping Bézier curve crosses each ring. At
the console center: a dual-approval seal (two interlocking arcs, cyan and
violet) with a checkmark in success green #4ADE94, surrounded by a soft focus
halo. Light variant (optional): canvas #FAFAF9, panels #FFFFFF/#F2F2F0, rings
cyan #2ECFC2 and violet #6B54A8, checkmark #1A8F52, sparks #1F8A80.
```

### Drenyra AI — the verifiable core

```text
Subject: a verified receipt inside an orbital hash-chain. Focal point on the
right third: a large receipt card (surface #12161B, raised #1A1F26 layer, cyan
#3CE6D8 border) holding a circular verified seal with a checkmark in success
green #4ADE94. Around the card: a tilted circular chain of small hash blocks
(rounded squares in muted blue-gray #A8B0BC and violet #9B7FE8) orbiting like
a ring, with tiny sparks at the link points and a thin luminous arc sweeping
behind the card. Composition: the receipt as the calm center, sparks as the
only bright points, deep negative space on the left for the README title. Light
variant (optional): canvas #FAFAF9, card #FFFFFF with #F2F2F0 layer and cyan
#2ECFC2 border, ring violet #6B54A8, checkmark #1A8F52.
```

### Drenyra Pi — pinned package-local runtime

```text
Subject: a pinned deterministic runtime node. Focal point on the right third:
a single central cube (surface #1A1F26 with cyan #3CE6D8 edges, soft inner
shadow) held by a vertical pin of violet #9B7FE8. Around it: three concentric
arcs of muted blue-gray #A8B0BC — two full rings and one partial — with small
satellite nodes at the arc intersections and a spark dot where the pin meets
the top ring. A tiny padlock in success green #4ADE94 marks the deterministic
core. Composition: the pinned node as the still center, everything else in
curved orbit around it. Light variant (optional): canvas #FAFAF9, cube #F2F2F0
with cyan #2ECFC2 edges, pin #6B54A8, padlock #1A8F52, arcs #D4D4D0.
```

### Drenyra Engram — institutional fiscal memory

```text
Subject: an institutional memory lattice shaped as a curved canopy. Focal
point on the right third: a knowledge-graph whose connections are sweeping
Bézier curves (not straight lines) in cyan #3CE6D8, violet #9B7FE8 and muted
blue-gray #A8B0BC, with node dots at every curve intersection and sparks
scattered along the arcs like fireflies. Beneath the canopy: a fiscal-scope
document silhouette (surface #12161B, cyan #3CE6D8 outline) with a small
verified checkmark in success green #4ADE94. Composition: the lattice curves
like a wave over the document; deep negative space on the left. Light variant
(optional): canvas #FAFAF9, document #FFFFFF with cyan #2ECFC2 outline,
checkmark #1A8F52, nodes #6B54A8.
```

### Drenyra Skills — versioned accounting/tax knowledge (planned)

```text
Subject: layered knowledge folios with a curved spine. Focal point on the
right third: three overlapping folio sheets (surfaces #12161B, #1A1F26,
#20262E) whose spines curve outward like an open book, edges in cyan #3CE6D8
and violet #9B7FE8. Each sheet carries a small abstract rule-glyph (a §-mark
formed by a simple curve in muted blue-gray #A8B0BC) and a tiny spark sits at
each glyph's curve tip. A version tag in success green #4ADE94 floats on the
top folio with a soft halo. Composition: the folio stack as a calm hero, a
single sweeping arc crossing behind it. Light variant (optional): sheets
#FAFAF9/#FFFFFF/#F2F2F0, spines #2ECFC2 and #6B54A8, tag #1A8F52.
```

### Drenyra Guardian Angel — independent adversarial verification (planned)

```text
Subject: a guardian shield with twin review lenses and a watchful beacon. Focal
point on the right third: a shield formed by two mirrored curved halves — the
left cyan #3CE6D8, the right violet #9B7FE8 — separated by a luminous seam
with a checkmark in success green #4ADE94 at its center. Above the shield: a
single lens-shaped beacon (muted blue-gray #A8B0BC with a cyan #6AEFE4 core)
sending two faint concentric ripple arcs downward over the shield, with sparks
where the ripples meet the shield's edge. Composition: the shield as the calm
center, ripples as the only motion. Light variant (optional): halves #2ECFC2
and #6B54A8, checkmark #1A8F52, beacon core #1F8A80.
```

---

## 3. README swap

| Repo | File | README line |
| --- | --- | --- |
| Drenyra Command Center (`drenyra-command-center`) | `assets/branding/drenyra-banner.png` (create) | add banner `<img>` at top |
| drenyra-ai | `docs/assets/brand/drenyra-ai-banner.png` (create) | replace `src="docs/assets/brand/drenyra-ai-banner.svg"` with the PNG |
| drenyra-pi | `assets/branding/drenyra-pi-banner.png` (create) | add banner `<img>` at top |
| drenyra-engram | `assets/branding/drenyra-engram-banner.png` (rename) | replace `drenyra-engram-banner-1.png`; delete banner-1/2/3 |
| gentleman-guardian-angel | `assets/branding/guardian-angel-banner.png` (create) | add banner `<img>` at top |
| drenyra-skills | (planned) | — |

The vector SVG in drenyra-ai stays in the repo as the **vector reference**
(the contract requires vectors for identity primitives); READMEs display the
generated PNG.

---

## 4. Dreamcoder palette path (optional evolution)

The prompts above are **validation-clean against the current contract** (apps/web
DTCG palette). If you want the Dreamcoder hues themselves, the dark surfaces are
already near-identical (contract `#0B0E11` ≈ Dreamcoder `#070A13`), but three
deliberate swaps would bring the banners closer to the Dreamcoder soul:

| Role | Current (contract) | Dreamcoder option |
| --- | --- | --- |
| Accent calmness | cyan `#3CE6D8` (bright) | lean on `cyan.dim #1F8A80` + violet `#7B66C0` for glows |
| Success | `#4ADE94` | sage `#55C080` (softer) |
| Light theme | neutral `#FAFAF9` | warm cream `#F3EADC` (cocoa/lúcuma) |

Adopting the warm cream light theme (and sage success) means updating
`tokens.json` → v0.3 and aligning apps/web — a brand-identity decision, not a
prompt tweak.
