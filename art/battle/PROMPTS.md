# Battle art generation brief

Use this brief for every Tempered battle asset so the set reads as one family.

## Shared sprite prompt

Create a single transparent-background pixel-art game sprite for Tempered, a dark tactical health-and-training RPG. Use a strict 32 × 32 logical pixel grid, intended to export at 3× nearest-neighbour as a 96 × 96 PNG. Hard pixel edges only. No antialiasing, no gradients, no painterly rendering, no text, no UI frame, no scenery, no cast shadow baked into the image. Strong readable silhouette at phone size. Restrained fantasy design, not cute chibi and not grim gore. Use the Tempered palette family: deep navy/canopy shadows, pale cool highlights, with selective lantern gold, wisp cyan, moss green, or cap violet accents. Keep the feet/body baseline consistent across the whole set.

The hero faces RIGHT. Every enemy faces LEFT.

### Hero

`hero.png`: compact forged wanderer. Practical layered training-derived fantasy gear, sturdy boots, simple shoulder protection, wrapped forearms, understated metal accents. Athletic but not bodybuilder exaggerated. Calm ready stance. The silhouette should read as someone strengthened through repeated work and recovery, not a superhero.

### Enemies

`enemies/slime.png`: low rounded green slime, simple bright eyes, broad squat silhouette, a few darker internal pixels for depth.

`enemies/rat.png`: lean cellar rat, low fast quadruped pose, long tail, alert ears, slightly oversized readable head.

`enemies/mushroom.png`: mad mushroom creature, oversized violet cap, short crooked body, unstable forward-leaning stance.

`enemies/orc.png`: broad orc brute, thick shoulders, simple blunt club silhouette, heavy stance, muted moss/iron palette.

`enemies/wight.png`: thin barrow wight, upright undead silhouette, ragged cloak/body edges, cold cyan highlights, no gore.

`enemies/golem.png`: dense blocky cinder golem, heavy square torso and limbs, dark stone body with sparse ember-gold cracks.

`enemies/rhino.png`: devil rhino boss, large front-heavy horned silhouette, armored hide shapes, intimidating mass without gore, uses more of the 96 × 96 canvas than normal enemies.

`enemies/wyrm.png`: elder wyrm boss, long dragon/wyrm body compressed into a readable coiled profile, ancient head and horns, dark navy body with selective cool highlights, uses most of the shared canvas.

## Shared item prompt

Create one transparent-background pixel-art loot icon for Tempered. Use a strict 16 × 16 logical pixel grid, intended to export at 3× nearest-neighbour as a 48 × 48 PNG. One centered object only. Hard pixel edges, no antialiasing, no text, no UI frame, no rarity glow, no scenery. Same restrained dark tactical palette as the battle sprites.

### Items

`items/ember_token.png`: small worn metal token with one ember-gold hot edge.

`items/wyrm_scale.png`: one thick overlapping dragon scale, cold dark blue with a pale edge.

`items/lantern_glass.png`: one angular shard of old lantern glass, smoky cyan with a warm reflected pixel cluster.

`items/quiet_stone.png`: one smooth oval stone, dark cool grey-blue, plain and weighty.

`items/moss_charm.png`: tiny tied charm partly wrapped in moss green growth.

`items/cinder_nail.png`: one heavy black iron nail with a faint ember-hot tip.

`items/owl_feather.png`: one narrow owl feather, pale grey with dark banding.

`items/iron_ration.png`: one dense rectangular wrapped ration, iron-grey and deliberately plain.

`items/cap_spore.png`: one small violet mushroom spore pod, subtly luminous but with no glow outside the object silhouette.

`items/old_signet.png`: one worn signet ring with an unreadable flattened crest.

## Export rule

The final repository files must match `ASSETS.json` exactly. Do not change canvas size to fit a design. Scale the design inside the fixed canvas instead.
