# 03 — Screens

Four tabs. Settings lives behind a gear on Character, not as a fifth tab.

```
TODAY        TRAIN        CHARACTER        HISTORY
```

Rationale: the competitor apps use five or six tabs and it thins each one out. Four is
enough because Today is where you act, Train is where you work, Character is the reward,
and History is the evidence.

---

## TODAY — the landing screen

Opens here. Answers two time questions without turning either into a debt list: what is
for today, and what is still available this week.

**Structure, top to bottom:**

1. **Header and XP strip** — Today plus the five attribute bars showing what moved today.
2. **DAILY** — activities whose profile cadence is DAILY. Each row: icon, name, the unit
   it wants, and either a one-tap mark or a number field plus confirm. A goal-based daily
   tracker such as steps remains here until the configured daily target is reached.
3. **THIS WEEK** — the program's exercise work plus lifestyle activities set to X/week.
   Repeated exercises are grouped into a weekly frequency row, but the row still shows
   the movement's actual sets × rep-range prescription. Clicking it opens the next
   unfinished occurrence. Weekly work rolls within the program week and may scroll.
4. **LOG SOMETHING ELSE** — one control opening activities whose cadence is OFF. These are
   the same logging controls and earn exactly the same XP. Piecewise numeric trackers stay
   editable after the first entry so another glass/minutes can be added or the day's total
   corrected.
5. **COMPLETED** — collapsed by default, showing what has already been logged. Numeric
   values are shown back to the user, including body metrics even though the value itself
   is never scored.
6. **Primary FAB** — when a program prescribes a day for today, the floating bar's one
   circular acid action starts that whole day. Individual weekly exercise rows remain
   independently completable.

**Cadence.** The profile's `activitySchedule` is authoritative. Each activity is OFF,
DAILY, or X/week (1–7). `dailyActivityIds` remains only as a backwards-compatible mirror.
The seed's `daily` flag supplies the default cadence for a new/legacy profile; the current
seed defaults DAILY for sleep, nutrition logging, calorie tracking, alcohol-free day and
steps. Water, protein target, rest day, sauna, body metrics, mobility and Mind activities
start OFF unless setup changes them.

Cadence is **placement only**. OFF does not mean untracked and X/week does not change the
reward. Logging the same act produces the same XP regardless of where it appeared.

**One-view rule, superseded.** The old rule required the whole Today screen, including
training slots and every daily activity, to fit without scrolling. That no longer matches
the cadence model. The **DAILY section is the immediate day view and must fit in one
6.1-inch phone view**. **THIS WEEK lives below it and is allowed to scroll.** Weekly work
is intentionally not compressed or hidden merely to satisfy a whole-screen height target.

Sort by what is most likely next, not alphabetically. Never show a red state for
something merely not done yet. Absence is not failure.

---

## TRAIN

1. **Active program** — the program days, current week and weekly progress. Tap a day to
   run the whole block. The floating bar carries today's prescribed day as the one primary
   action when one exists.
2. **Routines** — repeatable routines. Each shows exercise count, set count and primary
   lift, with a neutral START action.
3. **Exercise library** — searchable. Tap any exercise to start an ad-hoc session with it.
4. **Hard-set guide** — weekly hard sets worked against the program's configured muscle
   group ranges, derived from logged sets rather than hand-entered totals.

The active workout view is specified in `docs/05-workout-system.md`.

---

## CHARACTER

The reward surface. Where progression is made legible.

1. **Rank and identity** — rank letter, name, current title.
2. **The five attributes.** Each row: name, level, tier name, progress bar and XP.
3. **Tap an attribute** to expand: exactly which XP sources feed it, what each is worth
   from current balance config, and this attribute's largest contributors to date. This
   view is the answer to "why did that go up", and it is mandatory.
4. **Active directive** — the current short-term goal and its progress.
5. **Titles** — earned, with the date and what earned them.
6. **Battle** — entry point to today's battle if unwatched, or its result if watched.
7. **Settings** — gear icon: profile/setup, cadence, data transfer, maintenance and version.

---

## HISTORY

Evidence. Three views behind a segmented control.

1. **Calendar** — a six-week grid. Each day shows a small mark for a session, a dot for
   activity, nothing for an untouched day. Tap a day to see it.
2. **Sessions** — reverse chronological list: routine, date, duration, volume, PR count.
3. **Records** — per exercise: best weight, best volume, best estimated 1RM, and a
   sparkline of working weight over time.

The sparkline matters. Seeing a lift climb over months is the evidence that the RPG layer
is attached to something real.

---

## SETUP — first run

Five steps, each skippable with a sensible default, re-runnable from Settings without
throwing away logged history.

1. Name and units
2. Sessions per week target
3. Pick the active training program
4. Optional starting working weights for primary lifts; real history outranks these once
   training begins
5. Set each non-workout activity to OFF, DAILY, or X/week; X/week also chooses 1–7

A genuinely new profile opens setup. A profile created before Phase 7 is treated as
already configured so an update never throws an existing user into onboarding. Setup ends
on Today, populated and usable.

---

## Empty and error states

Every screen needs an intentional empty state. Async startup, refresh, workout and battle
failures must render a recoverable state with retry/back actions rather than a blank app.
The user's stored data is left untouched by a failed screen load.
