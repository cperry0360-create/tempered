# CLAUDE.md — read this first, every session

You are building **Tempered**, a health, training, and lifestyle tracker with a small
positive companion layer. This file is the contract. Re-read it at the start of every
session, then read `docs/CURRENT-STATE.md` for the latest shipped state.

## The one-line version

Make healthy things fast to record, make progress easy to understand, and let accumulated
real-world care grow a warm companion world. The tracker must stand on its own.

## Non-negotiables

1. **Tracker first.** Today, Train, and Progress must remain a good product without the
   Companion. Never sacrifice logging speed or clarity for the reward layer.
2. **Measured data stays authoritative.** Sets, load, reps, duration, steps, sleep,
   hydration, nutrition, and body metrics come from canonical logs. A visual reward or
   completion control must never manufacture a measurement.
3. **The mapping must be legible.** What the user did should obviously explain what
   changed in Progress or Companion. If it cannot be justified in one sentence, it is
   wrong.
4. **No punishment.** No negative XP, no lost levels, no broken-streak shaming. Missing
   days simply produces no gain. Rest is a loggable, rewarded action.
5. **Local-first.** The app must work fully offline with no backend. All persistence
   goes through a storage adapter so cloud sync can be added later without touching
   domain logic.
6. **Adapters at every boundary.** Storage, health data, and clock are interfaces with
   swappable implementations. Domain logic never imports IndexedDB or `Date.now()`
   directly.
7. **Legacy progression remains data-driven.** Retained XP values and curves stay in
   `data/balance.json`. Do not surface or expand the old Character/Battle system.
8. **Warm premium wellness visual language.** Normal screens use deep navy, teal/aqua,
   fresh green, warm cream/gold, translucent dark cards, scenic wellness backgrounds,
   and the ember-sprout companion under `art/tempered/`. Avoid pixel art, combat,
   monsters, office/corporate themes, threatening imagery, and baked UI text.
9. **The name means something. Use it.** Tempering is strengthening through controlled
   stress followed by rest. Rest is therefore never framed as absence, failure or a
   break in a streak — it is half the process. Copy should reflect this. Words to
   prefer: tempered, forged, worked, load, recovery. Words to avoid: crushed, beast
   mode, no excuses, streak lost, failed.

## What this is NOT

- Not an RPG or battle game. Character/Battle code remains internal only so old local
  data and regression fixtures keep working. It is absent from normal navigation and
  must not receive new product features.
- Not a second pet-care obligation. The Companion never gets sick, decays, loses items,
  or punishes inactivity. It grows from activity Tempered already records.
- Not a 500-exercise database with muscle maps. Cory's lifts, extensible.
- Not a social app. No feeds, no friends, no leaderboards in V1.
- Not a notification machine. V1 sends none.

## How to work

- **Treat `docs/CURRENT-STATE.md` as current product scope.** The original
  `docs/07-build-plan.md` remains useful for acceptance criteria and history, but it
  must not reintroduce visible RPG work that the tracker-first pivot removed.
- **Write the test first for anything in `src/domain/`.** The XP engine, progression
  curves and workout progression rules must be unit tested. UI need not be.
- **Log every decision** you make that is not specified here into `DECISIONS.md`, with
  the reasoning. If you had to guess, say so explicitly and flag it for Cory.
- **Never invent product philosophy.** If a rule is genuinely ambiguous, implement the
  simplest defensible version, write it in `DECISIONS.md` under "Needs Cory", and move
  on. Do not stall.
- **A test that cannot fail is not evidence.** When you write a test for something that
  already works, prove it can fail — point it at broken or empty state and confirm it
  reports failure — before trusting a pass. The Phase 2 persistence harness is the
  example: it reported three green passes while asserting nothing, because the DOM was
  snapshotted before any of the asynchronous work had run.
- **Some bugs are only visible to an eye.** Assertions check what you thought to check.
  At the end of any phase that changes the interface, capture a screenshot of each screen
  it touched and look at them — the Phase 3.7 tab bar was visible through every session
  since Phase 3 and 21 assertions never saw it.
- **Commit per phase**, with the phase number in the message.

## Stack

No build step. No dependencies. Nothing to install.

- Plain ES modules (`.js`), loaded natively by the browser via
  `<script type="module">`. No bundler, no transpiler, no framework.
- **JSDoc type annotations instead of TypeScript.** Types are checked by the editor
  (`jsconfig.json`, `checkJs`), never by a compiler in the loop.
- `node --test` for domain tests. Built into Node since v18, so nothing to install.
- No `package.json`, no lockfile, no `node_modules`.
- IndexedDB via a thin wrapper in `src/adapters/storage/`.
- PWA: manifest + hand-maintained `sw.js` at the repo root, installable, works offline.
- **GitHub Pages** serves the repository root from `main` at the `/tempered/` project
  path. There is no build command; what is committed is what is served. `.nojekyll`
  disables Jekyll processing. The former Netlify site may remain as a fallback, but
  GitHub Pages is the primary production host. See "Deployment" in `README.md`.

Rationale: this app is a few dozen screens of forms and lists over a numeric engine.
A bundler earns nothing here — there is no dependency tree to resolve, no JSX to
compile, and every browser this targets loads ES modules natively. A framework would
add more weight than it removes, and the domain layer must stay portable if a native
wrapper is added later.

The stronger reason is this: **a toolchain we cannot run is worse than no toolchain,
because it means code that is never executed.** Everything in this repo can be run,
tested and deployed with nothing but a browser and the `node` binary.

Two consequences worth remembering:

- **Relative paths everywhere.** Nothing rewrites URLs at build time. `./src/main.js`,
  not `/src/main.js`, or the app breaks under the `/tempered/` project-page path.
- **Import extensions are mandatory.** `./pwa/register.js`, never `./pwa/register`.
  The browser does not resolve extensions.

## Repository map

- `docs/CURRENT-STATE.md` — authoritative current product and continuity handoff.
- `docs/` — detailed specifications and history. Where an RPG-era document conflicts
  with `CURRENT-STATE.md`, the current-state document wins.
- `data/` — seed content and balance config. JSON, hand-editable.
- `src/domain/` — pure logic. No I/O, no DOM. Fully tested.
- `src/adapters/` — storage, health, clock.
- `src/app/` — wiring. Services that join domain to adapters, and bootstrap.
  Knows about both sides; neither side knows about it.
- `src/ui/` — screens and components.
- `DECISIONS.md` — your running log.
