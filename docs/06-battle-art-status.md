# Battle art status

The battle UI is now wired to canonical sprite slots without changing any battle rule.

## Runtime behavior

- The hero looks for `art/battle/hero.png`.
- Each enemy looks for `art/battle/enemies/<enemy-id>.png`.
- Cosmetic loot looks for `art/battle/items/<item-id>.png`.
- Missing art never breaks the battle. The existing Tempered glyph remains visible until the PNG loads successfully.
- Battle math, deterministic resolution, rewards, skip behavior, and the passive-only product rule are unchanged.

## Remaining art work

The PNGs themselves still need to be produced and reviewed. The exact file list, dimensions, orientation, palette family, and transparent-background rules are in `art/battle/README.md`.

This split is deliberate: art can now be iterated independently without touching combat logic or screen code.
