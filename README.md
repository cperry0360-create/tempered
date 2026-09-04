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
though CC BY-SA 4.0 still bound them, which satisfies either reading. The images remain
under CC BY-SA 4.0; the rest of this repository does not.

`art/exercises/SOURCES.json` records the exact archive entry, revision and modification
behind every file, so any picture can be traced back to its origin.

[fedb]: https://github.com/yuhonas/free-exercise-db
[unlicense]: https://unlicense.org
[wrkout]: https://github.com/wrkout/exercises.json
[everkinetic]: https://github.com/everkinetic/data
[ccbysa]: https://creativecommons.org/licenses/by-sa/4.0/

## Status

Specification in progress. Not yet built.
