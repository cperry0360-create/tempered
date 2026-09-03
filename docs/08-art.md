# 08 — Art

**Use free asset packs. Generate almost nothing.**

The whole product needs 27 assets. Roughly 26 of them exist already, free, under
permissive licences, made by people better at this than an image model. Generating them
costs a couple of hours and produces a worse, less consistent result.

Only the app icon should be original, because it is the one thing that should be yours.

---

## Recommended sources

| Need | Source | Licence | Why |
|---|---|---|---|
| Interface icons | **Phosphor Icons** | MIT | ~9,000 icons, six weights, clean at small sizes, SVG |
| Attribute glyphs, item icons | **game-icons.net** | CC BY 3.0 | ~4,000 single-colour game glyphs — anvil, chain, wind, potions, swords. Recolour in CSS. Purpose-built for exactly this. |
| Hero and enemy sprites | **Kenney** (kenney.nl) | CC0 | Roguelike and RPG packs. CC0 means no attribution required at all. |
| Alternative sprites | **0x72 DungeonTileset II** (itch.io) | CC0 | 16x16 dungeon set with a hero and a good enemy roster, animated frames included |

*Licences and availability as of early 2026 — verify before shipping anything public.
CC BY requires a credit line; CC0 requires nothing. Since this is personal use, either
is fine, but put the credit in the README anyway.*

---

## What this kills

- **All 12 item icons** — game-icons.net has better versions of every one. Search
  "sword", "helmet", "mail shirt", "ring", "amulet", "potion", "coins".
- **All 5 attribute glyphs** — game-icons.net has an anvil, a chain, wind lines, a
  crescent moon, and dozens of spiral and brain glyphs. Recolour per the design system.
- **Hero and all 8 enemies** — Kenney's roguelike pack and 0x72's dungeon set between
  them cover a hero, slime, rat, skeleton, orc, demon, big monster and a dragon.
- **Every interface icon** — Phosphor.

## Mapping the battle roster to what exists

Rename whatever you pick to the filenames the code expects. Nothing else changes.

| Needed | Look for |
|---|---|
| `hero.png` | any knight or adventurer idle frame |
| `enemy_slime.png` | slime / blob / ooze |
| `enemy_rat.png` | rat / rodent / giant rat |
| `enemy_mushroom.png` | mushroom / fungus / myconid — or substitute any small critter |
| `enemy_orc.png` | orc / goblin / brute |
| `enemy_wight.png` | skeleton / undead |
| `enemy_golem.png` | golem / elemental / rock creature |
| `enemy_rhino.png` | any large charging beast — or rename the enemy to fit the art |
| `enemy_wyrm.png` | dragon / wyrm / drake |

**If the art doesn't have it, rename the enemy rather than commissioning a sprite.**
`data/enemies.json` is data. A Devil Rhino can become a Chaos Beast for free.

---

## The one thing to make yourself

### `icon_app.png`

> A minimalist app icon. A single vertical steel bar, edge-on, glowing faintly orange
> along its lower third as if just drawn from a forge and cooling. Dark near-black
> background, subtle radial falloff. Flat vector-adjacent rendering, not photorealistic,
> not glossy, no bevel, no text, no border. Centred, generous margin. Square, 1024x1024.

Tempering: hot metal cooling. Not a dumbbell, not a sword, not a flame.

---

## Style coherence is the real risk

Mixing packs is how this goes wrong. Pick **one** sprite source for the hero and all
eight enemies so they share a palette and pixel density. Do not take the hero from
Kenney and the dragon from somewhere else.

Icons and glyphs can come from a different source than the sprites, because they live in
different parts of the app — flat UI versus the battle — and are never on screen
together.

---

## If you do want to generate instead

The full per-asset prompts are kept below for reference. They work, but read the section
above first — the packs will look better and take twenty minutes.

---

# Appendix: generating from scratch

## Delivery rules — read before generating anything

1. **One asset per generation.** Never ask for a sheet, grid or set. Every prompt below
   ends with an explicit instruction against it; leave that line in.
2. **Flat magenta background** (`#FF00FF`) unless the model reliably returns real
   transparency. The importer keys magenta out cleanly and it never occurs in the art.
3. **Name the file exactly** as the heading says. `hero.png`, `enemy_slime.png`.
4. **Generate at 1024x1024.** Models are bad at small output; downsampling a large
   render is how sprites have always been made.
5. **Chain the reference.** Get asset #1 right, then attach it to every subsequent
   prompt. Style drift across a set is what makes art look amateur.
6. Send them in a folder and the importer handles trimming, keying, scaling and packing.

---

## A. App icon — 1 asset

### `icon_app.png`

> A minimalist app icon. A single vertical steel bar, edge-on, glowing faintly orange
> along its lower third as if just drawn from a forge and cooling. Dark near-black
> background, subtle radial falloff. Flat vector-adjacent rendering, not photorealistic,
> not glossy, no bevel, no text, no border. Centred, generous margin. Square, 1024x1024.

The concept is tempering: hot metal cooling. Not a dumbbell, not a sword, not a flame.

---

## B. Attribute glyphs — 5 assets

Simple, single-colour, geometric. They sit at 24px next to attribute names, so they must
read at small size. The colour is applied in CSS — deliver them white on magenta.

Shared style line for all five:

> A minimal geometric glyph, pure white on flat magenta (#FF00FF). Solid shapes and
> clean lines, no gradients, no shading, no outline, no text. Bold enough to read at 24
> pixels. Centred with generous margin. Output ONE glyph only — no sheet, no grid, no
> variations. 1024x1024.

| File | Subject |
|---|---|
| `glyph_might.png` | A stylised anvil, reduced to three or four solid shapes |
| `glyph_wind.png` | Three parallel curved strokes suggesting moving air, tapering |
| `glyph_grit.png` | A simple interlocking chain of three links |
| `glyph_vitality.png` | A crescent enclosing a small solid circle — rest and recovery |
| `glyph_mind.png` | A single continuous line forming an open spiral |

---

## C. Hero sprite — 1 asset

The battle is the only theatrical place in the app, so this is pixel art.

### `hero.png`

> Pixel art game sprite in the style of late-1990s isometric RPGs. A lone figure in
> weathered dark leather and a deep blue tunic, a plain arming sword held low in the
> right hand, no shield, no cape. Practical and worn, not heroic or ornate. Standing
> idle, facing front-left three-quarter view. Camera slightly above, looking down about
> 30 degrees so the tops of the shoulders are visible.
>
> Rendered with baked lighting: one warm light from the upper left, soft ambient fill,
> clear highlight on top surfaces, shadow on the lower right. Muted palette, 30 to 40
> colours, subtle dithering. Orthographic, no perspective distortion.
>
> Flat pure magenta background (#FF00FF). Single figure, centred, feet at the bottom
> edge, no ground, no shadow, no text, no border. Output ONE sprite only — no sheet, no
> grid, no turnaround, no variations. 1024x1024.

**Get this one right before anything else in section C or D.** It is the style reference
for every sprite that follows.

---

## D. Enemy sprites — 8 assets

For each: **attach the finished `hero.png`** and use this wrapper.

> Match the art style, lighting angle, camera angle, colour depth and rendering of the
> attached reference exactly. Same flat magenta background, same framing, base at the
> bottom edge. Output ONE sprite only — no sheet, no grid, no labels. 1024x1024.
>
> Render instead: **[subject]**

| File | Subject |
|---|---|
| `enemy_slime.png` | A translucent green slime, roughly dome-shaped, with a darker undigested lump suspended inside it. Low to the ground. |
| `enemy_rat.png` | A dire rat the size of a large dog. Matted brown-grey fur, long naked tail, yellow incisors, small red eyes. Hunched on all fours. |
| `enemy_mushroom.png` | A mad mushroom creature. Bulbous spotted cap, stubby legs, a wide unsettling grin beneath the cap, spores drifting off it. |
| `enemy_orc.png` | An orc brute. Green-grey skin, crude hide armour over one shoulder, a notched cleaver, heavy underbite with tusks. Broad and stooped. |
| `enemy_wight.png` | A barrow wight. Animated skeleton in the rotted remains of fine burial clothes, a tarnished circlet, cold blue pinpoints in the eye sockets. |
| `enemy_golem.png` | A cinder golem. Humanoid construct of cracked dark stone with molten orange glowing through the fissures, heavy blocky limbs, no face. |
| `enemy_rhino.png` | A devil rhino. Armoured grey hide, iron-banded horn, small burning eyes, smoke from the nostrils. Massive, low, front-on aggressive stance. |
| `enemy_wyrm.png` | An elder wyrm. Deep red scaled dragon on all fours, wings half folded, long neck raised, snarling. Dark horns, amber eyes. |

---

## E. Item icons — 12 assets

Loot from the battle. Cosmetic only — they never modify stats.

Shared wrapper, again attaching `hero.png` as the style reference:

> Match the art style, lighting and colour depth of the attached reference. A single
> item on flat magenta (#FF00FF), viewed straight on, centred, generous margin. Pixel
> art game item icon, readable at 48 pixels. No ground, no shadow, no text, no border.
> Output ONE item only. 1024x1024.
>
> Render: **[subject]**

`item_sword_iron.png` — a plain iron arming sword, slightly notched
`item_sword_fine.png` — a finer sword with a brass crossguard
`item_axe.png` — a bearded hand axe with a worn wooden haft
`item_helm.png` — a dented open-faced iron helm
`item_mail.png` — a folded shirt of riveted mail
`item_plate.png` — a battered steel breastplate
`item_boots.png` — scuffed leather travelling boots
`item_ring.png` — a plain silver band with a small dark stone
`item_amulet.png` — a bronze amulet on a cord, simple engraved sigil
`item_potion_red.png` — a small round glass flask of red liquid, cork stopper
`item_potion_blue.png` — the same flask shape in blue
`item_gold.png` — a small loose pile of gold coins

---

## Order of work

1. `icon_app.png` — you'll want it early to install to the home screen
2. `hero.png` — iterate until right; it is the reference for everything after
3. The 8 enemies — the battle is unusable without them
4. The 5 attribute glyphs — quick, and they lift the Character screen
5. The 12 item icons — last; the battle works without them

Stop after step 3 if you want. Items and glyphs both have text fallbacks.

## Where they go

`art/source/` — the original 1024px files, committed
`art/dist/` — processed sprites the app loads

The importer handles keying, trimming, scaling and naming. Never hand-edit `dist/`.
