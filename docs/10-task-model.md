# 10 — The task model

Correcting a wrong assumption in `docs/05-workout-system.md`. That document treats a
session as the only way to log work: start a routine, work through it, finish. In
practice the block is one mode among several.

**How training actually happens here.** Sometimes the whole block gets done in one go.
Often it does not. Exercises get picked off across the day, or across the week, from a
list of what is outstanding. An unfinished Monday is not a failed Monday — it is work
still available.

So the unit is not the session. **The unit is the exercise slot**, and a session is one
convenient way to complete several at once.

---

## The model

Each exercise slot in a program day is an independently completable item.

- **Complete one without starting a session.** Open it, log the sets, done. No routine,
  no session ceremony.
- **Today lists the day's prescribed slots as tasks**, showing what is outstanding and
  what is finished.
- **Unfinished slots roll forward.** They stay available for the rest of the program
  week rather than expiring at midnight. Monday's laterals can be done Thursday.
- **A weekly view** shows the week's prescribed work, what is done, and what remains.
- **Running the block still works** and completes several slots at once. It is a
  shortcut, not the only path.

## Weekly hard-set targets

The program specifies weekly volume ranges per muscle group — Chest 12–16, Back 14–18,
Quads 10–14, Hamstrings/glutes 10–14, Shoulders 12–18, and so on.

The weekly view should show **hard sets completed against target, per muscle group**,
derived from logged sets and the exercise library's muscle activation data. This is the
number that tells you whether the week actually worked, and it is the reason rollover
matters: three missed lateral raise sets on Monday are recoverable on Saturday.

## Rules

**Rollover is within the program week, not indefinite.** At the week boundary the slate
resets to the new week's prescription. Outstanding work from a finished week is gone,
not accumulated — accumulating it turns the app into a debt tracker, which is the
punishment pattern `CLAUDE.md` forbids.

**No overdue state.** Outstanding is outstanding. Nothing turns red, nothing is "late",
nothing accrues a penalty. An unfinished slot is neutral until the week ends, and then
it simply disappears.

**XP is unchanged.** A slot completed alone earns exactly what it earns inside a block.
Volume is volume. The path does not change the reward.

**Grit still counts sessions**, and a day on which any slot was completed counts as a
training day. Do not require a formal session for Grit to accrue, or micro-set days
would score zero on the attribute specifically about showing up.

## Acceptance

- An exercise can be opened and completed from Today without starting a session.
- An unfinished Monday slot is still completable on Thursday of the same program week.
- At the program week boundary, outstanding slots clear rather than carry.
- The weekly view shows hard sets against target per muscle group, derived from logged
  data, not hand-entered.
- Nothing anywhere renders an outstanding item as overdue, late, missed or failed —
  assert this against the copy, not just the styling.
- A day of micro sets with no formal session still accrues Grit.

---

# Version visibility

There is no build step, so nothing generates a version. Add one.

- A `VERSION` constant with the phase and a short build stamp, e.g. `0.4.0 (3.6)`.
- **Displayed in Settings**, plain text, alongside the last-updated date.
- **The service worker cache key derives from it.** Bumping the version therefore
  guarantees a clean sweep of old caches, which is the current mechanism for shipping
  an update at all.
- Bumped in the same commit as any phase completion. Note it in `DECISIONS.md`.

The reason this matters: with a PWA installed to a home screen, there is no address bar
and no reload button. Without a visible version there is no way to tell a build that
failed to deploy from a build that deployed and did not fix the problem.
