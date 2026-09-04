# 07 — Build plan

Work these in order. Do not start a phase until the previous phase's acceptance
criteria pass. Commit at the end of each phase with the phase number in the message.

---

## Phase 0 — Skeleton

Plain ES modules, no build step. Directory structure per `CLAUDE.md`. `node --test`
wired. PWA manifest and service worker. GitHub Pages serves the repo root.

**Acceptance:**
- `index.html` opens in a browser with no build step.
- `node --test` runs and passes.
- The app installs to an iPhone home screen from the Pages URL and opens offline.

> Serve the directory to open it — `python3 -m http.server` from the repo root is
> enough. Browsers block `<script type="module">` over `file://` as a cross-origin
> request, so opening `index.html` by double-clicking it will load the page but never
> run the script. This is a browser rule, not a build step.

---

## Phase 1 — Domain: the XP engine

Pure logic, no UI, no storage. This is the most important phase in the project.

Implement per `docs/01-attributes-and-xp.md`:
- Attribute XP calculation from a logged session
- PR detection (weight and volume, per exercise)
- Estimated 1RM
- Level and tier resolution from XP
- Rank derivation
- Directive generation

Load all constants from `data/balance.json`.

**Acceptance:**
- Unit tests cover every XP source with at least one example each.
- A test proves body weight value never affects XP in any direction.
- A test proves Grit has no streak multiplier.
- `docs/BALANCE-PROJECTION.md` exists with the 30/90/180/365 day table, and the numbers
  fall inside the bounds in `docs/01`. **Retune and regenerate until they do.**

---

## Phase 2 — Persistence and adapters

Storage adapter over IndexedDB. Health adapter interface with a manual-entry
implementation. Clock adapter. Full JSON export and import with schema versioning.

**Acceptance:**
- Domain layer imports no browser API directly. A test asserts this.
- Data survives reload, browser restart and app relaunch.
- Export produces a file; import restores it exactly; importing a mismatched schema
  version is refused with a clear message rather than corrupting state.
- Import never silently overwrites; it asks first.

---

## Phase 3 — Workout tracker

The deepest feature. Build before the RPG surface.

- Exercise library seeded from `data/exercises.json`, user-extensible
- Routines: named groups of exercises with prescribed sets, reps, working weight
- **Full session:** start routine, work through exercises, log each set, rest timer,
  finish
- **Ad-hoc single exercise:** open one exercise without starting a routine, see last
  performance, log sets
- Progression rules per exercise, defaulting to 5/3/1
- History: sessions, per-exercise records, PR list

**Acceptance:**
- A full lower-body session can be logged in under 90 seconds of tapping.
- An ad-hoc set of curls can be logged in under 20 seconds from app open.
- Last performance and PR are visible before the first set is entered.
- Finishing a session produces the correct attribute XP per Phase 1, verified by test.

---

## Phase 4 — Daily tracking

The habit and metric surface: today's activities, quick completion, manual numeric
entry, sleep, water, nutrition, rest day, body metrics.

**Acceptance:**
- Today's screen loads in one view with no scrolling to see what is outstanding.
- Any single item completes in one tap or one number plus one tap.
- Rest day is a first-class rewarded action.
- Body metric entry shows the number back to the user but awards XP only for logging.

---

## Phase 5 — Character surface

The five attributes with levels, tiers, progress bars and their XP sources made visible.
Rank. Titles. The post-session chain.

**The post-session chain is one screen, not four.** Ascent uses four modals for this and
it is the clearest thing to improve on. Show: what you did, what it earned, what
levelled, what is next. One screen, scrollable, with a single dismiss.

**Acceptance:**
- Tapping any attribute reveals exactly which activities feed it and what each is worth.
- After a session, the user sees the causal chain from performance to progression
  without dismissing more than one screen.

---

## Phase 6 — The daily battle

Passive. Once per day. Costs no interaction.

- Hero stats derived from attributes per `docs/06-battle.md`
- A gauntlet of enemies scaled to rank
- Deterministic resolution, seeded by date so it cannot be rerolled
- Playback with pause, 1x speed and skip
- Rewards: gold, XP, occasionally an item
- Re-watchable

**Acceptance:**
- The battle resolves identically for the same day and seed on every replay.
- Skipping to the result is always available and never punished.
- A user who never opens the battle screen loses no progression.

---

## Phase 7 — Setup and onboarding

First-run flow: name, plan shape, starting lifts and working weights, which activities
matter, unit preferences. Re-runnable from settings.

**Acceptance:** a new user reaches a usable Today screen in under two minutes without
reading documentation.

---

## Phase 8 — Polish pass

Only after everything above passes. Motion, empty states, error states, accessibility,
reduced-motion, dynamic type.

- **Display typeface.** `docs/04-design-system.md` asks for a condensed geometric sans
  (Chakra Petch, Rajdhani, or Barlow Condensed). A font CDN would break the offline and
  local-first rules, so the chosen face must be vendored into the repo as woff2 and
  `--font-display` pointed at it. Until then it aliases the system stack, which renders
  every screen correctly — this blocks nothing.

---

## What is explicitly out of scope for V1

Social, friends, feeds, leaderboards. Notifications. Cloud sync. HealthKit. Muscle
activation maps. An exercise database beyond the seed. Interactive combat. Multiple
characters. Item crafting or an economy beyond the battle's gold.
