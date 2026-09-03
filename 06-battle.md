# 06 — The daily battle

Passive. Thirty seconds. Costs no interaction and no progression if ignored.

## Purpose

A payoff that arrives *because* of the week's training, not because of skill at a game.
It exists so attributes have a visible consequence beyond a number going up.

## Rules

- **One per day**, generated from `seed = hash(profileId + date)`.
- **Deterministic.** Re-resolving the same seed gives an identical result. Loot cannot
  be rerolled by replaying.
- **Fully passive.** No input. Playback controls are pause, 1x, and skip-to-result.
- **Skipping is never punished.** A user who never opens this screen loses nothing but
  the flavour; rewards are granted on generation, not on watching.

## Hero stats, derived from attributes

Nothing here is separately tracked or spendable. The battle reads the character.

| Combat stat | Derived from |
|---|---|
| Health | Vitality, plus a small contribution from Grit |
| Damage | Might |
| Attack speed | Wind |
| Crit chance | Mind |
| Defence | Grit |

Exact coefficients in `data/balance.json`. Tune so the gauntlet is winnable but not
trivially so at every rank — target roughly an 80% clear rate.

## The gauntlet

A short sequence of enemies scaled to rank, ending in one tougher enemy. Six or so,
resolved in sequence. Enemy roster in `data/enemies.json`.

Resolution is a simple deterministic exchange loop. This does not need to be a good
combat system; it needs to be a legible thirty seconds. Do not add depth here.

## Rewards

Gold and a small XP contribution. Occasionally an item.

**Items are cosmetic and flavour only in V1.** They do not modify attributes or combat
stats, because attributes must remain a pure reflection of real behaviour. An item that
raised Might would break the entire premise.

## Presentation

This is the one place theatricality is allowed. Pixel sprites, floating damage, a
victory flourish. Everything else in the app stays quiet. Do not let this treatment leak
into the tracker.

## Art required

Hero sprite, roughly eight enemy sprites, a handful of item icons. That is the entire
art requirement of the product.
