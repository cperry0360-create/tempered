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

**Cadence is placement, never scoring.** OFF, DAILY and X/week decide where an activity
appears on Today. The same logged act earns the same XP whichever cadence the user chose.
Changing cadence never logs, unlogs, adds or removes XP.

## Might — derived only

Might responds to load, not attendance.

| Source | Formula | Notes |
|---|---|---|
| Working volume | `sum(weight x reps)` over the session | The base signal |
| Weight PR | new heaviest set for an exercise | Large one-off bonus |
| Volume PR | new heaviest single-session volume for an exercise | Medium one-off bonus |
| Estimated 1RM gain | Epley: `w * (1 + reps/30)` | Rewards intensity over junk volume |
| Loaded carries | load carried × distance | Scaled per 100 feet |

Compound lifts count fully, isolation at a reduced rate. The classification lives in
`data/exercises.json`, not in code. Bodyweight movements may carry a fixed exercise-level
`notionalLoad`; it is never derived from the user's body weight.

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
| Time under load | continuous XP from measured training duration |
| Weeks meeting plan | sessions >= plan target in a calendar week |
| Return after a gap | bonus for the first session back after 4+ days off |

### What counts as a session

**A session counts for Grit only if at least one set was logged.** Opening a session and
closing it without logging anything earns nothing, from any Grit source.

This is not a volume threshold and must never become one. Three sets of laterals is
showing up. Nothing is not. The test is whether anything was recorded, never whether
enough was.

Three consequences, all deliberate:

- **The guard covers every Grit source, not just the flat one.** Time under load, the
  return bonus and the weekly plan bonus all rest on the same premise — that a session
  happened. An empty session must not pay any of them, or the hole simply moves.
- **"Any training type" fixes the rate, it does not excuse logging nothing.** A cardio
  session earns the same flat amount as a lifting one, but it still has to record what
  it covered.
- **A warm-up set counts.** The rule is "at least one set". Might already declines to
  pay for warm-ups, which is the right place for that distinction; Grit is about
  showing up, and a warm-up is showing up.

Training duration is **time under load**, not the wall-clock span between the first and
last micro-set of a day. Set logs are grouped into sittings using the configurable gap in
`data/balance.json`; gaps between sittings earn nothing. Grit time XP accrues smoothly from
that duration, not at whole-hour thresholds.

An empty session is not stored as a completed one either. A stored empty session is not
inert: it would count toward the week's session total and reset the days-since-last-session
clock, inflating one bonus and swallowing another. It is discarded, and the session closes
without a summary — there is nothing to summarise, and a summary reporting zero reads as
a rebuke, which this app does not do.

**The general rule this comes from.** Where a measurement exists, score the measurement.
Where an attribute pays for an action instead, the action must be one the user deliberately
took and the app can see evidence of — logging nutrition, marking a rest day, recording
body metrics. Opening a screen is not an action. Any flat award must name the evidence it
requires, or it pays for navigation.

That last row matters. Coming back is the hardest single act in fitness. The app rewards
it rather than punishing the absence before it.

**Grit has no streak multiplier.** Streaks display for information only. They never
multiply XP, because that creates the anxiety this app exists to avoid.

## Vitality — mixed

| Source | Kind | Formula |
|---|---|---|
| Sleep duration | derived | Peaks in the 7 to 9 hour band. More is not better. |
| Hydration | derived | per ounce, capped |
| Protein target met | marked | one tap for meeting the user's target |
| Nutrition logged | marked | the act of logging honestly |
| Calories tracked | marked | rewards tracking; the calorie number itself is not scored |
| Alcohol-free day | marked | one tap for the day |
| Rest day taken | marked | a rewarded action, not an absence |
| Sauna | marked | one tap for the recovery habit |
| Body metrics logged | marked | the habit only |

**Never score the body-metric value.** Not the number, not the direction, not the delta.
The app rewards the act of measuring and nothing else. Hard rule.

## Mind — mostly derived

Reading, study, instrument practice and meditation scale with logged duration. Journaling
is a marked action. The attribute has a daily cap in `data/balance.json` so duration work
cannot become an XP grind.

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
