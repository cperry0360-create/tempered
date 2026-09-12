# Tempered

Tempered is a local-first health, lifestyle, and strength-training tracker with a small positive-reinforcement companion layer.

It is built around one practical idea: **make the healthy things easy to record, make progress easy to understand, and never punish a missed day.** Training, sleep, steps, hydration, nutrition, recovery, and other lifestyle signals stay useful on their own; the companion simply makes accumulated care feel alive.

*Tempering* is strengthening metal through controlled stress **followed by rest**. That remains the product thesis: load and recovery both matter.

## Current product

The visible app has four primary surfaces:

- **Today** — day planning, Lifestyle status, itemized Nutrition with calories and macros, hydration, habits, and today's workout queue.
- **Train** — programs, exercise history, fast set logging, progression tools, cable-machine support, and ad-hoc training.
- **Companion** — a small creature that grows only from accumulated real-world activity. It never loses progress, gets sick, or punishes a missed day.
- **Progress** — recap plus a configurable health/training widget dashboard.

The earlier Character/Battle RPG implementation is retained internally for backwards compatibility with existing local data and regression fixtures, but it is intentionally absent from normal navigation. New product work should not expand the RPG.

## Health data

The production Home Screen PWA currently uses manual sleep, steps, and weight logging. The experimental Apple Health Shortcut bridge remains in the repository but is intentionally hidden because iOS cannot provide a reliable automatic handoff to an installed web app.

A native iOS wrapper also exists for a future signed/TestFlight build. That is the intended path for direct, passive HealthKit access when Tempered is ready for native distribution.

## Data and privacy

Tempered is local-first. Canonical app data is stored in IndexedDB on the device, with JSON backup/restore available in Settings. Nutrition keeps timestamped meal entries for calories, protein, carbohydrates, fat, and fiber. The photo helper does not upload photos from Tempered or embed an AI key; it copies a provider-neutral prompt for use in a vision-capable AI app, then pastes the small machine-readable result into a reviewable form before anything is saved.

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

Pages publishes the repository root directly. There is no application build step: `index.html`, `manifest.webmanifest`, `sw.js`, and runtime assets are served as committed. `.nojekyll` disables Jekyll processing, and runtime URLs are relative so the PWA works under the `/tempered/` project path.

## Status

Tempered is an actively developed static PWA. The current direction is tracker-first: excellent logging and progress visibility, with the Companion as a deliberately small reward layer rather than a second game product.
