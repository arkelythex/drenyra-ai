# Drenyra Ecosystem — gpt-image Prompts for README Banners

> **Normative source:** [`brand-system.md`](../../../contracts/brand-system.md) (v0.2
> DRAFT) + [`tokens.json`](../../../contracts/brand-system/tokens.json). The
> ecosystem README banners are **generated images**, not hand-authored SVG —
> this file is the canonical prompt set for ChatGPT Images 2.0 (model family
> `gpt-image-1`).

## How to use

1. Open **ChatGPT → Images** (ChatGPT Images 2.0; "Images with thinking" on
   paid plans gives better prompt adherence).
2. Paste the full prompt (Shared DNA + your product's section) verbatim.
3. Generate **2–3 candidates**, keep the strongest.
4. Validate with the conformance checker (command below). Iterate the prompt
   with the checker's off-palette feedback if coverage < 0.85.
5. Swap the README `<img>` to the passing PNG.

**Conformance gate (non-negotiable):**

```bash
node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs <path-to-banner.png>
# expect: ✓ <file> (coverage >= 0.85) ... PASS
```

**Anti-palette exclusions (already baked into every prompt):** no legacy blue
`#1a73e8`, no off-system cyan `#22d3ee`, no royal blue `#041c78`, no purple
outside the violet set, no warm beige/ember tones, no white glows.

---

## 1. Shared DNA — identical opening for EVERY product

Keep this block byte-for-byte identical in all six prompts. It is what makes
the ecosystem read as one family.

```text
Drenyra ecosystem brand banner. Dark, professional, architectural composition
in the Drenyra visual language (apps/web design system). Background: deep navy
canvas #0B0E11 with a very subtle blueprint grid (grid lines at ~3% white
opacity) and two soft radial glows at low intensity: cyan #3CE6D8 on the
upper right, violet #9B7FE8 on the lower left. Accent colors allowed ONLY:
cyan #3CE6D8 (lighter #6AEFE4), violet #9B7FE8 (lighter #B8A2F0), success
green #4ADE94, muted blue-gray #A8B0BC, plus surface tones #12161B and
#1A1F26 for layered panels. All gradients must blend exclusively between these
colors. Precision geometry, clean vector-like edges, subtle depth of field,
premium enterprise-software aesthetic. NO cartoon, NO mascot, NO organic
texture, NO photorealism. NO TEXT of any kind in the image — no letters, no
words, no numbers, no logos; the product name lives in the README, never in
the raster. Aspect ratio exactly 1400:460 (banner). Keep C2PA provenance
metadata and the imperceptible watermark enabled.
```

---

## 2. Product prompts

Append the product section to the Shared DNA block. The motif is the only
thing that changes; composition, palette, and constraints stay identical.

### Drenyra — Command Center (flagship)

```text
Subject: an abstract command center for accounting operations. Focal point in
the right third: a layered dashboard console — three translucent panels with
rising ledger bars in cyan #3CE6D8, success green #4ADE94 and muted blue-gray
#A8B0BC. Centered on the console: a dual-approval motif, two interlocking
seals (one cyan #3CE6D8, one violet #9B7FE8) forming a single verified badge
with a checkmark in success green #4ADE94 — representing two distinct
approvers. Background depth: faint hash-chain blocks receding into the navy
canvas. Composition: console as hero, deep negative space on the left for the
README title, balanced glows. Light variant (optional): swap canvas to
#FAFAF9, panels to #FFFFFF/#F2F2F0, seals to cyan #2ECFC2 and violet #6B54A8,
checkmark to #1A8F52, grid to black at 3%.
```

### Drenyra AI — the verifiable core

```text
Subject: a verified receipt and an append-only hash chain. Focal point in the
right third: a large receipt card (surface #12161B with a #1A1F26 raised
layer, cyan #3CE6D8 border) carrying a large verified checkmark in success
green #4ADE94 inside a circular seal. Behind it: a chain of small linked
hash blocks (rounded squares in muted blue-gray #A8B0BC and violet #9B7FE8)
receding diagonally into the canvas, implying an immutable ledger. Composition:
receipt as hero, empty negative space on the left for the README title,
cyan glow upper right. Light variant (optional): canvas #FAFAF9, card
#FFFFFF with #F2F2F0 layer and cyan #2ECFC2 border, checkmark #1A8F52.
```

### Drenyra Pi — pinned package-local runtime

```text
Subject: a pinned, deterministic runtime node. Focal point in the right third:
a single central cube (surface #1A1F26 with cyan #3CE6D8 edges) held by a
vertical pin/pivot of violet #9B7FE8, with four radiating connector lines in
muted blue-gray #A8B0BC linking it to small satellite nodes — the pinned
package never moves, everything else docks to it. A small padlock in success
green #4ADE94 marks the deterministic core. Composition: the pinned node as
hero, clean negative space on the left, violet glow lower left. Light variant
(optional): canvas #FAFAF9, cube #F2F2F0 with cyan #2ECFC2 edges, pin
#6B54A8, padlock #1A8F52.
```

### Drenyra Engram — institutional fiscal memory

```text
Subject: an institutional memory lattice. Focal point in the right third: an
abstract knowledge-graph node field — nodes in cyan #3CE6D8, violet #9B7FE8
and muted blue-gray #A8B0BC connected by thin luminous edges, forming a
neural-lattice canopy over a subtle fiscal-scope marker: a document silhouette
(surface #12161B, cyan #3CE6D8 outline) with a small verified checkmark in
success green #4ADE94. Composition: lattice as hero, deep negative space on
the left for the README title, cyan glow upper right. Light variant (optional):
canvas #FAFAF9, document #FFFFFF with cyan #2ECFC2 outline, checkmark #1A8F52.
```

### Drenyra Skills — versioned accounting/tax knowledge (planned)

```text
Subject: layered, versioned knowledge folios. Focal point in the right third:
a stack of three overlapping folio sheets (surfaces #12161B, #1A1F26 and
#20262E) with spine edges in cyan #3CE6D8 and violet #9B7FE8, each sheet
topped by a small abstract rule-glyph (a §-shaped mark formed by simple
geometric strokes in muted blue-gray #A8B0BC) — implying versioned tax and
accounting rules. A small version tag in success green #4ADE94 on the top
folio. Composition: folio stack as hero, negative space on the left, violet
glow lower left. Light variant (optional): sheets #FAFAF9/#FFFFFF/#F2F2F0,
spines #2ECFC2 and #6B54A8, tag #1A8F52.
```

### Drenyra Guardian Angel — independent adversarial verification (planned)

```text
Subject: a guardian shield with twin review lenses. Focal point in the right
third: a shield formed by two mirrored halves — the left half cyan #3CE6D8,
the right half violet #9B7FE8 — fused along a vertical seam with a small
checkmark in success green #4ADE94 at the center. Above the shield, a single
watchful beacon (a soft lens shape in muted blue-gray #A8B0BC with a cyan
#6AEFE4 core) radiates two faint horizontal beams. Composition: shield as
hero, deep negative space on the left for the README title, balanced glows.
Light variant (optional): shield halves #2ECFC2 and #6B54A8, checkmark
#1A8F52, beacon core #1F8A80.
```

---

## 3. README swap

| Repo | File | README line |
| --- | --- | --- |
| Drenyra | `assets/branding/drenyra-banner.png` (create) | add banner `<img>` at top |
| drenyra-ai | `docs/assets/brand/drenyra-ai-banner.png` (create) | replace `src="docs/assets/brand/drenyra-ai-banner.svg"` with the PNG |
| drenyra-pi | `assets/branding/drenyra-pi-banner.png` (create) | add banner `<img>` at top |
| drenyra-engram | `assets/branding/drenyra-engram-banner.png` (rename) | replace `drenyra-engram-banner-1.png`; delete banner-1/2/3 |
| gentleman-guardian-angel | `assets/branding/guardian-angel-banner.png` (create) | add banner `<img>` at top |
| drenyra-skills | (planned) | — |

The vector SVG in drenyra-ai stays in the repo as the **vector reference**
(the contract requires vectors for identity primitives); READMEs display the
generated PNG.
