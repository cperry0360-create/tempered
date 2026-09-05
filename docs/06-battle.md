# 06 — The daily battle

A very small optional turn-based RPG encounter. It exists because real training has made the character stronger, but playing the battle never creates character progression.

## Purpose

The battle is a payoff for the tracker, not a second progression loop. Attributes become visible combat stats so the character feels different as real-world training improves.

## Daily rules

- **One encounter per day**, generated from `seed = hash(profileId + date)`.
- **Deterministic daily setup.** The enemy gauntlet and daily reward are fixed for the day. Reopening cannot reroll loot.
- **Optional interaction.** The player may use ATTACK, GUARD and SKILL, or choose AUTO or SKIP immediately.
- **No punishment.** Leaving, losing, auto-resolving or skipping never removes anything.
- **No character XP from battle.** Attribute progression comes only from real training and lifestyle data.
- **Rewards are fixed once.** The daily gold/item reward is granted when the encounter is generated, so manual play can never become a farmable progression source.
- **Persistent turn state.** If the app is closed or backgrounded during a battle, reopening resumes the same turn state.

## Hero stats, derived from attributes

Nothing here is separately trainable. The battle reads the character.

| Combat stat | Derived from |
|---|---|
| Health | Vitality, plus a smaller contribution from Grit |
| Damage | Might |
| Dodge opportunity | Wind through attack-speed growth |
| Critical chance | Mind |
| Defence | Grit |

Exact coefficients and turn tuning live in `data/balance.json`.

## Turn controls

### ATTACK

A normal deterministic hit. Might sets base damage, Mind can produce a critical hit, and the day's seed plus turn number decides the damage roll.

### GUARD

The hero does not attack that turn. Incoming damage is reduced and one Focus is restored, up to the Focus cap.

### SKILL

A heavier attack that costs one Focus. It uses the same real-world-derived damage and critical stats rather than introducing a separate skill tree.

### AUTO

A tiny deterministic AI finishes from the current turn state. It uses Skill when useful, Guard when hurt, and otherwise attacks.

### SKIP

Instantly shows the already-generated canonical daily result. This is always available and never changes the daily reward.

## Focus

Focus is a small battle-only action resource. It is not XP, currency, an attribute, or persistent progression. V1 starts each replay with the configured Focus amount.

## The gauntlet

A short sequence of enemies scaled to rank, ending with a tougher enemy. The daily roster remains deterministic and uses `data/enemies.json`.

The existing passive resolver remains the canonical daily outcome used for difficulty fitting and SKIP. The turn layer is intentionally small and sits on top of that stable daily generation.

## Rewards

Gold and occasionally one cosmetic/flavour item. **No character XP.** Items never modify an attribute or combat stat.

Rewards are locked and granted when the daily encounter is generated. That means manual play is for fun only and cannot be optimized into extra character progression.

## Presentation

This is the one place theatricality is allowed. Pixel sprites, readable HP/Focus meters, floating damage/log lines, and strong action buttons are appropriate. Everything else in the tracker stays quiet.

The visual target is a clean 16-bit tactical RPG surface: dark navy UI, crisp pixel combatants, a restrained night-forest palette, and obvious ATTACK / GUARD / SKILL / AUTO / SKIP controls.

## Art required

Hero sprite, eight enemy sprites, and a small set of item icons. Exact file names, sizes and production rules live in `art/battle/ASSETS.json`, `art/battle/README.md`, and `art/battle/PROMPTS.md`.
