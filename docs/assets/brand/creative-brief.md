# Drenyra Brand — Creative Brief (Art Direction)

> **Normative layer:** [`brand-system.md`](../../../contracts/brand-system.md) (v0.2)
>
> + [`tokens.json`](../../../contracts/brand-system/tokens.json) — the palette is
> law (Dreamcoder canonical: Anthracite Steel dark `#070A13` / Cocoa-Lúcuma light `#F3EADC`; cocoa `#824F16` / terracotta `#A7471C` accents).
> **This brief is the ART DIRECTION layer**: it decides what the banners SAY
> and how they FEEL, within the law. Prompts in `gpt-image-prompts.md` encode it.

## The vision (one sentence)

Premium art that fuses **radical minimalism with obsessive maximalism** —
the restraint of a gallery piece, the density of a world-build; a Dieter Rams
object photographed by a fashion campaign on a Syd Mead set.

## The synthesis — six principles

1. **One hero, infinite craft.** A single focal element rendered with
   pathological fidelity (sculptural form, machined edges, optical material);
   everything else yields to it. If a banner has two competing ideas, it fails.
2. **Negative space as carved matter.** The warm-ivory editorial canvas is never "empty":
   it is atmosphere — subtle film grain, volumetric depth, soft light falloff.
   Minimalism of elements, maximalism of atmosphere.
3. **Light is the sculptor.** Cinematic, directional, volumetric: rim light
   tracing the hero's silhouette, soft god rays, caustics on glass/metal. The
   banner is lit like a museum piece, not rendered flat.
4. **Material honesty.** Machined metal, optical glass, liquid surfaces,
   structural drapery — never flat fills, never clip-art. Every surface reads
   as a real material under real light.
5. **Graphic tension.** Brutal precision (sharp geometry, exact angles) meets
   organic flow (draped curves, sweeping arcs). Minimalism of STRUCTURE,
   maximalism of DETAIL.
6. **The signature detail.** Each banner carries ONE intricate micro-detail
   that rewards close looking — an engraved seal, a circlet of hash glyphs, a
   fold of fabric — the "easter egg" of the composition.

## Reference anchors (for the model and for critiques)

| Domain | Anchor |
| --- | --- |
| Sci-fi production design | Syd Mead (Blade Runner citycraft, industrial elegance) |
| Cinematography | Roger Deakins (light as narrative) |
| Games | Halo Forerunner architecture (monolithic precision), Death Stranding (minimalism with scale), Control (brutalist-corporate) |
| Fashion | Issey Miyake pleats (structural drapery), Yohji Yamamoto (negative space), cyberpunk tailoring |
| Design masters | Dieter Rams (functional purity), Brancusi (sculptural reduction), Paula Scher (confidence — translated to form, since we have no text) |

## Composition rules

+ One focal hero, placed on the right third; deep negative space on the left
  for the README title to breathe (GitHub renders title over the banner).
+ Palette: ONLY the canonical tokens (dark theme primary). Gradients blend
  exclusively between tokens. The two aurora glows at 5-8% opacity are the
  only "atmosphere" allowed beyond surface/material.
+ No text, no letters, no numbers, no logos — the product name lives in the
  README. Typography is expressed through form (silhouette, rhythm), never
  through glyphs.
+ Aspect 1400:460; C2PA provenance kept.

## Per-product art directions (narrative concepts)

1. **Drenyra Command Center** — *the fiscal command deck.* A sculptural control
   surface, machined like an instrument of state: layered translucent consoles
   (precise geometry) crowned by the dual-approval seal — two interlocking
   arcs, one cocoa one teal, the checkmark as a single engraved point of
   light. Signature detail: the seal's engraving catches a rim light.
2. **Drenyra AI** — *the verified relic.* The receipt card is treated as a
   museum monolith: minimal slab, luminous engraved border, the checkmark as a
   sacred seal. Around it, an orbital circlet of hash-glyph blocks (machined
   beads) — the signature detail is the circlet's light path.
3. **Drenyra Pi** — *the pinned monolith.* One precision-machined cube, held by
   a slender pin, floating in carved space; three concentric machined tracks
   orbit it. Signature detail: the padlock rendered as a single engraved facet.
4. **Drenyra Engram** — *the memory cathedral.* A curved canopy of light-nodes
   (the lattice) like stained-glass structure over a lone document monolith.
   Signature detail: one node casts a tiny caustic onto the document.
5. **Drenyra Skills** — *the grimoire folios.* Three folio slabs with spines
   that drape like fabric (structural drapery), luminous edges; each carries a
   §-sigil formed by a single precise curve. Signature detail: the sigil's
   curve tip holds a point of light.
6. **Drenyra Guardian Angel** — *the frozen review dossier.* A candidate
   packet held in a precise archival frame, observed by two independent review
   lenses that never share a conclusion before inspection. Their evidence
   resolves into a canonical findings register, with a restrained refutation
   mark and a clear boundary to the professional's authority. Signature detail:
   two fine inspection lines converge on the dossier seal without becoming an
   approval mark.

## Iteration criteria (critique before you accept a generation)

Score each candidate 0-10; accept only 8+ on ALL:

1. **One hero** — exactly one focal element; nothing competes.
2. **Carved space** — the negative space has atmosphere, not emptiness.
3. **Material fidelity** — reads as machined/optical/fabric under light.
4. **Light** — directional, volumetric, tells the form.
5. **Signature detail** — one intricate micro-element exists and rewards zoom.
6. **Palette law** — only canonical tokens; coverage ≥ 0.92 (conformance).
7. **No text / no cartoon / no clip-art.**
8. **Museum test** — would it sit on a shelf next to premium objects, or
   look like a stock banner? If stock, regenerate.

## Workflow

1. Paste the full prompt (Shared DNA + product section from
   `gpt-image-prompts.md`) into ChatGPT Images 2.0.
2. Generate 3 candidates.
3. Score all 3 against the 8 criteria. Pick the best — or feed the lowest
   scores back into the prompt ("the negative space reads empty — make it
   atmospheric", "the hero has no material fidelity — machine it") and
   regenerate.
4. Validate with `bun run brand:conformance` (coverage ≥ 0.92) and
   `bun run brand:ecosystem` for the freeze gate.
