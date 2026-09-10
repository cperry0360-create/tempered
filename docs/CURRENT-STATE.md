# Tempered current state

**Last recovered and verified:** 2026-09-10

**Repository:** `cperry0360-create/tempered`  
**Production:** `https://cperry0360-create.github.io/tempered/`  
**Current release:** 0.19.0 (20)

This is the short handoff for the live product. It records the decisions recovered from
the long Tempered build conversation and the companion-art share so a new session does
not have to reconstruct the pivot from legacy RPG documents.

## Product direction

Tempered is a mobile-first, local-first health, training, and lifestyle tracker with a
small positive companion layer. It is not an RPG battle game. The visible navigation is:

1. **Today** for sleep, steps, nutrition, water, recovery, habits, and today's workout.
2. **Train** for programs, ad-hoc exercises, fast set logging, history, and progression.
3. **Companion** for a selectable Trailback Turtle, Forge Guardian, or Ember Sprout and
   habitat that grow from accumulated real-world activity already stored by the tracker.
4. **Progress** for a fixed recap plus a configurable widget dashboard.

Character/Battle code remains only for backwards compatibility with existing IndexedDB
data and regression fixtures. Do not put it back in navigation or expand it.

## Product rules that must survive every change

- Tracker first. The app must still be useful if Companion disappears.
- Local-first and fully offline. No backend, embedded AI key, or required account.
- No punishment. No lost levels, negative rewards, broken-streak shame, sick pet, decay,
  or missed-day debt. Rest is part of tempering.
- Completion is undoable, history is preserved, and reloads must not lose work.
- Workout completion and Today use the same canonical logs. Never duplicate rewards or
  create a second shadow tracker.
- Nutrition keeps timestamped meal entries with calories, protein, carbohydrates, fat,
  and fiber. The meal-photo helper fills the same reviewable form and never auto-saves.
- Apple Health uses the lightweight iPhone Shortcut handoff in the static PWA. The iOS
  wrapper can read its supported HealthKit metrics directly.
- No social feed, leaderboards, notification machine, or giant generic exercise catalog.

## Companion contract

- Three saved companion types. Trailback Turtle is the default; Forge Guardian and the
  original cream, teal, green, and warm-gold Ember Sprout remain selectable.
- The style can be chosen in setup or changed directly on Companion. Changing art keeps
  the companion name, care total, and growth level.
- Ten levels with early thresholds at 0, 24, 50, 85, and 130 care, then 185, 250, 330,
  430, and 550. Turtle and Forge have ten distinct forms. Turtle moves from Egg through
  hatchling and athletic stages to Shredded. Sprout maps those levels onto its five
  original forms while retaining a named checkpoint at every level.
- Growth comes from completed training, working sets, and lifestyle logs.
- Earned care may accumulate anywhere, but a form never changes silently. Companion holds
  the last revealed level, opens an evolution-ready takeover, then performs the change
  inside a fixed phone-safe stage over a 3.2-second old-to-new morph. The takeover is
  mounted in a top-level app overlay, outside the animated scrolling screen, so iOS cannot
  position it against the full Companion page or layer navigation above it. The checkpoint
  is written only after the morph, and the completion splash remains until acknowledged.
  A versioned presentation receipt replays corrected reveals once for affected installs,
  and Replay Evolution can run the earned transformation again without changing care.
- Each style has starter, mid, and fully upgraded habitat states. Turtle begins in a
  rugged lakeside nest and expands into a natural pond-side training territory.
- Daily moments may reflect training, hydration, reading, nutrition, sleep, or idle time.
- The user can rename the companion. Nothing decays.

## Progress widget dashboard

The recap remains fixed. The configurable grid supports Add, Edit/Done, remove, reorder,
and local persistence. The default widgets are:

- Training Load
- Sleep
- Steps
- Nutrition, showing calories and protein together
- Water
- Weight
- Body Metrics, including resting HR, HRV, respiratory rate, SpO2, and temperature
- Consistency

Micro Cardio is available from the Add gallery. The dashboard must render on the first
visit to Progress without requiring a second tap, and must remain mounted while idle.
Release 0.14.3 removes the self-triggering observer loop that repeatedly deleted and
rebuilt the dashboard, leaving it absent most of the time and its controls untappable.
Release 0.14.4 keeps the same dashboard element and cards mounted while Add, Edit/Done,
remove, and reorder controls run. These interactions update immediately and persist in
sequence, without the scroll jumps and card flicker caused by asynchronous replacement.
Release 0.15.0 also removes backdrop filtering and all animation from the card layer so
iOS does not re-composite and flash cards while controls or DOM order change.

## Nutrition log

Tapping Nutrition on Today opens a dedicated sub-screen. It shows daily totals, a meal
form with time plus calories/protein/carbs/fat/fiber, and timestamped meal history. Paste
AI Result fills all five fields and waits for review; Add Meal is the only save action and
the screen stays open afterward. Entries can be deleted and immediately restored with
Undo. Aggregate day fields remain canonical for existing Today, Progress, XP, and export
logic. Totals logged before 0.15.0 are preserved as an Earlier total rather than assigned
an invented meal time.

## Today screen density and Daily Recap

Today begins with one compact calendar rail and progress strip. The redundant visible
Today heading and long date are gone; the selected date remains explicit in the calendar
and accessible screen heading. Plan and Lifestyle logging rows remain directly on Today.

Read-only lifestyle totals no longer sit above those logging rows. `DAILY RECAP` opens a
dedicated card with sleep, steps, nutrition, water, weight, Apple Health sync/setup, and
four exercise facts for the selected day: training minutes, working sets, movements, and
sessions. The recap has no entrance animation or nested navigation, so it opens and closes
without the card flicker seen in earlier iPhone builds.

## Planner, training navigation, and active sessions

Personal and work tasks roll onto later dates until checked off. A rolled task keeps its
original date and can be opened to read or edit its full title, notes, type, and optional
due date. Due dates provide context and ordering; they never create an overdue penalty.

Train keeps the active program and routines on its main surface. The exercise library is
a single button that opens a dedicated searchable screen. Full sessions show a persistent
elapsed timer. While any workout logger is open, the PWA requests a screen wake lock and
the iOS wrapper disables the idle timer; both are released when the workout closes.

The November Physique light leg day adds Standing Calf Raise. Its former Crunch slot now
alternates by program week: Ab-Wheel Rollout in odd weeks and Cable Crunch in even weeks.
The seeded-program schema upgrade applies this to existing installs without resetting the
program start date or user-configured working weights.

Selected presses and shoulder movements expose a METHOD control inside the active workout.
The movement and program slot stay canonical while the user can choose a sensible Barbell,
Dumbbell, Cable, or Machine implementation. The method is stored on each set; last load,
history, and PR comparisons remain scoped to that method. Existing pre-0.19.0 sets inherit
the exercise's original method. Once any set for the movement is checked, its method locks
until those sets are undone. A Cable choice can also use the configured peg-entry profile.

Tempered is portrait-only: the manifest, runtime orientation request, landscape guard,
and iPhone wrapper all enforce the same orientation contract.

## Apple Health sync

Today now separates normal use from setup. `DAILY RECAP` keeps `RUN HEALTH SYNC` one level
from Today and invokes the saved Tempered Health Shortcut. Its preferred handoff opens
Tempered with a `temperedHealth` URL
parameter, imports automatically, removes the health payload from the address bar, and
requires no paste or second Import tap.

Health Setup is a dedicated, visible screen reached from Today, Settings, or the Progress
Body Metrics card. It includes exact build/repair instructions, the conversion-error fix,
the six latest body-data fields, a paste fallback, and manual entry for the five Body
Metrics signals. The Shortcut must pass numeric `Value` or `Duration` results into
Calculate Statistics, never Health Sample objects or Text. Body Metrics populates from
Resting HR, HRV, Respiratory Rate, Oxygen Saturation, and Body Temperature tags; a dash
means the sync omitted that tag or Apple Health has no sample.

The Health and Nutrition enhancements coordinate through explicit lifecycle events.
Neither watches and rebuilds the DOM it creates, so controls and cards remain stable.

## Visual direction and recovered art

The default Trailback Turtle direction matches Cory's established cartoon-game language:
bold dark outlines, chunky readable shapes, saturated blue/green cel shading, one hard
shadow, and the tone "serious game, silly world." Its outdoor territory uses forest,
mountain, lake, moss, stone, and warm-tan natural materials. The turtle becomes genuinely
strong and heroic; the humor comes from taking its shredded final form seriously.

Forge Guardian remains the optional blackened-steel, bronze, navy, and teal industrial
track. Ember Sprout remains the optional warm, rounded wellness track. None of the styles
should become photorealistic, painterly, generic AI fantasy, combat imagery, or a copy of
another character or game scene.

Production uses screen-specific scenic art for Today, Train, Companion, and Progress;
five transparent Sprout cutouts; transparent ten-form Turtle and Forge sheets; three
habitat states for each style; and Companion, Progress, and AI Nutrition support icons. Originals
and references recovered from the shared ChatGPT conversation are preserved in
`art/source/tempered-generated/`. Several generated
"transparent" animation and widget-reference files contain a baked gray checkerboard.
They are preserved as references but must not be rendered directly in the app.

## Engineering contract

- Plain browser ES modules, no framework, no dependencies, no build step.
- `node --test` for automated logic tests.
- IndexedDB behind a storage adapter; memory storage for tests.
- Clock and health integrations stay behind adapters.
- Relative URLs and explicit `.js` extensions are mandatory for GitHub Pages under
  `/tempered/`.
- The root `sw.js` owns the offline cache. Bump `src/version.js` whenever production
  assets or runtime behavior change.
- Work is committed directly to `main`; this is Cory's standing instruction for this
  solo project.

## Historical context, not current product scope

The original PRD targeted a visible RPG character reaching Level 10 in roughly 60
consistent days. That target explains retained XP and battle-era code, but it no longer
defines the visible product. Current work should improve the tracker, Progress, or the
small positive Companion layer.
