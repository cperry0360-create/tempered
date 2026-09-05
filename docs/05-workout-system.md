# 05 — Workout system

The deepest feature. Build it before the RPG surface. If logging is slow, nothing else
matters.

## Speed targets

These are acceptance criteria, not aspirations.

- A full lower-body session: **under 90 seconds of tapping** across the whole session.
- An ad-hoc set of curls: **under 20 seconds from app open to logged.**
- Last performance and PR visible **before** the first set is entered.

## Entry points

> **Superseded in part by `docs/10-task-model.md`.** This document assumed a session is
> the only way to log work. It is not: the unit is the **exercise slot**, and a session
> is one convenient way to complete several at once. A slot can be opened and completed
> on its own, from Today, with no session ceremony at all. Read `docs/10` alongside this.
> Everything below about the set row, records, rest and the post-session screen still
> holds — it describes how logging works, whichever path reaches it.

### Full session — one path among several

Start a routine. Exercises in order. Each shows: name, variant, last performance, PR,
prescribed sets/reps/weight, and a rest timer. Log each set. Finish.

The set row is the centre of the app:

```
SET   RECORD        LBS    REPS    ✓
1     160 lbs × 8   [160]  [8]     [✓]
2     160 lbs × 8   [160]  [8]     [ ]
3     160 lbs × 8   [160]  [8]     [ ]
              + ADD SET
```

- Weight and reps are **pre-filled from last performance.** The common case is repeating
  last session, which must then be one tap per set.
- Tapping the check logs the set, starts the rest timer, and advances focus.
- Tapping a number opens a numeric keypad, not a system keyboard.
- Rest timer counts down inline on the exercise, not as a modal.
- An active workout is continuously checkpointed. Locking the phone, backgrounding the installed app, or an iOS process restart must reopen the same workout with checked sets and in-progress fields intact instead of routing to Today.

### Ad-hoc single exercise

Open one exercise directly from Today or from the library, without a routine. Shows last
performance immediately, logs sets identically. Creates a `Session` with
`routineId: null`.

This is a first-class feature, not a shortcut. Some days are one exercise.

### Program slot as a task

The day's prescribed slots appear on Today as independently completable items, and roll
forward through the program week. See `docs/10-task-model.md`. Logging inside a slot is
identical to logging inside a session — the same set row, the same records, the same XP.

## Progression rules

Per exercise, stored in the exercise record, defaulting per its `progression` field.

- **`531`** — Wendler cycles. Working weight derived from a training max; the app tracks
  the cycle position and prescribes the week's sets.
- **`linear`** — add the smallest increment when all prescribed sets hit the top of the
  rep range. Increment defaults: 5 lbs upper, 10 lbs lower, configurable.
- **`reps`** — bodyweight. Progress by adding reps, then by adding load.
- **`time`** — progress by adding seconds.
- **`load`** — carries. Progress by load first, then distance.

**The app proposes, never imposes.** A suggested increase appears as a prefilled value
the user can overwrite. Never auto-advance a weight the user did not confirm.

## Records

Tracked per exercise: best weight-for-reps, best single-session volume, best estimated
1RM (Epley). A new record is surfaced immediately in the set row and again in the
post-session summary, badged.

## Post-session — one screen

Ascent uses four sequential modals for this. Use one scrollable screen with a single
dismiss:

1. **What you did** — routine, duration, total volume, sets completed
2. **What broke** — any PRs, badged
3. **What grew** — attribute XP with the causal line, e.g. *"Might +340 — 1,840 lbs of
   compound volume, one weight PR"*
4. **What levelled** — if anything crossed a threshold
5. **What's next** — the current or newly issued directive

One "Done". Nothing is behind a second dismiss.

## Rest timer

Per-exercise default, editable. Counts down inline. Does not block logging the next set
if the user is ready. No notification in V1, no sound unless the user enables one.
