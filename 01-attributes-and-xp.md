# 01 — Attributes and the XP engine

This is the heart of the app. Everything else is a view onto it.

## The five attributes

| Attribute | Grows from | Tier names (L0 to L10) |
|---|---|---|
| **Might** | Heavy resistance training | Untrained, Novice, Capable, Strong, Powerful, Formidable, Elite, Brutal, Titanic, Monstrous, Mythic |
| **Wind** | Cardiovascular work | Sedentary, Winded, Steady, Enduring, Tireless, Relentless, Swift, Effortless, Boundless, Untiring, Immortal |
| **Grit** | Showing up over time | Untested, Willing, Consistent, Dependable, Disciplined, Unwavering, Ironclad, Immovable, Indomitable, Absolute, Adamant |
| **Vitality** | Recovery, sleep, fuel, hydration | Depleted, Fragile, Recovering, Steady, Restored, Robust, Vigorous, Thriving, Radiant, Peerless, Undying |
| **Mind** | Learning, focus, stillness | Idle, Curious, Attentive, Studious, Sharp, Incisive, Astute, Penetrating, Luminous, Profound, Transcendent |

Five is deliberate: enough that a bad week in one area does not stall everything, few
enough to hold in your head.

## Rule zero: measured beats marked

Every XP source is one of two kinds.

- **Derived** — computed from logged performance data. Always used where data exists.
- **Marked** — a completion toggle. Only where no meaningful measurement exists.

If an activity can be measured, it must not be a checkbox.

## Might — derived only

Might responds to load, not attendance.

| Source | Formula | Notes |
|---|---|---|
| Working volume | `sum(weight x reps)` over the session | The base signal |
| Weight PR | new heaviest set for an exercise | Large one-off bonus |
| Volume PR | new heaviest single-session volume for an exercise | Medium one-off bonus |
| Estimated 1RM gain | Epley: `w * (1 + reps/30)` | Rewards intensity over junk volume |

Compound lifts count fully, isolation at a reduced rate. The classification lives in
`data/exercises.json`, not in code.

**Diminishing returns within a session.** Volume XP uses a soft cap so a two-hour junk
session does not outscore a hard 45 minutes. See `data/balance.json`.

## Wind — derived only

| Source | Formula |
|---|---|
| Run/ride distance | per mile, flattening past a daily threshold |
| Cardio minutes | per minute at moderate or above |
| Steps | per 1,000, capped daily |
| Pace improvement | bonus when pace beats a rolling 30-day baseline |

Pace improvement stops Wind becoming a step-count grind.

## Grit — consistency without streak pressure

| Source | Formula |
|---|---|
| Session completed | flat, any training type |
| Training hours | accumulating total crossing thresholds |
| Weeks meeting plan | sessions >= plan target in a calendar week |
| Return after a gap | bonus for the first session back after 4+ days off |

That last row matters. Coming back is the hardest single act in fitness. The app rewards
it rather than punishing the absence before it.

**Grit has no streak multiplier.** Streaks display for information only. They never
multiply XP, because that creates the anxiety this app exists to avoid.

## Vitality — mixed

| Source | Kind | Formula |
|---|---|---|
| Sleep duration | derived | Peaks in the 7 to 9 hour band. More is not better. |
| Hydration | derived | per ounce, capped |
| Protein target met | derived | when nutrition is logged |
| Nutrition logged | marked | the act of logging honestly |
| Rest day taken | marked | a rewarded action, not an absence |
| Body metrics logged | marked | the habit only |

**Never score the weight value.** Not the number, not the direction, not the delta. The
app rewards the act of measuring and nothing else. Hard rule.

## Mind — mostly marked

Reading, study, language practice, instrument, meditation, journaling. Duration-scaled
where a duration is logged, otherwise flat.

## Character rank

Derived from the five attributes, never tracked separately. Ranks F, E, D, C, B, A, S.
Rank is a summary, never a currency.

## Levelling curve

Per-attribute XP uses a smooth superlinear curve defined in `data/balance.json`.

- Level 1 reachable inside the first session.
- Levels 1 to 3 inside the first two weeks of honest use.
- Level 10 represents roughly a year of consistency.
- The curve is data, not code.

**You must produce a projection table.** For a simulated user training 4x/week at
realistic loads, show each attribute's level at 30, 90, 180 and 365 days, in
`docs/BALANCE-PROJECTION.md`. If any attribute maxes before day 300, or fails to reach
level 3 by day 60, retune before proceeding.

## Directives

A generated short-term goal shown after a workout.

> **THRESHOLD** — Reach Grit level 4. Two sessions remaining.

One active at a time. Always achievable within about two weeks. Derived from whichever
attribute is nearest its next threshold. Never requires consecutive training days.

## Titles

Permanent awards for crossing thresholds. Flavour only, no mechanical effect.
Full list in `data/titles.json`.
