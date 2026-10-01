## 2026-10-01 — Redesign V1 R11 Training score

- Progress Overview starts with a weekly 0–100 Training score, grade, change versus the prior four-week average and up to 12 tracked weeks of ember trend.
- Progression (35%), plan adherence (30%), consistency (25%) and volume trend (10%) come from canonical finished sessions and working sets; each row opens its contributing lifts, slots, days or weeks. Deloads skip progression/volume and reweight the remaining components; insufficient history is excluded.
- Existing ChatGPT progress report includes the weekly score, grade, change, component weights and one-line reasons. Other screens and stored history are unchanged.
- Test-first five required fixtures failed before the implementation existed; domain and browser acceptance protect calculation, evidence navigation, report and empty state. Release 0.48.0 (68).

## 2026-10-01 — Redesign V1 R10 sub-screens, Today density and device fixes

- Today defaults to one leftovers-first Next up movement, inline Show all disclosure and full-session action; the storage-backed choice lasts for that local day.
- Train places the current-week rhythm directly under the program; tapping opens full history. Program details retains description, hard-set targets and builder in a detail view.
- Health import is a full-screen numbered copy/paste/review flow, with a scrollable keyboard-aware body and bottom import action; empty preview no longer appears as a stray box.
- Nutrition and other pushed views use token fills, domain ink and no neutral outlined tiles. Nutrition has green totals/Add meal, segmented day status and a bounded full-row time field.
- Progress lines use domain ink; Lifts labels e1RM and real 30D changes; Log groups canonical sessions by date and sets by exercise while retaining every session's minutes correction; Habits hides zero current streaks and labels its daily map.
- Release: 0.47.0 (65). Fail-first Today/sub-screen browser fixtures, 667 Node tests and 632 browser checks pass; release captures cover 28 views in both themes at both phone sizes. No stored history is removed or migrated. Physical-iPhone Health keyboard/clipboard and safe-area confirmation remains with Cory.

## 2026-09-30 — Redesign V1 R9 rollover and Today fixes

- Today reads the numeric active-program week for its meta and first-week guidance.
- Daily queue ordering is Monday-first: Sunday includes the same week's earlier unfinished movements, with no rollover group on the following Monday.
- Today recomputes the calendar-local date on refresh and refreshes its mounted screen after returning visible on a changed date. Date listeners detach off Today; other screens and active workouts are not redrawn.
- When today's movements are complete but earlier work remains, the card reads the finished day's name plus done, the exact remaining count, and Finish followed by the day its button opens.
- Release identity: 0.46.0 (64). Logging, stored records, prescriptions, and all other screens are unchanged.

## 2026-09-30 — R8.1 delivery recovery

- R8 removed the runtime art directory, but the curated Pages staging step still copied it. Staging now includes only retained runtime assets. The independent recorded-workout summary action and celebration styles are preserved under section 0.1.
- Release identity: 0.45.1 (63). Stored legacy data remains untouched.

## 2026-09-30 — Redesign V1 R6 rollover and device fixes

- Restored the Today workout card natively from `workout.weekStatus()` and `buildDailyWorkoutQueue()`. Unfinished slots roll across the current program week, each starts a single-movement session with canonical day/slot metadata, and full sessions use `remainingProgramDay()`. Train reports the same rollover count.
- The tab bar has safe-area padding for its labels. Follow-up from Cory's iPhone screenshot found the uncovered home-indicator band was caused by `.app` being locked to `100dvh` while the document is overflow-hidden; iOS standalone can report that unit short of the physical display. Standalone now uses `100vh` for `html`, `body`, and the app shell, leaving the tab-bar background visible behind the home indicator. Browser CI cannot validate this iOS-specific viewport behavior, so Cory should confirm the installed app after update.
- Weekly sets now uses eight zero-based, bottom-aligned bars and labels only the current value. Removed the orphan Micro cardio line; trend deltas require at least three samples in both periods; Today readiness uses `Sleep`, `Resting HR`, and `HRV`; duplicated exercise-name suffixes are dropped.
- Added a fail-first rollover browser acceptance test: on the pre-fix build, the expected Wednesday rollover group was missing and downstream slot-session/logging/removal checks failed. CI on the fixed build verifies rollover, viewport geometry, chart bars, and sample thresholds. R3.1 prescription, photos, and plate-line checks remain green.
- Release candidate: 0.43.1 (60). CI captures 22 release surfaces at 390×844 and 430×932 (44 captures); R6 visual review confirms the session header begins at the top edge and the eight Weekly sets bars share a baseline. Those browser captures did not cover the iOS standalone viewport, which Cory's screenshot exposed.

## 2026-09-30 — Redesign V1 R5 Progress and sweep

- Progress is now a fixed 7D / 30D / 90D recap with Overview, Lifts, Habits, and Log views. Overview shows eight weeks of working sets, recent PRs, sample-aware weight/steps/sleep trends, Recovery only when samples exist, and a copyable ChatGPT report; exercise and log details retain their existing actions.
- The remaining Settings, Setup, Program Builder, Summary, and sheet surfaces have been swept to token colors, sentence case, and one-sentence helper copy; the Health setup and import screens follow the same rules while preserving the machine-readable import format.
- Retired configurable Progress dashboard code and its test page were removed, and stale background-art precache entries were cleared.
- Release candidate: 0.42.1 (58). CI review found that the native range initially selected 7D, several browser contracts still targeted the retired dashboard, and the 430px workout summary clipped two measurements. R5.1 selects 30D, updates the contracts, and fixes the summary grid. Release evidence covers 22 screens at 390×844 and 430×932 (44 captures); final artifact review is pending.

## 2026-09-30 — Redesign V1 R3.1 session feature restore

- Applied the new feature-preservation rule to the d9850f5 pre-redesign baseline.
- Active workout again shows real progression prescriptions in inputs, proposal coaching,
  56px exercise art with full-image panel, Best performance, and per-side barbell plates.
- Restored unapproved R2/R4 removals behind detail views: Today planner/date/day recap/program
  exercise logging and Train hard-set/library-PR context.
- Added fail-first browser coverage proving one-tap logging uses the prescription rather than
  last-session values.
- Release version: 0.41.1 (56).

## 2026-09-30 — Redesign V1 R4 Train and Fuel

- Train now follows the approved R4 hierarchy: one program header, next session, session rows, routines, and drill-in rows for Exercise library and Training rhythm. The duplicated program presentation, weekly slot bars, workout control center, stat tiles, and AI coaching handoff are removed from Train.
- Program details expands the active-program description and links to Program Builder. Routines start from their detail view rather than directly from the list.
- Fuel now follows approved mockup screen 3: energy ring, protein progress, three macro stats, one meal action, recent quick logs, and water controls. Fuel stays focused on nutrition and hydration.
- The Fuel ring represents calories eaten divided by the calorie goal and has a zero-length ember arc when calories eaten is 0.
- Release version: 0.41.0 (55).

## 2026-09-29 — Redesign V1 R3 Active workout

- Active workout now follows approved mockup screen 2: sticky Cancel / title+elapsed / Finish header, dense exercise cards, Previous/lbs/Reps table, 52px rows, completed success tint, inline Add set, and fixed rest controls.
- Legacy exercise art, LAST/PR header pills, visible action chips, and always-visible plate calculator are removed from the workout surface. Existing exercise actions live under the ⋯ menu, including cable-machine settings.
- Repeat-session values render as dim placeholders; one check tap logs those placeholder values. Set number opens Working/Warm-up/Drop/Failure type selection. Swipe-left deletes a set.
- Rest timing is derived from a persisted absolute `endsAt` timestamp so backgrounding or sleeping the screen cannot pause the countdown.
- R3 browser acceptance covers placeholder contrast, one-tap logging, stored-end-timestamp timing, menu actions, resume behavior, and 52px rows. `tools/verify-logging-speed.js` is now an explicit CI gate.
- Release version: 0.40.0 (54).

Release 0.39.0 completes Redesign V1 Phase R2 for Today: the approved dashboard now leads with Today settings, next session, readiness, same-week training, Fuel, and the canonical Daily log. Legacy Today summary, calendar rail, planner, workout-control, Daily Recap, weekly-goal, and AI-check surfaces are removed from Today; logging and persistence remain canonical.

## 2026-10-01 — Redesign V1 R8 removal of reward surfaces

- Removed the reward surfaces and their UI code, including Today, setup, workout summary,
  settings/navigation, runtime illustrations, and the dedicated screen.
- Existing reward-related profile values remain stored and are neither migrated nor deleted.
  Legacy domain and service modules remain only for data compatibility and tests.
- Active workout exercise photos remain available. Tracker screens use no decorative art.
- Added a browser acceptance flow that seeds legacy profile values, visits every tab,
  completes a workout and summary, and checks for runtime errors and preserved data.

## 2026-10-01 — Redesign V1 R7 colour revision and light mode

- Applied the revised palette through shared design tokens and ink tokens. Appearance
  offers System, Light, and Dark, with System as the default and a persisted selection.
- Light mode swaps tokens globally without per-screen theme overrides. The status-area
  strip uses the shared status-bar token for legible iOS glyphs in both themes; device
  verification remains part of phone acceptance.
- Release version: 0.44.0 (61).

# Tempered current state

**Last updated:** 2026-10-01

**Repository:** `cperry0360-create/tempered`
**Production:** `https://cperry0360-create.github.io/tempered/`
**Current release:** 0.48.0 (68) — R11 Training score

**Product maturity:** Pre-beta product completion

Tempered is not yet beta-ready. It currently ships one seeded program and has no on-device
program creation or editing system. First launch now teaches the tracker-first thesis, asks
for a realistic goal, schedule, session length, and equipment, previews the starting path,
and lands the user on a concrete next action. Full program creation and editing remain ahead.
Product Phase 2 is therefore Program Foundation and Guided First Use. Release 0.27 establishes
versioned program envelopes, immutable prescription revisions, and a safe migration for the
existing November program. The builder and revised onboarding are still ahead. Expanded native
distribution follows only after the exit criteria in
[`docs/12-pre-beta-product-foundation.md`](12-pre-beta-product-foundation.md) pass.

Release 0.26 keeps Health import above Daily Recap and redraws Today after import so sleep, steps, and scheduled habit rows update immediately. Nutrition now has an explicit date picker for correcting earlier records, Today offers a neutral review route for recent prior days with open items, readiness has Ready/Steady/Recover colors, and the ChatGPT coaching handoff includes the latest workout, strongest sets, workload, and confirmed load or volume PRs.

Release 0.25 restores imported recovery signals to Progress, explains the readiness estimate using the user's own baselines, separates Fuel, hydration, and recovery into practical cards, and excludes current or flagged-partial nutrition days from calorie averages. Nutrition days can be marked Complete or Still Logging from the meal journal.

This is the short handoff for the live product. It records the decisions recovered from
the long Tempered build conversation so a new session does not have to reconstruct the product direction from legacy RPG documents.

Release 0.31.1 removes the final visible RPG explanation from onboarding and establishes
the autonomous product-team release contract. CI now captures every core surface at both
supported iPhone viewport classes as reviewable evidence. A release is not complete until
those captures and the deployed product have been visually inspected. The operating contract
is in [`docs/PRODUCT-TEAM.md`](PRODUCT-TEAM.md).

Release 0.33.0 turns the starting path into a real template chooser. New users can choose
Strength Foundation, November Physique, Mercy Mode, or start a safe blank draft. The visual
system now uses warm amber action accents and lifted teal recovery accents instead of acid
lime and moss green. Existing history and program records remain intact.

Release 0.34.0 adds the first mobile Program Builder workflow. From Settings, a user can
create or edit a day, add exercises, set sets and rep ranges, save a draft, and review before
activating. Every save creates an immutable prescription revision; existing workout history is
not rewritten.

Release 0.35.0 adds First-Week Guidance to Today and Train. The app now names the next useful
session, explains that repeatable work is enough, and treats recovery as part of the plan when
today's work is complete. It adds no reminders, debt, or punitive streak behavior.

Release 0.36.0 adds a browser acceptance harness for the Program Builder's complete path:
open, add a day, add an exercise, save a draft, and review/activate. This begins the pre-beta
proof pass; hosted browser and visual inspection remain required before TestFlight.

Release 0.32.0 turns onboarding into Guided First Use. The first launch now explains effort
plus recovery, keeps the local-first promise visible, captures the user's goal, realistic
weekly rhythm, session length, equipment, and starting path, then reviews the current plan
before saving. Existing history and program records remain intact.

Release 0.31 makes three distinct 30-minute days the weekly streak minimum. A fourth qualifying day makes it a strong week and advances keeper progress, so busy weeks count without removing the reward for doing more.

Release 0.30 replaces the fixed two-week Training calendar with a horizontally scrolling weekly history. It includes every week from the first recorded workout, opens on the current week, and preserves the established outline for logged work and solid fill for 30-minute qualifying days.

## Product direction

Tempered is a mobile-first, local-first health, training, and lifestyle tracker with a
clear and practical tracking flows. It is not an RPG battle game. The visible navigation is:

1. **Today** for sleep, steps, nutrition, water, recovery, habits, and today's workout.
2. **Train** for scrollable weekly rhythm history, readiness, concise ChatGPT coaching handoff,
   programs, ad-hoc exercises, fast set logging, history, and progression.
3. **Fuel** for calories, protein, water, and sleep at a glance with quick logging.
4. **Progress** for a fixed recap plus a configurable widget dashboard.

Character/Battle code remains only for backwards compatibility with existing IndexedDB
data and regression fixtures. Do not put it back in navigation or expand it.

## Product rules that must survive every change

- Local-first and fully offline. No backend, embedded AI key, or required account.
- No punishment. No lost levels, negative rewards, broken-streak shame, decay,
  or missed-day debt. Rest is part of tempering.
- Completion is undoable, history is preserved, and reloads must not lose work.
- Workout completion and Today use the same canonical logs. Never duplicate rewards or
  create a second shadow tracker.
- Nutrition keeps timestamped meal entries with calories, protein, carbohydrates, fat,
  and fiber. The meal-photo helper fills the same reviewable form and never auto-saves.
- ChatGPT Health paste import is available from Daily Recap with an exact prompt, parsed
  preview, explicit confirmation, immediate recap refresh, and visible recovery signals.
  Copy actions open ChatGPT with the prompt on the clipboard because no supported public
  prompt-prefill link is used. The failed Shortcut automation stays hidden. The
  future signed iOS wrapper can read supported HealthKit metrics directly.
- Mobility opens a dedicated guided screen with four routines, movement cues, countdowns,
  and explicit completion logging rather than expanding into an inline minutes field.
- No social feed, leaderboards, notification machine, or giant generic exercise catalog.

## Progress widget dashboard

The recap remains fixed. The configurable grid supports Add, Edit/Done, remove, reorder,
and local persistence. The default widgets are:

- Training Load
- Sleep
- Steps
- Nutrition, showing calories and protein together
- Water
- Weight
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
Longer ranges begin at Tempered's first recorded day rather than inventing zeroes before
the app had data. Partial 30/90-day views state their actual coverage, averages show sample
counts, missing samples remain missing in charts, and prior-period comparisons wait until
both periods have complete coverage.

## Nutrition log

Tapping Nutrition on Today opens a dedicated sub-screen. It shows daily totals, a meal
form with a short description, time, and calories/protein/carbs/fat/fiber, plus timestamped
meal history. Import AI Copy fills the description and nutrient fields and waits for review;
Add Meal is the only save action and the screen stays open afterward. Once an entry has a
description, recent/frequent meals appear as one-tap Quick Log choices with their saved
amounts. The AI prompt requests a brief description in its copyable result. Entries can be
deleted and immediately restored with Undo. Aggregate day fields remain canonical for
existing Today, Progress, XP, and export logic. Totals logged before 0.15.0 are preserved
as an Earlier total rather than assigned an invented meal time.

## Today screen density and Daily Recap

Today begins with one compact calendar rail and progress strip. The redundant visible
Today heading and long date are gone; the selected date remains explicit in the calendar
and accessible screen heading. Plan and Lifestyle logging rows remain directly on Today.

Read-only lifestyle totals no longer sit above those logging rows. `DAILY RECAP` opens a
dedicated card with sleep, steps, nutrition, water, weight, a compact Health import entry, and
four exercise facts for the selected day: training minutes, working sets, movements, and
sessions. The recap has no entrance animation or nested navigation, so it opens and closes
without the card flicker seen in earlier iPhone builds. Mobility logging opens a card with
four ready-to-use short flows, each showing its movements and filling its duration.

## Planner, training navigation, and active sessions

Personal and work tasks roll onto later dates until checked off. A rolled task keeps its
original date and can be opened to read or edit its full title, notes, type, and optional
due date. Due dates provide context and ordering; they never create an overdue penalty.

Train opens with a compact, horizontally scrolling weekly training calendar. Days with 30
or more completed workout minutes are circled. Three such days maintain the streak. A fourth
makes it a strong week, and five strong weeks bank a streak keeper. A keeper automatically protects one completed quiet week, and an unfinished week
never spends one. Settings also accepts retroactive or planned Away ranges. A completed away
week preserves an existing rhythm without inventing workouts, spending a keeper, or advancing
keeper progress. The system is positive-only. Completed sessions can be corrected later from
Progress → Log; a manual duration replaces the estimate and is bounded to a sensible 1–240 minutes.
Train keeps the active program and routines on its main surface. The exercise library is a single button that opens a dedicated
searchable screen. Any open workout can add another movement from that library without
rewriting the saved program or routine. Full sessions show a persistent elapsed timer.
An open workout can be minimized into a compact Resume control above the main navigation;
its draft, checked sets, elapsed start time, and exercise additions survive navigation and
app relaunch without automatically trapping the user back in the logger. While the logger
is visible, the PWA requests a screen wake lock and the iOS wrapper disables the idle timer;
both are released while minimized or closed and reacquired when the workout resumes.

The November Physique light leg day adds Standing Calf Raise. Its former Crunch slot now
alternates by program week: Ab-Wheel Rollout in odd weeks and Cable Crunch in even weeks.
The seeded-program schema upgrade applies this to existing installs without resetting the
program start date or user-configured working weights.

Selected presses and shoulder movements expose a METHOD control inside the active workout.
The movement and program slot stay canonical while the user can choose a sensible Barbell,
Dumbbell, Cable, or Machine implementation. The method is stored on each set; last load,
history, and PR comparisons remain scoped to that method. Existing pre-0.19.0 sets inherit
the exercise's original method. Once any set for the movement is checked, its method locks
until those sets are undone. Choosing Cable uses the configured machine's PEG selector by
default, with one or two stacks according to the movement. An explicit per-exercise setting
can opt back into generic pounds.

Program records now carry ownership/lifecycle metadata and point at an immutable prescription
revision. Newly completed scheduled slots store the program id, revision id, and exact
prescription snapshot alongside the actual set. Existing sessions remain untouched during
migration; no historical prescription is invented. A program can start on any day. Its starter week lasts at least seven full days and remains
active through Sunday; afterward weeks turn over Monday morning. Older sets are never
reclassified as missed work. Today presents the current day's movements first and groups
larger earlier-week lists behind a compact disclosure, still available if the user chooses.

Tempered is portrait-only: the manifest, runtime orientation request, landscape guard,
and iPhone wrapper all enforce the same orientation contract.

## Apple Health sync

The failed Apple Health Shortcut automation remains dormant in the production PWA. Its launch
gate, setup/repair instructions, Shortcut links, and Progress Body Metrics widget are not
installed or offered. The parser is retained for backward compatibility.

Daily Recap now contains one compact **Import Health** entry for the working ChatGPT Health
path. It opens a bounded sheet that can copy the exact connected-Health prompt, read the copied
nine-line `TEMPERED_HEALTH_V1` response or accept a normal long-press paste, and preview every
populated field before an explicit import. Missing fields are skipped rather than replaced with
zero. Re-importing steps, sleep, or weight replaces that date's canonical value and never adds
the same total twice. The source and import time are retained on the day log.

This is intentionally not presented as passive sync. A Home Screen web app still cannot read
HealthKit itself or silently consume the clipboard on launch. Tempered will revisit automatic
Health data through its native iOS wrapper when private signing/TestFlight work begins.

## Visual direction and recovered art

The approved Redesign V1 system in `docs/13-redesign-v1.md` is authoritative for
current screen colors, typography, surfaces, and layout. Exercise photos are used only
inside active workouts. Generated originals and references recovered from the shared
conversation remain preserved under `art/source/tempered-generated/` and are not runtime
assets.

## Engineering contract

Settings has a first-class Your data section. Backups include every canonical IndexedDB
store, including dated personal/work planner items. Restore validates the file, previews
record counts and its date range, requires an explicit replacement confirmation, and uses
one transaction across all stores so a failed write leaves the existing database intact.
On launch Tempered also asks supported browsers for persistent storage; Settings reports
whether protection was granted and recommends a recent backup when it was not.

The service worker keeps atomic release installation. Static application requests are
cache-first within the versioned cache, while navigations use the network with a 2.5-second
limit before falling back to the installed shell. Activation removes only older caches
owned by Tempered. The page and precache use the same unqueried `src/main.js` cache key.

- Plain browser ES modules, no framework, no dependencies, no build step.
- Program revisions and scheduled-set prescription snapshots are part of the local backup;
  export schema 7 adds the revision collection while older backups migrate safely.
- `node --test` for automated logic tests.
- IndexedDB behind a storage adapter; memory storage for tests.
- Clock and health integrations stay behind adapters.
- Relative URLs and explicit `.js` extensions are mandatory for GitHub Pages under
  `/tempered/`.
- GitHub Actions stages only the runtime shell, source modules, data, icons, and
  optimized runtime art for Pages. Generation originals under `art/source/` are retained
  in git but never included in the deployed artifact.
- The root `sw.js` owns the offline cache. Bump `src/version.js` whenever production
  assets or runtime behavior change.
- Work is committed directly to `main`; this is Cory's standing instruction for this
  solo project.

## Historical context, not current product scope

The original PRD targeted a visible RPG character reaching Level 10 in roughly 60
consistent days. That target explains retained XP and battle-era code, but it no longer
defines the visible product. Current work should improve the tracker, Progress, or the
the tracker and its supporting tools.
