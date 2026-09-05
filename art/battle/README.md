# Tempered battle art contract

The daily battle is the only illustrated gameplay surface in Tempered. These files are presentation only. They never change combat math, rewards, XP, attributes, or progression.

## File layout

```text
art/battle/
  hero.png
  enemies/
    slime.png
    rat.png
    mushroom.png
    orc.png
    wight.png
    golem.png
    rhino.png
    wyrm.png
  items/
    ember_token.png
    wyrm_scale.png
    lantern_glass.png
    quiet_stone.png
    moss_charm.png
    cinder_nail.png
    owl_feather.png
    iron_ration.png
    cap_spore.png
    old_signet.png
```

## Sprite contract

- Transparent PNG.
- Pixel-art treatment, hard edges, no photorealism and no soft painted rendering.
- Hero and enemy canvas: 96 × 96 px.
- Design on a 32 × 32 logical pixel grid, exported at 3× nearest-neighbour scale.
- Hero faces right. Enemies face left.
- Shared foot baseline so swapping enemies never makes the arena jump.
- Keep the ordinary enemies inside roughly 80 × 80 px of the canvas. Bosses may use more of the 96 × 96 canvas, but the canvas itself never changes.
- No scenery, frames, labels, text, health bars, shadows baked into the PNG, or decorative background. The UI supplies those.
- Use the existing Tempered palette as the family: deep canopy/navy ground, lantern gold, wisp cyan, moss green, cap violet, pale text values. Individual enemies may emphasize different members of that palette.
- Readable silhouette beats detail. The sprite is shown on a phone at about 96 CSS px.

## Hero direction

A compact forged wanderer rather than a superhero. Practical training-derived fantasy gear, strong silhouette, restrained expression. The battle is the payoff for the tracker, not a separate cartoon franchise.

## Enemy silhouettes

- `slime`: low rounded blob, simple bright eyes.
- `rat`: low fast quadruped silhouette, long tail.
- `mushroom`: oversized cap and short body, unstable stance.
- `orc`: broad shoulders, heavy club or blunt weapon silhouette.
- `wight`: thin upright undead silhouette with ragged edges.
- `golem`: dense blocky body, ember/cinder cracks.
- `rhino`: large horned boss silhouette, front-heavy mass.
- `wyrm`: long elder-dragon/wyrm silhouette compressed to the shared arena canvas.

These descriptions define readability only. They are not permission to add extra mechanics or personality systems.

## Item icon contract

- Transparent PNG.
- 48 × 48 px canvas.
- Design on a 16 × 16 logical pixel grid, exported at 3× nearest-neighbour scale.
- One centered object only. No frame, text, rarity color, glow, or stat badge baked into the image.
- Items remain cosmetic and flavour-only in V1.

## Fallback behavior

The app is deliberately safe before every PNG exists. Each missing sprite or item icon falls back to the existing Tempered glyph. Once the PNG is added at the canonical path above, the same build uses it automatically with no data or logic change.
