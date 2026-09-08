# Tempered current state

**Last recovered and verified:** 2026-09-08  
**Repository:** `cperry0360-create/tempered`  
**Production:** `https://cperry0360-create.github.io/tempered/`  
**Current release:** 0.14.3 (10)

This is the short handoff for the live product. It records the decisions recovered from
the long Tempered build conversation and the companion-art share so a new session does
not have to reconstruct the pivot from legacy RPG documents.

## Product direction

Tempered is a mobile-first, local-first health, training, and lifestyle tracker with a
small positive companion layer. It is not an RPG battle game. The visible navigation is:

1. **Today** for sleep, steps, nutrition, water, recovery, habits, and today's workout.
2. **Train** for programs, ad-hoc exercises, fast set logging, history, and progression.
3. **Companion** for a warm ember-sprout creature and habitat that grow from accumulated
   real-world activity already stored by the tracker.
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
- Nutrition tracks calories and protein together. The meal-photo helper copies a prompt
  to a vision-capable AI app and imports only the small machine-readable result.
- Apple Health uses the lightweight iPhone Shortcut handoff in the static PWA. A native
  wrapper remains optional future work.
- No social feed, leaderboards, notification machine, or giant generic exercise catalog.

## Companion contract

- One species: the cream, teal, green, and warm-gold ember-sprout companion.
- Five stages: Seed, Hatchling, Sprout, Bloom, Radiant.
- Growth comes from completed training, working sets, and lifestyle logs.
- The habitat upgrades from starter to mid to fully upgraded as care accumulates.
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

## Apple Health Shortcut import

The preferred Shortcut handoff opens Tempered with a `temperedHealth` URL parameter and
imports automatically. `IMPORT HEALTH` may read a valid snapshot directly from the
clipboard when iOS permits it. When installed Safari denies programmatic clipboard read,
the button must open an in-app paste sheet where the user can touch and hold, Paste, and
Import. A clipboard denial must never leave a button that appears to do nothing.

## Visual direction and recovered art

The approved direction is warm, polished, premium wellness illustration: deep navy and
blue, teal/aqua, fresh green, warm cream/gold, rounded shapes, soft shading, clear
silhouettes, calm scenic backgrounds, and translucent dark cards. It is not pixel art,
photorealism, office/corporate optimization, combat, or threat imagery.

Production uses screen-specific scenic art for Today, Train, Companion, and Progress;
five transparent companion cutouts; three habitat states; and Companion, Progress, and
AI Nutrition support icons. Originals and references recovered from the shared ChatGPT
conversation are preserved in `art/source/tempered-generated/`. Several generated
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
