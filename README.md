# Tempered

Tempered is a local-first health, lifestyle, and strength-training tracker with a small positive-reinforcement companion layer.

It is built around one practical idea: **make the healthy things easy to record, make progress easy to understand, and never punish a missed day.** Training, sleep, steps, hydration, nutrition, recovery, and other lifestyle signals stay useful on their own; the companion simply makes accumulated care feel alive.

*Tempering* is strengthening metal through controlled stress **followed by rest**. That remains the product thesis: load and recovery both matter.

## Current product

The visible app has four primary surfaces:

- **Today** — day planning, Lifestyle status, itemized Nutrition with calories and macros, hydration, habits, and today's workout queue.
- **Train** — a compact two-week rhythm, readiness and progress control center, concise ChatGPT coaching handoff, programs, exercise history, fast set logging, and progression tools.
- **Fuel** — calories, protein, water, and sleep at a glance with fast logging. The optional companion remains below this practical dashboard as a small reward.
- **Progress** — recap plus a configurable health/training widget dashboard that distinguishes missing history from recorded zeroes.

The earlier Character/Battle RPG implementation is retained internally for backwards compatibility with existing local data and regression fixtures, but it is intentionally absent from normal navigation and loads only when an old internal route requests it. New product work should not expand the RPG.

## Health data

The production Home Screen PWA supports an explicit ChatGPT Health paste import. From Today, open Daily Recap and choose **Import Health**. Tempered can copy the exact prompt, open ChatGPT, read or accept its nine-line `TEMPERED_HEALTH_V1` result, preview every populated field, and import only after confirmation. The recap refreshes immediately and shows imported recovery signals. Blank fields are skipped, so a night without Apple Watch sleep data does not erase an existing entry. The failed Apple Shortcuts automation remains preserved but hidden.

A native iOS wrapper also exists for a future signed/TestFlight build. That remains the intended path for direct, passive HealthKit access when Tempered is ready for native distribution.

## Data and privacy

Tempered is local-first. Canonical app data is stored in IndexedDB on the device. Settings can save and restore a complete JSON backup, including workouts, lifestyle logs, programs, preferences, and personal/work planner tasks. Restore validates and previews the file first, requires explicit confirmation, and replaces every store in one atomic transaction. Tempered also requests persistent browser storage when the platform supports it and reports the result in Settings. Nutrition keeps timestamped meal entries for calories, protein, carbohydrates, fat, and fiber. The photo helper does not upload photos from Tempered or embed an AI key; it copies a provider-neutral prompt for use in a vision-capable AI app, then pastes the small machine-readable result into a reviewable form before anything is saved.

## Repository documents

Some documents under `docs/` describe the earlier RPG-era product and remain useful as implementation/history references. The live UI and current source are authoritative for the post-RPG product direction.

| File | What it is |
|---|---|
| `CLAUDE.md` | Engineering/session contract and stack rules. |
| `docs/00-product.md` | Original product vision. |
| `docs/01-attributes-and-xp.md` | Legacy progression engine retained underneath old data. |
| `docs/02-data-model.md` | Storage/data model. |
| `docs/03-screens.md` | Earlier screen specification. |
| `docs/04-design-system.md` | Design-system foundations. |
| `docs/05-workout-system.md` | Workout/routine/progression system. |
| `docs/06-battle.md` | Legacy battle design; no longer a visible product feature. |
| `docs/07-build-plan.md` | Original phased build plan. |
| `docs/12-pre-beta-product-foundation.md` | Current product Phase 2 plan and beta-entry gates. |
| `DECISIONS.md` | Running implementation decisions. |

## Exercise art

The movement photographs in `art/exercises/` are not original work. Each one is two frames — start and finish — of an exercise from the **[free-exercise-db][fedb]** archive by yuhonas, released under the [Unlicense][unlicense] (a public domain dedication).

That archive inherited its imagery, by way of [wrkout/exercises.json][wrkout], from the **[Everkinetic][everkinetic] open data project by Greg Priday**, which is licensed **[CC BY-SA 4.0][ccbysa]**. Tempered keeps exact provenance in `art/exercises/SOURCES.json` and carries the attribution in **Settings → Credits**.

**Third-party exercise art is licensed separately from Tempered's source code and first-party art. A repository-level licence never automatically relicenses the files in `art/exercises/`.**

[fedb]: https://github.com/yuhonas/free-exercise-db
[unlicense]: https://unlicense.org
[wrkout]: https://github.com/wrkout/exercises.json
[everkinetic]: https://github.com/everkinetic/data
[ccbysa]: https://creativecommons.org/licenses/by-sa/4.0/

## First-party visual identity

The post-RPG wellness and companion artwork lives under `art/tempered/`. Trailback Turtle is the default, evolving from egg to hatchling to shredded adult across ten visible forms in a growing lakeside habitat. Earned care accumulates throughout the tracker, but a form changes only during a visible Companion-screen reveal with a persistent completion splash. Forge Guardian and the original Ember Sprout remain selectable alternatives. All styles use the same positive-only care total and ten-level progression. Production backgrounds are optimized WebP files; transparent companion stages and action icons remain PNG. The recovered generation originals, exact prompts, and design references live under `art/source/tempered-generated/` so a future session does not depend on expiring chat links.

## Deployment

The primary live app is served publicly by **GitHub Pages** from `main` at:

`https://cperry0360-create.github.io/tempered/`

The Pages workflow stages a runtime-only artifact from `main`; there is no application compile or bundle step. Tests, documentation, native-project files, uploads, and the large generation originals under `art/source/` stay in the repository but are not published. Runtime URLs remain relative so the PWA works under the `/tempered/` project path. The versioned service worker installs its shell atomically, serves installed static assets from that complete cache, and falls back to the cached shell after 2.5 seconds when a weak connection stalls navigation.

## Status

Tempered is an actively developed pre-beta static PWA. The current direction is
tracker-first: excellent logging and progress visibility, with the Companion as a
deliberately small reward layer rather than a second game product.

It is not yet ready for beta distribution. The current release has one seeded training
program, no on-device program builder, and first-launch setup that does not fully teach the
product thesis or guide the user through creating a plan. Product Phase 2 closes those gaps
before expanded HealthKit work or TestFlight distribution.

The first Phase 2 engineering slice establishes versioned program ownership envelopes,
immutable prescription revisions, and safe migration of the existing November program. The
program builder and guided first-use flow remain intentionally unreleased until they are
complete enough to use end to end.
