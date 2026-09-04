# 09 — Tracker v2

Written after using the Phase 3 tracker and comparing it to two apps Cory actually
trains with. Three groups of work: a new program model, missing tracker features, and a
UI that is currently too flat to read in a gym.

**This is not a rewrite.** The domain layer, XP engine and persistence are correct and
stay. This is the tracker surface and the program data above it.

---

## A. Programs, not just routines

The active plan changed. It is a **time-boxed program**, which the current model cannot
express.

`data/programs.json` now holds *November Physique Sprint* — five days, thirty exercise
slots, seventeen unique movements, eight weeks with a deload at week 8.

What a program has that a routine does not:

- **A week index.** Progression rolls over week to week, not session to session.
- **Rep ranges, not fixed reps.** `4 × 6–10`, not `4 × 8`. The range is the prescription;
  where you land inside it is the performance.
- **Rest ranges.** `Rest 2–3 min`, not a single number.
- **Per-side sets.** One-Arm Dumbbell Row is `3 × 8–12 / side`.
- **A deload week** where the instruction is to hold weight, not add.
- **Setup and cue text** per exercise: *"Incline bench + rack"*, *"Lower to the upper
  chest. Press up and slightly back."*

Keep routines. Programs are a superset — a routine is a program of one week with fixed
reps. Do not fork the session logic.

**Might XP is unaffected.** Volume is still weight × reps of what was actually performed.
Ranges change the prescription, never the scoring.

---

## B. Missing tracker features

All six came from real use. None is optional.

1. **Edit rest time per exercise, in the session.** Currently fixed from seed data. The
   rest timer is the most-adjusted number in a real workout.
2. **History button on every exercise.** Open an exercise mid-session and see its
   recent sessions without leaving the workout.
3. **Swap an exercise.** The rack is taken, or the cable station is busy. Swapping must
   preserve the set structure and record what was substituted.
4. **Reorder exercises within a session.** Same reason. Drag or move up/down.
5. **Remove a set.** Adding one is possible; removing is not. Both directions.
6. **PR date beside the PR weight.** `160 lb × 8 · Mar 14` — a PR from last week means
   something different to one from a year ago.

---

## C. Plate calculator

Port it. The source has a working solver in
`november_physique_tracker_v10_OFFLINE.html` — a dynamic-programme fewest-plates
solution over quarter-pound units, with a tie-break preferring heavier plates first.

Requirements: configurable bar weight, configurable available plates, per-side display,
and it must appear **next to the weight field** during a session, not behind a menu.

---

## D. Exercise art

The source embeds one 1302×1325 PNG of movement frames. Slice it per exercise and store
under `art/exercises/`, named by exercise id.

Show it small beside the exercise name, tappable to enlarge. It is reference, not
decoration — it answers "which incline curl variant is this".

---

## E. The guide

The source has a guide tab: weekly hard-set targets per muscle group, and programme
notes. Bring it in as a static reference under the program, not a tab of its own. It is
read once a month, not daily.

---

## F. UI corrections

**Superseded by `docs/04-design-system.md`.** That document was rewritten after this
section was built: the corrections below were all made and were all still too flat,
because the system they were measured against was the flat one. Hold to the acceptance
criteria at the end of `docs/04` instead. The two that are not restated there — the tab
bar floating with the safe-area inset, and FINISH being unreachable by a mis-tap — still
stand, and are still asserted.

Kept for the record:

Measured against `docs/04-design-system.md`, which the current build under-implements.

**Contrast is too low.** Everything is near-black on near-black. `--text-2` and
`--text-3` are being used where `--text` belongs. Numbers in a set row are primary
content and must be the brightest thing on screen. This is read at arm's length, in bad
gym lighting, mid-set.

**The tab bar must float.** It currently sits flush at the bottom edge. It should be
inset with a margin, over a blurred translucent surface, with the safe-area inset
respected — not a bar welded to the screen edge.

**Finish is too close to the set controls.** Ending a session by accident while
reaching for a checkmark is unacceptable. Move it, require a confirm, or both.

**Accent colour is absent.** The design system specifies one accent per attribute and a
single primary action per screen. The build is monochrome. The active set row, the
primary button and the rest timer should carry colour; nothing else should.

**Density is too tight.** Set rows need the `--s3` rhythm, not `--s1`. A cramped row is
a mis-tap.

---

## Acceptance

- A November Physique session can be run end to end, including rep ranges, per-side
  sets, and week rollover.
- All six features in section B work in a live session.
- The plate calculator solves 185 lb on a 45 lb bar to `[45, 25]` per side, and handles
  an impossible target by showing the closest achievable weight.
- Set-row numbers meet WCAG AA against their background — assert computed contrast, do
  not eyeball it.
- The tab bar floats with a margin and respects the safe-area inset.
- Finish cannot be triggered by a mis-tap adjacent to a set control — prove it with a
  hit-target separation assertion.
