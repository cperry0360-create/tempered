# 12: Pre-beta product foundation

**Status:** Approved product phase  
**Decision date:** 2026-09-14  
**Product maturity:** Pre-beta

## Executive decision

Tempered is not ready for beta distribution.

The tracker, workout logger, nutrition journal, Progress dashboard, local persistence, and
companion demonstrate meaningful product value. The missing product foundation is more
basic: a new user cannot create a training program, has only one seeded program to choose
from, and is not taught the product thesis or normal operating loop during first launch.

Product Phase 2 is therefore **Program Foundation and Guided First Use**. Beta hardening,
broader HealthKit support, and TestFlight distribution begin only after the exit criteria in
this document pass.

This product phase is distinct from the older implementation phase numbering in
`docs/07-build-plan.md`.

## Product thesis shown to the user

Tempered helps a person follow a training plan, record what actually happened, and
understand the balance between effort and recovery without guilt or broken-streak pressure.

The first-launch experience must explain three ideas in plain language:

1. **Follow a plan.** Know what to train today and what is coming next.
2. **Record reality.** Completed sets, nutrition, sleep, steps, and recovery remain useful
   even when the week does not go perfectly.
3. **See what compounds.** Progress trends and the optional companion reflect work already
   completed. The companion never needs care and never loses progress.

Recommended opening copy:

> Build strength through effort and recovery.
>
> Tempered brings your training, nutrition, sleep, and daily habits into one clear plan.
> Log what happened, learn from the trend, and keep moving without broken streaks or guilt.

The setup sentence stating that a frequency target helps "the RPG judge a training week"
must be removed. The companion is introduced as an optional reflection of progress, not as
the reason to train.

## Required first-launch flow

The first run must take a user from no context to a useful Today screen.

1. **Welcome and thesis**
   - Explain training plus recovery.
   - State that data stays on the device.
   - State that missed days create no penalty.
2. **Goal and availability**
   - Primary goal: general strength, muscle, run-support strength, or custom.
   - Training days per week.
   - Preferred weekdays and approximate session length.
3. **Equipment**
   - Full gym, home gym, dumbbells only, bodyweight, or custom selection.
4. **Choose how to begin**
   - Start from a suitable template.
   - Build a program from scratch.
   - Explore without activating a program.
5. **Create or review the plan**
   - Show its weekly rhythm before activation.
   - Allow exercises, days, sets, repetitions, methods, and rest to be edited.
6. **Tracking preferences**
   - Choose lifestyle items and targets.
   - Health connection or manual entry remains optional.
7. **Companion**
   - Explain that growth reflects completed work and never decays.
   - Selection and naming are optional.
8. **First useful action**
   - Land on Today with one clear next step: begin today's session, review the plan, or log
     the first health value.

A returning user can rerun setup without resetting history or replacing a program silently.

## Program system requirements

### Program lifecycle

A user must be able to:

- Create a program from a template or a blank program.
- Name, duplicate, edit, activate, pause, resume, and archive a program.
- Choose a start date and training weekdays.
- Set a fixed number of weeks or use a repeating program.
- Review the complete weekly rhythm before activation.
- Keep one active program while retaining prior programs and their history.

Edits to a program affect future scheduled work only. Completed workouts remain historical
facts and are never rewritten when a program changes. A material edit creates a new internal
program revision so past sessions can still explain what was prescribed at the time.

### Day builder

For each training day, a user must be able to:

- Set a day name, focus, and weekday.
- Add exercises from the library or create a custom exercise.
- Reorder and remove exercises.
- Duplicate a day.
- Configure working sets, repetition range, rest interval, method, starting load, and an
  optional cue.
- Save an incomplete draft without activating it.

Supersets, automatic periodization, and advanced block programming are not required for the
first pre-beta release.

### Exercise coverage

The existing exercise library is a starting point, not the plan system. It must cover the
major movement families and never block a user from proceeding because an exercise is
missing. Custom exercises require a name, movement family, equipment or method, and basic
tracking type.

The pre-beta seed set must include at least:

- Full Body, three days
- Upper/Lower, four days
- Run-Support Strength, two days
- Physique, five days
- Blank Custom Program

The current November Physique Sprint can become the Physique template. Templates are
editable starting points, not locked prescriptions.

## Program use after setup

- Today shows the scheduled training day and the next useful action.
- Train shows the active program, current program week, and a clear Manage Program action.
- Missing a scheduled day does not create debt or automatically move completed history.
- A user can perform an ad hoc workout without modifying the program.
- A user can substitute or add an exercise for one session without changing future weeks.
- Progress comparisons remain scoped to the exercise method and historical program revision.
- Program completion offers repeat, revise, archive, or choose another plan.

Empty states must teach the action available from that screen rather than merely report that
no data exists.

## Workouts required before beta

Beta readiness is based on program flexibility, not the raw number of hard-coded workouts.
The templates above must produce distinct, complete weekly schedules and be editable on an
iPhone. At minimum, acceptance must cover:

- A two-day hybrid or run-support schedule.
- A three-day full-body schedule.
- A four-day upper/lower schedule.
- The existing five-day physique schedule.
- A fully custom plan built on-device.

Each must survive activation, week turnover, an ad hoc exercise, a missed day, a resumed
workout, and a future program edit without changing completed history.

## Revised execution order

### P2.1: Thesis and onboarding

- Replace obsolete RPG language.
- Add the welcome, goal, availability, equipment, and starting-path steps.
- Add educational empty states and the first-use next action.
- Keep onboarding skippable and safe to rerun.

### P2.2: Program domain and storage

- Add program creation, revisions, lifecycle states, and validation.
- Preserve all existing program and workout records.
- Add migration and rollback coverage before UI work is released.

### P2.3: Mobile program builder

- Build template selection, blank creation, week/day editing, and exercise configuration.
- Add custom exercises and one-session substitutions.
- Verify every interaction at supported iPhone widths.

### P2.4: Template and workout depth

- Ship the four baseline program families plus Blank Custom.
- Verify progression and history behavior across each template.
- Add only the exercise coverage required to keep the templates and custom builder usable.

### P2.5: Pre-beta proof

- Run a clean-install onboarding test without referring to repository documentation.
- Run a 14-day daily-driver test.
- Resolve data loss, stuck-session, scheduling, and comprehension failures.
- Only then begin expanded HealthKit work and TestFlight beta distribution.

## Exit criteria

Tempered may be called beta-ready only when all of the following are true:

- A brand-new user can explain the product's purpose after first launch.
- A brand-new user can create and activate a usable plan on an iPhone in under five minutes.
- The user can start from a template or from a blank program.
- Program edits never rewrite completed workout history.
- The five required starting paths work across week turnover.
- No missing exercise creates a dead end.
- Today always explains the next useful action.
- A 14-day daily-driver test completes with no lost data and no manually repaired workout.
- Backup and restore preserve programs, program revisions, custom exercises, and history.
- The product passes its existing automated suite and the physical-iPhone acceptance pass.

## Explicitly deferred

Until the exit criteria pass, do not add:

- New companion forms, habitats, or mechanics
- Additional AI clipboard workflows
- Social features, leaderboards, or sharing
- Cloud accounts or multi-device sync
- Advanced programming systems
- More planner functionality
- A framework migration
- Public beta positioning

The management rule for Phase 2 is simple: **Tempered must first teach the promise, help the
user build a plan, and guide the first week.**
