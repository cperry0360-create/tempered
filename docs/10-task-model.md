# 10 — The task model

Correcting a wrong assumption in `docs/05-workout-system.md`. That document treats a
session as the only way to log work: start a routine, work through it, finish. In
practice the block is one mode among several.

**How training actually happens here.** Sometimes the whole block gets done in one go.
Often it does not. Exercises get picked off across the day or across the week. An
unfinished Monday is not a failed Monday. It is work still available this program week.

So the stored unit is not the session. **The unit is the exercise slot**, and a session
is one convenient way to complete several at once.

---

## The model

Each exercise slot in a program day is independently completable.

- **Complete one without running the whole block.** Open it, log the sets, done.
- **Today groups the week's slots by exercise.** If the same movement appears twice,
  Today shows one row such as `0 / 2 this week`, while the domain still tracks the two
  underlying `(programDayId, slotIndex)` items separately.
- **The grouped row must preserve the prescription.** Frequency is not a substitute for
  the work itself. A weekly row shows both sets × rep range and weekly progress, and opens
  the next unfinished occurrence.
- **Unfinished slots roll forward.** They stay available for the rest of the program
  week rather than expiring at midnight. Monday's laterals can be done Thursday.
- **Running the block still works** and completes several slots at once. It is a
  shortcut, not the only path.

This program-slot model is separate from **lifestyle cadence**. Non-workout activities are
OFF, DAILY or X/week in the profile's `activitySchedule`. X/week counts distinct calendar
days on which the activity was logged. Cadence controls placement and frequency display,
not XP.

## Weekly hard-set targets

The program specifies weekly volume ranges per muscle group — Chest 12–16, Back 14–18,
Quads 10–14, Hamstrings/glutes 10–14, Shoulders 12–18, Arms 8–12 and Core 6–10.
Groups without a configured range are still counted and shown; the app does not invent
a target for them.

The weekly view shows **hard sets completed against target, per muscle group**, derived
from logged sets and the exercise library's muscle activation data. This is why rollover
matters: work not finished on the named program day can still contribute later in the
same week.

## Rules

**Rollover is within the program week, not indefinite.** At the week boundary the slate
resets to the new week's prescription. Outstanding work from a finished week is gone,
not accumulated. Accumulating it would turn the app into a debt tracker.

**Completion is derived, not stored.** A slot is done when the current program week's logs
for its `(programDayId, slotIndex)` reach the prescribed set count. The week boundary
therefore clears old outstanding work by asking a new week, not by running a reset job.

**No overdue state.** Outstanding is outstanding. Nothing turns red, nothing is "late",
nothing accrues a penalty. An unfinished slot is neutral until the week ends, then it
simply stops belonging to the current week.

**The old whole-Today one-view rule is superseded.** The **DAILY section must fit one
6.1-inch phone view** because it is the immediate day surface. **THIS WEEK sits below it
and may scroll.** Weekly work remains visible and honest about its frequency instead of
being compressed or represented as today's obligation. See `docs/03-screens.md`.

**XP is path-independent.** A slot completed alone earns exactly what it earns inside a
block. Lifestyle cadence likewise never changes an activity's reward.

**Grit still counts showing up.** A day on which any slot was completed counts as a
training day even if no full block was run. The app uses one day session record so the
flat showing-up sources cannot be paid repeatedly for several micro-set entries.

## Acceptance

- An exercise can be opened and completed from Today without running the whole program day.
- A grouped weekly exercise row shows both its sets × rep-range prescription and its X/week
  progress.
- An unfinished Monday slot is still completable on Thursday of the same program week.
- At the program week boundary, outstanding slots clear rather than carry.
- The weekly view shows hard sets against target per muscle group, derived from logged
  data, not hand-entered.
- Nothing anywhere renders an outstanding item as overdue, late, missed or failed.
- A day of micro sets with no full-block ceremony still accrues Grit.
- The DAILY section fits one phone view; THIS WEEK is allowed to scroll below it.

---

# Version visibility

There is no build step, so nothing generates a version. The repository owns one visible
identity in `src/version.js`.

- `VERSION` includes a semantic build version and **names the last completed phase from
  `docs/07-build-plan.md`** in parentheses, e.g. `0.4.0 (3.6)`.
- The browser acceptance test must verify that the parenthetical phase actually resolves
  to a Phase heading in `docs/07`; checking only that parentheses contain digits is not
  enough.
- The version is displayed in Settings alongside the last-updated date.
- The service-worker cache key derives from the same `VERSION` constant.
- A phase completion bumps it in the same change and records that decision in
  `DECISIONS.md`. Maintenance/cleanup work may patch the semantic version while continuing
  to name the last completed product phase.

The reason this matters: with a PWA installed to a home screen, there is no address bar
and no ordinary reload button. The visible version and Settings update check distinguish
a build that failed to deploy from one that deployed but did not change the observed
behavior.
