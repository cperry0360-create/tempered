# CLAUDE.md — read this first, every session

You are building **Tempered**, a health and training tracker with an RPG progression
layer. This file is the contract. Re-read it at the start of every session.

## The one-line version

Real training data drives character progression. Nothing is awarded for ticking a box
that could be awarded for doing the work.

## Non-negotiables

1. **Tracker first.** If the RPG layer were deleted, what remains must still be a good
   workout and habit tracker. Never sacrifice logging speed for game flavour.
2. **Attributes grow from measured performance**, not from completions, wherever a
   measurement exists. A squat PR raises Might. Checking "I lifted" does not.
3. **The mapping must be legible.** What you did should obviously explain what grew.
   Never map lifting PRs to Intelligence. If you cannot justify a mapping in one
   sentence to the user, it is wrong.
4. **No punishment.** No negative XP, no lost levels, no broken-streak shaming. Missing
   days simply produces no gain. Rest is a loggable, rewarded action.
5. **Local-first.** The app must work fully offline with no backend. All persistence
   goes through a storage adapter so cloud sync can be added later without touching
   domain logic.
6. **Adapters at every boundary.** Storage, health data, and clock are interfaces with
   swappable implementations. Domain logic never imports IndexedDB or `Date.now()`
   directly.
7. **Balance lives in config, not code.** Every XP value, curve, cap and threshold sits
   in `data/balance.json`. Changing balance must never require editing logic.
8. **Dark tactical visual language.** See `docs/04-design-system.md`. No illustration is
   required to ship. Do not invent decorative art.
9. **The name means something. Use it.** Tempering is strengthening through controlled
   stress followed by rest. Rest is therefore never framed as absence, failure or a
   break in a streak — it is half the process. Copy should reflect this. Words to
   prefer: tempered, forged, worked, load, recovery. Words to avoid: crushed, beast
   mode, no excuses, streak lost, failed.

## What this is NOT

- Not an interactive game. The only combat is a passive daily cutscene.
- Not a 500-exercise database with muscle maps. Cory's lifts, extensible.
- Not a social app. No feeds, no friends, no leaderboards in V1.
- Not a notification machine. V1 sends none.

## How to work

- **Follow `docs/07-build-plan.md` in order.** Each phase has acceptance criteria.
  Do not start phase N+1 until phase N's criteria pass.
- **Write the test first for anything in `src/domain/`.** The XP engine, progression
  curves and workout progression rules must be unit tested. UI need not be.
- **Log every decision** you make that is not specified here into `DECISIONS.md`, with
  the reasoning. If you had to guess, say so explicitly and flag it for Cory.
- **Never invent product philosophy.** If a rule is genuinely ambiguous, implement the
  simplest defensible version, write it in `DECISIONS.md` under "Needs Cory", and move
  on. Do not stall.
- **Commit per phase**, with the phase number in the message.

## Stack

- Vanilla TypeScript, Vite, no UI framework. No runtime dependencies beyond dev tooling.
- IndexedDB via a thin wrapper in `src/adapters/storage/`.
- Vitest for domain tests.
- PWA: manifest + service worker, installable, works offline.
- Deploys as static files to GitHub Pages.

Rationale: this app is a few dozen screens of forms and lists over a numeric engine.
A framework would add more weight than it removes, and the domain layer must stay
portable if a native wrapper is added later.

## Repository map

- `docs/` — the specification. Authoritative.
- `data/` — seed content and balance config. JSON, hand-editable.
- `src/domain/` — pure logic. No I/O, no DOM. Fully tested.
- `src/adapters/` — storage, health, clock.
- `src/ui/` — screens and components.
- `DECISIONS.md` — your running log.
