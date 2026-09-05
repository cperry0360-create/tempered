# Tempered

A health and training tracker with an RPG progression layer. Real training data drives
character progression — a squat PR raises Might; ticking "I lifted" does not.

*Tempering* is strengthening metal through controlled stress **followed by rest**. That
is the whole product thesis: load and recovery, both rewarded, neither punished. The
word is used deliberately throughout the app and should not be replaced with generic
fitness language.

## For Claude Code

Read **`CLAUDE.md`** first. It is the contract and should be re-read at the start of
every session. Then follow **`docs/07-build-plan.md`** in order.

## Documents

| File | What it is |
|---|---|
| `CLAUDE.md` | Session contract. Non-negotiables, working rules, stack. |
| `docs/00-product.md` | Vision, loop, principles. |
| `docs/01-attributes-and-xp.md` | The XP engine. The heart of the app. |
| `docs/02-data-model.md` | Schemas and storage shape. |
| `docs/03-screens.md` | Every screen, specified. |
| `docs/04-design-system.md` | Type, colour, spacing, components. |
| `docs/05-workout-system.md` | Routines, sessions, progression rules. |
| `docs/06-battle.md` | The passive daily battle. |
| `docs/07-build-plan.md` | Phased plan with acceptance criteria. |
| `DECISIONS.md` | Claude's running log of anything not specified here. |

## Data

`data/` holds seed content and balance configuration as hand-editable JSON. Balance
constants live in `data/balance.json` and must never be hard-coded.

## Exercise art

The movement photographs in `art/exercises/` are not original work. Each one is two
frames — start and finish — of an exercise from the **[free-exercise-db][fedb]** archive
by yuhonas, released under the [Unlicense][unlicense] (a public domain dedication).
Tempered scales the two frames to a common height and joins them side by side; nothing
else about them is changed.

That archive inherited its imagery, by way of [wrkout/exercises.json][wrkout], from the
**[Everkinetic][everkinetic] open data project by Greg Priday**, which is licensed
**[CC BY-SA 4.0][ccbysa]**. Both downstream repositories relicensed the set as public
domain. Tempered does not rely on that: the images are attributed and shared alike as
though CC BY-SA 4.0 still bound them, which satisfies either reading.

**Third-party exercise art is licensed separately from Tempered's source code and
first-party art. A repository-level licence never automatically relicenses the files in
`art/exercises/`.** `art/exercises/SOURCES.json` records the exact archive entry,
revision and modification behind every file, and the live app carries the attribution
in **Settings → Credits** so it travels with the published images.

[fedb]: https://github.com/yuhonas/free-exercise-db
[unlicense]: https://unlicense.org
[wrkout]: https://github.com/wrkout/exercises.json
[everkinetic]: https://github.com/everkinetic/data
[ccbysa]: https://creativecommons.org/licenses/by-sa/4.0/

## The backdrop

The night-forest artwork behind every screen — `art/dist/bg-night-forest.jpg` — is
**Cory's own original work**, and the app's colour scheme is sampled from it: the ground
gradient, the card surfaces, and all five attribute colours. See
`docs/11-structure-and-feel.md` section E. `art/dist/` is the canonical runtime location;
there is no second source copy of this same file.

Unlike the exercise photographs, there is no third-party licence question here. It is
first-party art, and the palette derived from it is first-party too.

## Deployment

The live app is served publicly by **Netlify**, from the repository root. The GitHub
repository also remains public. There is no build step, so what is committed is what is
served — `netlify.toml` only names the publish directory and sets cache headers.

The public deployment is intentional. Because the exercise images are published with
the app, the required provenance/licensing notice is carried inside the product under
**Settings → Credits** rather than relying only on this README.

## Status

Tempered is built and deployed as a static PWA; `docs/07-build-plan.md` records completed
phases and the remaining roadmap.
