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

Opens here. Answers one question: what is outstanding right now.

**Structure, top to bottom:**

1. **Header** — date, and a single line of identity framing:
   *"Four things logged today. Each one is load on the bar."*
2. **Next session card** — if a session is due per the plan: routine name, exercise
   count, the primary lift and its working weight, and one primary button, `START`.
   If a session was already completed today, this becomes a summary instead.
3. **Outstanding** — the **daily** activities not yet logged today. Each row: icon, name,
   the unit it wants, and either a toggle or a number field plus confirm. **One tap or
   one number plus one tap.** Never more.
4. **This week** — weekly/frequency-based work sits below the day. It may scroll. A row
   shows progress against its weekly target rather than pretending all weekly work is
   due today.
5. **Log something else** — one control, opening the rest of the catalogue in the same
   chips and tiles. Not a menu, not a settings screen: the same controls, logged the same
   way, worth exactly the same.
6. **Logged** — collapsed by default, showing what is already done.
7. **Rest day** — always available as an explicit action, never buried. It is on the
   daily list by default and taking it off should be as deliberate as any other choice.

**The daily list.** Every activity carries a `daily` flag, set during setup and editable
after. Only daily activities appear on Today. The seed defaults to what a normal person
tracks every day — sleep, water, steps, nutrition, rest day — and everything else starts
off.

**One-view rule, superseded.** The old rule required the whole Today screen, including
training slots and every daily activity, to fit without scrolling. That no longer matches
the cadence model. The **DAILY section is the immediate day view and must fit in one
6.1-inch phone view**. **THIS WEEK lives below it and is allowed to scroll.** Weekly work
is intentionally not compressed or hidden merely to satisfy a whole-screen height target.

Sort by what is most likely next, not alphabetically. Never show a red state for
something merely not done yet — absence is not failure.

---

## TRAIN

1. **Routines** — the user's routines. Each shows exercise count, set count, and last
   performed. Tap to open detail: the exercise list with PR and last for each, and
   `START WORKOUT`.
2. **Exercise library** — searchable. Tap any exercise to start an ad-hoc session with
   it, or to view its history and records.
3. **Cardio** — log a run, ride, carry or bag session by distance or time.

The active workout view is specified in `docs/05-workout-system.md`.

---

## CHARACTER

The reward surface. Where progression is made legible.

1. **Rank and identity** — rank letter, name, current title.
2. **The five attributes.** Each row: name, level, tier name, a 4px progress bar, and
   XP as `current / next`. Accent colour per attribute per the design system.
3. **Tap an attribute** to expand: exactly which activities feed it, what each is worth,
   and this attribute's largest contributors to date, drawn from `lifetimeSources`.
   This view is the answer to "why did that go up", and it is mandatory.
4. **Active directive** — the current short-term goal and its progress.
5. **Titles** — earned, with the date and what earned them.
6. **Battle** — entry point to today's battle if unwatched, or its result if watched.
7. **Settings** — gear icon: units, plan target, export, import, re-run setup.

---

## HISTORY

Evidence. Three views behind a segmented control.

1. **Calendar** — a six-week grid. Each day shows a small mark for a session, a dot for
   activity, nothing for an untouched day. Tap a day to see it.
2. **Sessions** — reverse chronological list: routine, date, duration, volume, PR count.
3. **Records** — per exercise: best weight, best volume, best estimated 1RM, and a
   sparkline of working weight over time.

The sparkline matters. Seeing the deadlift line climb from 135 to 160 over months is the
single most motivating artefact the app can produce, and no competitor does it well.

---

## SETUP — first run

Five steps, each skippable with a sensible default, re-runnable from settings.

1. Name and units
2. Sessions per week target
3. Pick or confirm routines — seeded with the Upper/Lower protocol
4. Confirm working weights for the primary lifts
5. Which non-workout activities matter — sleep, water, reading, meditation, and so on

Ends on Today, populated and usable, in under two minutes.

---

## Empty states

Every screen needs one and they must not be apologetic. Not "No data yet" but
*"Nothing logged. The first entry is the hard one."* Empty states are the first thing a
new user sees and most apps waste them.
