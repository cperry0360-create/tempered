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

## Status

Specification in progress. Not yet built.
