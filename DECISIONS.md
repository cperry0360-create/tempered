## 2026-10-01 — iOS standalone bottom band

Cory's installed iPhone screenshot showed the area below the tab bar using the page
background. The cause was the app shell's `height: 100dvh` / `max-height: 100dvh` in
`src/polish.css`, combined with `body { overflow: hidden }`: WebKit standalone viewport
units can omit the safe-area region with `viewport-fit=cover` (WebKit bug 254868).
The release-visual Chromium captures used ordinary browser mode and could not expose
this. In standalone display mode, set `html`, `body`, and the app shell to `100vh`; keep
safe-area padding on the tab bar so labels remain above the home indicator. This is
covered by a source regression; physical iPhone confirmation remains required.

## 2026-09-30 — R6 Today rollover and device fixes

### Pre-R2 Today rollover behavior (baseline d9850f5)

`src/ui/today-workout.js` already provided the canonical behavior before R2:

- `buildDailyWorkoutQueue(weekStatus, today)` lists unfinished slots from earlier
  weekdays alongside today's unfinished movements, leaves future work hidden, and keeps
  today's completed movements available for disclosure.
- A movement row launches only its original `{ dayId, slotIndex, exerciseId, slot,
  alreadyLogged }` through `startSession({ slotTask })`, preserving between-call logging
  against the same program slot.
- The full-session route uses `remainingProgramDay()` so completed slots are skipped and
  partially completed slots request only their remaining sets without shifting indexes.
- Train shows the same current-week status; rollover work is not deleted or reclassified as
  missed work.

R6 keeps this behavior directly in the Today screen. It replaces the disconnected
MutationObserver enhancer with native DOM rendering and keeps individual slot sessions,
rollover disclosure, completed movement disclosure, full-session start, and canonical
program-day records in their specified places.

### Device-layout cause found before CSS edits

- The final rendered tab bar sits at `bottom: 0` and already spans the viewport width. The
  excess gap under its labels comes from `calc(8px + env(safe-area-inset-bottom))` on the
  bar plus 4px bottom padding on each tab button. With a 34px bottom inset that is 46px
  below the labels; the spec calls for only the inset. The stylesheet also has two separate
  `.tabbar` blocks, with the later block silently overriding the older floating geometry.
- The active-session header receives the top inset twice: the shell's final
  `.app__body` rule adds `calc(env(safe-area-inset-top) + 16px)`, then `.sessionbar--r3`
  adds `env(safe-area-inset-top)` again. R6 will leave the session header as the single
  owner of that inset.
- The app uses percentage-height roots (`html`, `body`, `.app`) and does not use `100vh` or
  `100dvh`; the source therefore does not support a viewport-height mismatch as the cause.

**R6 preservation check:** Today still keeps its existing habit/nutrition/recovery,
calendar/date review, planner, Daily Recap, companion/settings, and activity logging
behaviors. Program movements again roll forward by slot and can be logged one at a time;
Train mirrors the rollover count. The completion, full-session, and one-slot paths all use
the canonical workout service records.

## 2026-09-30 — R3.1 preservation audit result

Audit command scope: `git diff d9850f5 HEAD -- src/ui/screens/`, interpreted under
Redesign V1 section 0.1. The following pre-redesign features were removed or materially
reduced by R2/R3/R4 and were not specifically authorized for removal:

- **Restored — Active workout prescriptions:** progression values now remain real input values
  from `prepared.proposal.sets`; Previous remains a separate copy action. One check tap logs the
  displayed prescription.
- **Restored — Active workout coaching:** `entry.proposal.reason` is the first-choice coaching
  line; slot cue/setup is fallback only.
- **Restored — Active workout art:** every exercise with `exercise.art` gets the 56px thumbnail;
  tapping it opens the full reference image panel.
- **Restored — Active workout Best:** one-line Best load × reps · date sits under the exercise
  header when a record exists.
- **Restored — Active workout plates:** the next unlogged barbell set gets a compact per-side line
  directly beneath its 52px row, driven by the same solver, bar weight, and available-plate state.
- **Kept — Active workout menu/actions:** History, Swap, Method, Plate settings, cable/machine
  settings, Notes, Rest timer, Minimize, Move up/down, and Remove remain in the ⋯ path. Add
  movement, set types, swipe removal, add-set, undo, finish confirmation, draft/resume,
  wake-lock, deload, and canonical settlement remain in their R3 locations.
- **Restored — Today date navigation:** moved to Today → Day details. Past and future days remain
  viewable; future dates remain non-loggable.
- **Restored — Today planner:** create, complete/reopen, edit title/notes/due date/type, rollover
  metadata, and delete live in Today → Day details.
- **Restored — Today individual program exercise logging:** weekly exercise/frequency aggregation
  and one-exercise slot logging live in Today → Day details → Program exercises; the full-session
  start remains the main Today card.
- **Restored — Today daily recap:** training minutes, working sets, exercise/session counts, and
  the lifestyle recap host live in Today → Day details.
- **Restored — Today earned-XP feedback:** a compact line appears inside Daily log after a
  canonical log awards XP.
- **Kept — Today habit behavior:** mark/numeric/additive logging, configurable quick-add, sleep
  decimal shortcuts, guided Mobility flows/timer, completed-row ordering, extra logging, Fuel
  handoff, Readiness import/info, companion, settings, and session start remain in the R2 layout.
- **Kept — Today first-week guidance:** the next-session card keeps a one-line guidance footnote
  during week 1 rather than restoring the old extra card.
- **Restored — Train hard-set guide:** moved into Program details so weekly muscle-group set
  targets remain inspectable without restoring the removed weekly slot bars.
- **Restored — Train exercise-library PR:** PR load × reps is again shown beside last-worked
  context in Exercise library.
- **Kept — Train program/routines/library/rhythm:** program note and deload guidance live in
  Program details; next-session guidance, program-day starts, routine detail/start, searchable
  ad-hoc Exercise library, and the full historical Training rhythm detail remain available.
- **Specified removals left removed:** Train weekly slot bars, Workout control center, stat tiles,
  Train AI button, duplicated Active Program block; Fuel Recovery/health card, companion content,
  Open Today, No meals yet, eyebrow/subtitle; Today duplicated Active Program, old tile/grid
  presentations, control center, standalone Weekly goals, circular recovery import, and Today AI.
- **Kept — Fuel working features:** calorie target/ring, protein and macro totals, meal-journal
  launch, Recent one-tap nutrition suggestions, water target and +8/+12/+25 logging, and
  fuel-updated refresh remain in the R4 layout.

**Fail-first evidence:** commit `7fc7584` added `test/browser/session-r31.html` before the
implementation. Hosted Chromium reported 8 failures: prescribed inputs were placeholders,
one tap logged last-session values, and art/Best/plate evidence was absent. The progression
engine's actual RDL proposal for the seeded 125 × 12 history was 135 × 8, so the passing test
asserts the engine-produced prescription and separately rejects 125 × 12 rather than hard-coding
the specification's illustrative 130 × 8.

**Needs Cory:** none. All restored placements follow section 0.1 rule 3.

## 2026-09-30 — R3.1 pre-redesign feature inventory (baseline d9850f5)

Section 0.1 makes `d9850f5` the preservation baseline. This inventory covers the working
behaviour in the four redesign-touched screen modules before R2/R3/R4. Items named for removal
by Redesign V1 are retained here for audit clarity but are marked **specified removal** rather
than candidates for restoration. Final R3.1 status and location are recorded below this inventory.

### Today — `src/ui/screens/today.js`

- Daily activity logging through the canonical daily service: mark activities, numeric values,
  additive values, daily goals, weekly goals, and completed-state handling.
- One-tap configurable quick-add amounts for additive activities, with manual entry still
  available after completion where appropriate.
- Sleep logging with decimal-hour entry and common-hour quick choices.
- Mobility logging with four guided routines, movement cues, countdown timer, and
  complete-and-log action.
- Date navigation across calendar weeks, including past/future day selection, return-to-today,
  and prevention of logging into future dates.
- Personal/work planner tasks for the selected date: create, complete/reopen, open details,
  edit task metadata, delete, and separate personal/work kinds.
- Program training for the day: start the full prescribed session or open individual program
  exercise slots; weekly exercise-frequency aggregation and extra-slot logging when a frequency
  target still needs work.
- Completed training/worked-item disclosure so already logged activity remains inspectable.
- First-week guidance derived from the active program.
- Daily recap overlay with lifestyle host plus training minutes/sets/exercise/session totals.
- Earned-XP feedback after logging.
- Daily and weekly activity grouping plus an extra-logging path for off-schedule activities.
- **Specified removals/moves:** duplicated Active Program presentation, old weekly tile/grid
  presentation, Workout control center, inline readiness explanation, circular recovery import,
  AI progress button, Weekly goals presentation, and the standalone Log something else surface.
  The spec moves readiness explanation behind info, AI to Progress, and Log something else into
  Daily log.

### Active workout — `src/ui/screens/session.js`

- Session elapsed timer with visibility/pagehide checkpointing, resumable elapsed time, browser
  and native wake-lock handling, and a persisted active-session draft.
- Rest timer stored as an absolute `endsAt` timestamp so sleeping/backgrounding does not drift it.
- Progression-engine prescriptions from `prepared.proposal.sets` prefilled as real input values.
- One-tap set logging of the values visibly present in those inputs; undo removes the canonical
  stored set.
- First-set edits cascade weight/reps/time to later unlogged sets without rewriting logged history.
- Previous-session performance, method-specific history, and method switching with logged-set lock.
- Progression proposal reason displayed as coaching guidance.
- Exercise reference art: thumbnail plus tap-to-open full image panel.
- Best/PR performance with load, reps, and date.
- Barbell plate calculator beside the next set, using editable bar weight and available plates.
- Exercise swap while preserving set structure and substitution identity.
- Rest-duration editing.
- Set editing/removal and add-set.
- Exercise reordering.
- Add-movement search during a live session without changing the saved program.
- Program-day, single-slot, routine, and ad-hoc single-exercise session starts.
- Slot/session metadata including program day, slot index, substitutions, method, per-side flag,
  time/distance variants, and canonical set index.
- Deload message.
- Finish confirmation and correct settlement semantics for full blocks versus a single slot.
- Resume reconciliation against IndexedDB so stored set logs remain canonical after process death.
- **Specified layout moves:** horizontal exercise action chips and up/down controls move into the
  ⋯ menu; minimize bar moves into the ⋯ menu/tab switching; set removal becomes swipe-left; set
  type selector adds Working/Warm-up/Drop/Failure; rest controls move to the sticky rest bar.

### Train — `src/ui/screens/train.js`

- Active-program name, week, note, deload state, program days, and start-session actions.
- First-week/next-useful-session guidance.
- Program weekly slot progress.
- Hard-sets-per-muscle guide derived from logged work and program targets.
- Training-rhythm history across recorded weeks, including trained versus qualifying days,
  current week, Away protection, streak/keeper state, and weekly duration threshold.
- Routines with exercise/set counts and direct workout start.
- Exercise library search and ad-hoc single-exercise start.
- Exercise-library last-worked date and PR/best-weight display.
- Readiness estimate and recent 7-day training stats.
- ChatGPT coaching handoff with 14-day/latest-workout data and confirmed-PR derivation.
- **Specified removals/moves:** weekly slot bars, Workout control center, stat tile grid, Train AI
  button, and duplicated Active Program block are removed; AI moves to Progress. Training history
  and rhythm move behind the Training rhythm row. Routine start moves to routine detail.

### Fuel — `src/ui/screens/fuel.js`

- Current-day calories against target and calories-left energy visualization.
- Protein against target plus nutrition-ledger macro totals.
- Meal-journal launch and display of recent logged meals.
- Water total against target with one-tap +8/+12/+25 oz logging.
- Fuel-updated event refresh so nutrition changes appear without leaving the screen.
- **Specified removals:** Recovery/readiness/health-metric card, Fuel companion content,
  Open Today button, No meals yet box, eyebrow, and subtitle. These are intentionally not restored.
- **R4-prescribed replacement retained:** Recent quick-log suggestions derived from prior nutrition
  entries, with one-tap re-logging through the canonical daily nutrition service.

Warning: truncated output (original token count: 41497)
Total output lines: 2654

# Decisions log

Claude Code: append an entry for every choice you make that is not specified in the
docs. Be explicit when you guessed.

Format:

```
## YYYY-MM-DD — <short title>
**Phase:** N
**Decision:** what you did
**Reasoning:** why
**Confidence:** specified | inferred | guessed
**Needs Cory:** yes/no — if yes, state the question plainly
```

---

## 2026-09-03 — .gitignore exception for art/dist/
**Phase:** 0 (pre-phase — repo restructure)
**Decision:** The requested `dist/` rule also matched `art/dist/`, which must stay in the
tree via `.gitkeep`. Added `!art/dist/`, `art/dist/*`, `!art/dist/.gitkeep` beneath it so
`art/dist` exists in git but its generated contents stay ignored.
**Reasoning:** `art/dist/` is import_art.py output — the directory is structure, the files
in it are build artefacts. Keeping the literal `dist/` rule preserves the intent for the
Vite build output at the root.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — Left stray root `Readme.md` in place
**Phase:** 0 (pre-phase — repo restructure)
**Decision:** The repo contains both `README.md` (the real one) and `Readme.md` (a single
newline, from the initial GitHub "Create Readme.md" commit). Left `Readme.md` untouched.
**Reasoning:** Deleting files was not part of the restructure request. On a
case-insensitive filesystem (macOS) the two names collide, so it likely wants removing.
**Confidence:** guessed
**Needs Cory:** yes — delete the empty `Readme.md`? It will shadow/collide with `README.md`
on macOS and Windows checkouts.

## 2026-09-03 — Standing instruction: commit directly to main
**Phase:** n/a — process
**Decision:** No feature branches. All work is committed and pushed straight to `main`.
**Reasoning:** Cory's instruction, 2026-09-03: solo project, branches add overhead
without benefit. This supersedes any per-task branch instruction.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-03 — Hand-written service worker instead of a PWA plugin
**Phase:** 0
**Decision:** The service worker is `src/pwa/sw-template.js`, emitted to `dist/sw.js` by a
~30-line plugin in `vite.config.ts` that substitutes the cache name, the precache list and
the shell URL. No `vite-plugin-pwa`.
**Reasoning:** The precache list must name Vite's content-hashed filenames, which are only
known at build time — hence generation rather than a static file in `public/`. A plugin
dependency would be build-time only and so allowed by the stack rules, but the whole
caching policy here is about 60 lines and worth owning outright. Navigations are
network-first with a cached-shell fallback; hashed assets are cache-first.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — GitHub Pages base path is /tempered/
**Phase:** 0
**Decision:** `base` defaults to `/tempered/`, overridable with `BASE_PATH=/`.
**Reasoning:** Project pages serve from `https://<user>.github.io/tempered/`. A custom
domain or a user-pages repo would need `BASE_PATH=/`.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — System font stack, no display face yet
**Phase:** 0
**Decision:** `--font-display` currently aliases `--font-ui` (Inter, then the system
stack). No web font is loaded.
**Reasoning:** `docs/04-design-system.md` asks for a condensed geometric display face
(Chakra Petch / Rajdhani / Barlow Condensed). Fetching it from a font CDN would break the
local-first and offline rules, so it has to be vendored into the repo as woff2. That is a
file-adding decision, not a code one.
**Confidence:** guessed
**Needs Cory:** no — reclassified 2026-09-04 as a Phase 8 polish item. It blocks nothing:
the system stack renders every screen correctly today. Recorded in `docs/07-build-plan.md`
under Phase 8.

## 2026-09-03 — Node types are project-wide rather than split by tsconfig
**Phase:** 0
**Decision:** One `tsconfig.json` with `"types": ["vite/client", "node"]`, rather than the
split app/node project-reference layout.
**Reasoning:** `vite.config.ts` needs `node:crypto`, `node:fs` and `process`. The split
layout is tidier but I cannot run a build in this environment to prove it works, so I took
the configuration I could reason about with certainty. Domain purity is enforced by the
Phase 2 acceptance test that asserts the domain imports no platform API — a stronger check
than type visibility.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — PWA icons are 180/512/1024 only
**Phase:** 0
**Decision:** `public/icons/` holds icon-180 (apple-touch), icon-512 and icon-1024. No
192px icon.
**Reasoning:** `art/source/` has no 192px source and no image library is available in this
environment to resample one. 512 satisfies installability; 180 is what iOS home-screen
install actually reads. `art/import_art.py` is the right place to generate a full set.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — Phase 0 acceptance could not be executed in this environment
**Phase:** 0
**Decision:** Committed the Phase 0 skeleton without running `npm run dev`, `npm run build`
or `npm test`.
**Reasoning:** The npm registry is blocked by this session's egress policy — every package
returns HTTP 403, so no dev dependency can be installed. What I could verify locally: the
generated service worker was produced by simulating the plugin and passes `node --check`;
`src/**/*.ts` typechecks under the global tsc with `vite/client` stubbed; the manifest is
valid JSON; the workflow is valid YAML; icon dimensions are confirmed 180/512/1024.
**Confidence:** specified (the block), inferred (the response)
**Needs Cory:** yes — run `npm install && npm test && npm run build && npm run dev` once
locally and confirm. That install also produces the first `package-lock.json`, after which
`.github/workflows/deploy.yml` should switch `npm install` to `npm ci` and re-add
`cache: npm`.

## 2026-09-03 — Stack change: no build step, no dependencies
**Phase:** 0
**Decision:** Removed Vite, TypeScript, Vitest, `package.json`, `tsconfig.json` and the
GitHub Actions deploy workflow. The app is now plain ES modules loaded natively by the
browser, typed with JSDoc, tested with `node --test`, and served by GitHub Pages straight
from the repository root.
**Reasoning:** Cory's instruction, 2026-09-03, and the reason stands on its own: this app
is forms and lists over a numeric engine, so a bundler earns nothing — no dependency tree
to resolve, no JSX to compile, and every target browser loads ES modules natively. The
decisive argument is that `registry.npmjs.org` is not reachable from the environment this
project is built in (`x-deny-reason: host_not_allowed`), and a toolchain that cannot be
run means code that is never executed. Phase 0 previously shipped unverified for exactly
that reason. Everything now runs with a browser and the `node` binary alone.
**Confidence:** specified
**Needs Cory:** no — but the Pages source must be set to "Deploy from a branch: `main`,
`/(root)`". Cory is doing this.

## 2026-09-03 — ES modules do not load over file://
**Phase:** 0
**Decision:** Phase 0's first acceptance criterion is kept as written — "`index.html`
opens in a browser with no build step" — with a note that the directory must be served,
e.g. `python3 -m http.server`.
**Reasoning:** Verified in Chromium 141: a page opened as `file://` with
`<script type="module">` loads but never runs the script, because the module fetch is
cross-origin from an opaque `null` origin. The identical page over `http://` runs it.
This is a browser security rule, not a build step, and it applies to any bundler-free
setup. Service workers also require a secure context, which `file://` is not, so offline
support could not work there either.
**Confidence:** specified (measured, not recalled)
**Needs Cory:** no

## 2026-09-03 — Service worker is hand-maintained, stale-while-revalidate
**Phase:** 0
**Decision:** `sw.js` sits at the repo root with a hand-written precache list and a
`VERSION` constant. Navigations are network-first with a cached-shell fallback; all other
same-origin GETs are stale-while-revalidate.
**Reasoning:** Without a build step there are no content-hashed filenames, so nothing can
generate the precache list and nothing busts the cache automatically. Cache-first would
pin users to old code until someone remembered to bump `VERSION` — and forgetting is the
obvious failure mode. Stale-while-revalidate makes a missed bump cost one stale load
rather than a stuck app, while a deliberate bump still forces a clean sweep. `sw.js` must
stay at the root: a worker's scope cannot rise above its own directory.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — Correction: art/dist/ is committed, not ignored
**Phase:** 0
**Decision:** Removed the `art/dist/*` ignore rule added earlier today. Processed sprites
are now tracked.
**Reasoning:** My earlier rule treated `art/dist/` as build output. Under root-serving
Pages that is wrong: `docs/08-art.md` says `art/dist/` holds "processed sprites the app
loads", and what is not committed is not served. The rule would have broken the battle
screen in Phase 6. `art/import_art.py` still owns the contents — never hand-edit them.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-03 — jsconfig.json, .nojekyll, and a test/ directory
**Phase:** 0
**Decision:** Three small additions. `jsconfig.json` enables `checkJs` so the JSDoc
annotations are actually enforced; it installs nothing, since editors ship their own
TypeScript. `.nojekyll` stops GitHub Pages running Jekyll over a branch deploy. `test/`
holds tests that are not domain logic — currently one asserting every file in `data/`
parses as JSON.
**Reasoning:** Without `checkJs` the JSDoc types are decorative. `sw.js` is excluded from
it because service worker globals need the `WebWorker` lib, which collides with `DOM`.
`test/` is a small addition to the repository map: `CLAUDE.md` requires domain tests to
live beside domain code, and this is not domain code.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-03 — Spec paths updated off TypeScript
**Phase:** 0
**Decision:** `docs/02-data-model.md` now points at `src/domain/types.js` (JSDoc
`@typedef`s) and `docs/BALANCE-PROJECTION.md` at `src/domain/balance.projection.test.js`.
**Reasoning:** Both named `.ts` files that can no longer exist. Left alone they would have
misdirected Phase 1. Paths only — no specified behaviour was touched.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 1: balance retuned from simulation, not guessed
**Phase:** 1
**Decision:** `levelCurve.base` 260 -> 400 and `exponent` 1.85 -> 2.45. Might's rates cut
to roughly a third; the other four attributes moved by under 35% either way.
**Reasoning:** The shipped values had never been run. Simulated, Might hit the level 10 cap
by day 60 and every attribute by day 180, ending the year at rank S with all five maxed.
Two anchors in `docs/01` pin the curve completely — level 1 inside the first session, level
10 near a year — and their ratio is roughly the number of sessions in a year (~180), which
forces an exponent near 2.45, not 1.85. `base` 400 is one honest first session (435 XP).
Might needed cutting because volume XP scales with load moved, and load moved is a large
number: it outscored the other attributes five to one. It still leads, by two levels rather
than by a cap. Year-end is now Might 9, Grit 8, Vitality 8, Wind 7, Mind 7 — rank B, 39
levels, spread 2.
**Confidence:** specified (the checks), inferred (the target level profile)
**Needs Cory:** no

## 2026-09-04 — First performance sets a baseline; it is not a PR
**Phase:** 1
**Decision:** A weight/volume/e1RM record must be *beaten*. The first time an exercise is
performed it establishes the record and earns no PR bonus.
**Reasoning:** Otherwise a first session pays a weight PR for every movement in the routine
at once — seven bonuses for showing up once. That distorts early balance and cheapens the
moment a PR is supposed to mark.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Bodyweight exercises earn no Might volume
**Phase:** 1
**Decision:** A set with `weight: null` (pull-up, single-leg calf raise, plank) contributes
nothing to Might volume. It still earns Grit through the session and can still set rep
records later.
**Reasoning:** The alternative is scoring them at the user's body weight, which the hard
rule in `docs/01` forbids — and rightly: it would mean a heavier user earns more Might, and
losing weight costs it. No notional load was invented because that is a new scoring
mechanism rather than a tuning value.
**Confidence:** guessed
**Needs Cory:** yes — pull-ups currently earn no Might at all. Options: a per-exercise
notional load in `data/exercises.json`, or Might credit from a reps PR. Neither is invented
without your call.

## 2026-09-04 — Interpretations where docs/01 left room
**Phase:** 1
**Decision:** Six readings, each the simplest defensible one.
1. `xpForLevel(n)` is the *cumulative* XP to stand at level n, not that level's incremental
   cost. Plainest reading of the name, and still superlinear per level.
2. The isolation multiplier applies to every Might source for that exercise (volume, PRs,
   e1RM), not volume alone — "isolation counts at a reduced rate", full stop.
3. Grit's training hours accrue smoothly (`duration x rate`) rather than firing at whole-hour
   thresholds. Same lifetime total, no cliff.
4. Sleep "near" the 7-9 band means within one hour of an edge.
5. Cardio logged with a distance is scored by distance; cardio logged only as time is scored
   by time. A run with both is never paid twice — its minutes feed pace only.
6. Instrument practice and mobility have no rate of their own in `balance.json`; they score
   at the study and cardio-minute rates respectively.
**Reasoning:** Each is the reading that avoids double-paying or inventing a mechanism.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Each attribute is fed from exactly one place
**Phase:** 1
**Decision:** A session feeds Might and Grit. A day feeds Wind, Vitality and Mind. A cardio
session is still a session (it earns Grit for showing up) while the distance it covered is
logged against the day and earns Wind there.
**Reasoning:** Legibility, per non-negotiable 3. One input, one attribute, no route by which
the same effort is counted twice. `SessionInput` no longer carries a `cardio` field so the
double-count is not merely avoided but unrepresentable.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Bug found by the projection: the first session is not a "return"
**Phase:** 1
**Decision:** The return-after-a-gap bonus now requires a finite `daysSinceLastSession`.
**Reasoning:** `daysSinceLastSession` is `Infinity` before any session exists, so the very
first session ever collected the "back after time away" bonus. There was no absence to
return from. Caught while tuning, when day-1 Grit came out implausibly high.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Projection harness split from its assertions
**Phase:** 1
**Decision:** `docs/BALANCE-PROJECTION.md` said the harness belongs in
`src/domain/balance.projection.test.js`. The simulation lives in
`src/domain/balance-projection.js` and the test asserts against it.
**Reasoning:** `tools/regenerate-projection.js` regenerates the doc from the same module the
test checks, so the published table and the enforced checks cannot drift. The test also
compares the committed table against a fresh run, which makes a stale doc a test failure.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Bodyweight exercises carry a fixed notionalLoad
**Phase:** 1 (follow-up)
**Decision:** Each bodyweight movement carries a `notionalLoad` in `data/exercises.json`:
pull-up 120, dip 100, hanging leg raise 60, single-leg calf raise 40. Volume for a plain
set is `notionalLoad x reps`; for a weighted variant `(notionalLoad + addedWeight) x reps`.
The plank is scored by time, not load, so it has none. Dip and hanging leg raise did not
exist in the seed library and were added.
**Reasoning:** Cory's instruction, resolving the open item from the Phase 1 report. The
constant is a property of the exercise, not of the person — that is precisely what keeps
the hard rule intact, since deriving it from body weight would mean a heavier user earns
more Might and losing weight costs it. `SetInput.weight` now means *added* weight for any
exercise carrying a notional load.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Isometric holds do not feed Might — DECIDED
**Phase:** 1 (follow-up)
**Decision:** Time under tension is not scored for Might, and will not be. The plank earns
Grit through session time and nothing else. Closed by Cory, 2026-09-04.
**Reasoning:** Cory's ruling: scoring held seconds would make Might two-mode — load for
every other movement, time for one accessory — and isometrics already feed Grit through
session duration, so the work is not unrewarded. My earlier reasoning stands as far as it
went (no rate exists in `balance.json` and inventing one is a new mechanism), but the
deciding argument is the one about keeping Might single-mode.
**Confidence:** specified
**Needs Cory:** no — decided, not open.

## 2026-09-04 — Phase 2: the storage contract, and two implementations
**Phase:** 2
**Decision:** `storage-adapter.js` declares the contract; `memory-storage.js` and
`indexeddb-storage.js` both implement it fully. The store layout lives once in
`stores.js` and is shared by both.
**Reasoning:** Non-negotiable 5 requires persistence behind an adapter so cloud sync can
arrive without touching domain logic. The memory adapter is not a stub — the import,
export and confirmation tests run against a real implementation of the same contract,
under plain `node --test`, with no browser. One shared store definition means the two
cannot drift.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Import confirmation is enforced by the signature, not by convention
**Phase:** 2
**Decision:** `prepareImport` (pure, domain) validates and returns a *plan*, applying
nothing. `applyImportPlan` (adapter) throws unless called with `{ confirm: 'replace' }`.
**Reasoning:** "Import never silently overwrites; it asks first" is a rule that a caller
can forget. Splitting proposal from application means the only way to import is to have
asked, and forgetting to ask is a thrown error rather than lost data. Validation order is
`app`, then `schemaVersion`, then payload — exactly as `docs/02` requires, so a foreign or
future file is refused before anything tries to interpret it.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Export carries every store, including directive
**Phase:** 2
**Decision:** The export payload includes `directive`, which the format block in
`docs/02-data-model.md` does not list.
**Reasoning:** "Import restores it exactly" is an acceptance criterion, and a store left
out of the document cannot round-trip. The documented list is otherwise unchanged; this is
a superset, so any file matching the documented shape still imports.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Migration machinery built before the first migration
**Phase:** 2
**Decision:** `src/domain/migrations/` ships with an empty registry at schema 1, a
`migrate` that composes steps and refuses gaps and downgrades, and tests that prove the
composition using an injected registry.
**Reasoning:** `docs/02` requires migrations tested against a fixture of the previous
version, and there is no previous version yet. Inventing a fake v0 would test a fiction.
Injecting a registry proves the machinery for real without one. The alternative — writing
this the first time it is needed, under pressure, against live user data — is how people
lose data.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — The purity test reads source, and also removes the platform
**Phase:** 2
**Decision:** `src/domain/purity.test.js` scans every domain module for browser globals,
clock reads, `Math.random`, adapter imports and bare specifiers — then additionally
imports the engine with `indexedDB`, `localStorage`, `fetch` and friends deleted from
`globalThis` and runs it.
**Reasoning:** A source scan alone can be fooled and a runtime check alone can miss an
unexercised path, so it does both. Comments and string literals are stripped before
scanning, so prose mentioning `indexedDB` cannot fail the build. It caught a real problem
immediately: `transfer.js` had a local variable named `document`, shadowing a browser
global in the one layer forbidden to touch one. Renamed rather than exempted.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Browser persistence proven by driving a real browser
**Phase:** 2
**Decision:** `tools/verify-persistence.js` serves the repo and drives Chromium through
three passes against one profile: write-then-reload, restart, relaunch. The page posts its
results back to the driver.
**Reasoning:** "Data survives reload, browser restart and app relaunch" cannot be shown by
a Node test — Node has no IndexedDB, and a fake one would only prove the fake works. The
page reports over HTTP rather than through a DOM snapshot because `--dump-dom` captures at
the load event, before any asynchronous storage work has finished; that cost an hour and is
worth writing down. The harness was checked against an empty profile and correctly failed
8 of 9 checks, so it is not vacuous.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3: src/app/ added to the repository map
**Phase:** 3
**Decision:** New `src/app/` layer holding `workout.js` (the session service), `seed.js` and
`bootstrap.js`. `CLAUDE.md`'s repository map updated to name it.
**Reasoning:** Something has to join the pure domain to the adapters — read records, ask the
domain what a session earned, write the results back. It is not domain (it does I/O), not an
adapter (it implements no boundary), and not a screen. Putting it in `src/ui/` would have
meant view code owning persistence, which is the thing the adapter rule exists to prevent.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Speed targets measured in taps, not wall-clock
**Phase:** 3
**Decision:** `tools/verify-logging-speed.js` drives the real UI and counts interactions,
converting at a stated one second per tap. Full lower session: 34 taps cold, 21 taps warm.
Ad-hoc curls: 4 interactions.
**Reasoning:** A script taps in microseconds, so its wall clock proves nothing about a human
in a gym. Taps are the honest proxy and the thing the design actually controls. One second
per tap is deliberately generous for a familiar one-handed UI; the numbers clear 90s and 20s
with room to spare even at that budget. Both the cold case (first ever session, working
weights unknown) and the warm case (repeating last session, which docs/05 calls the common
case) are measured, because only the warm case can be one tap per set.
**Confidence:** inferred
**Needs Cory:** no — but these are proxies. A real timed session on a phone would be worth
doing before Phase 8.

## 2026-09-04 — Set rows follow the exercise's metric
**Phase:** 3
**Decision:** A set row renders the two numbers the exercise actually has: weight and reps
normally, weight and distance for a loaded carry, seconds for a hold.
**Reasoning:** Found by the speed harness, which reported three fields still empty when
repeating a session. They were the reps boxes on farmer's carries — a number that does not
exist for that movement. An empty box invites the user to fill in nothing and costs a tap to
skip past, which is exactly the kind of friction the speed target exists to prevent.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — The precache list is tested, not trusted
**Phase:** 3
**Decision:** `test/precache.test.js` walks the import graph from `src/main.js` and asserts
every module it reaches is in `sw.js`'s PRECACHE, and that PRECACHE carries nothing the app
never loads.
**Reasoning:** The list is hand-written because there is no build step to derive it from,
which makes it exactly the kind of thing that rots — and it rots invisibly, breaking the app
only offline and only for people who already installed it. Walking the import graph rather
than globbing `src/**/*.js` is deliberate: globbing would demand precaching type-only
declaration modules and the projection harness, none of which the browser fetches.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Today and Character are honest placeholders
**Phase:** 3
**Decision:** All four tabs from `docs/03-screens.md` exist. Today and Character say plainly
that they arrive in Phases 4 and 5.
**Reasoning:** The four-tab shape is specified, and building it now avoids re-laying the
shell later. An empty screen reads as broken; a screen that says what it is waiting for does
not. Nothing is faked — Character does not show invented numbers.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.5 A: program slots carry an explicit exerciseId
**Phase:** 3.5
**Decision:** Added an `exerciseId` to every slot in `data/programs.json`, and added the
13 movements the program needs that the library lacked. Four were mapped to existing
exercises (Lat Pulldown, Seated Cable Row, Cable Triceps Pushdown, Romanian Deadlift).
**Reasoning:** The uploaded `programs.json` identified movements by name only, and the XP
engine needs an id to resolve class and notional load. Deriving ids by slugifying names at
load time would have silently invented exercise records with guessed classifications, and
class changes Might scoring. Putting the mapping in data keeps it visible and lets Cory
correct it. Mapping the four rather than creating near-duplicates keeps existing PR history
attached to the movement it belongs to.
**Confidence:** inferred
**Needs Cory:** yes — please sanity-check two mappings. "Lat Pulldown" was mapped to the
existing wide-grip entry and "Seated Cable Row" to the existing close-grip one; the program
does not specify a grip, so those add specificity the spec did not state. Everything else
is a clean match.

## 2026-09-04 — Phase 3.5 A: schema 2, and the first real migration
**Phase:** 3.5
**Decision:** Added `programs` and `programState` stores. `DATABASE_VERSION` 1 -> 2,
`CURRENT_SCHEMA_VERSION` 1 -> 2, with migration `1 -> 2` adding the empty collections.
**Reasoning:** Programs are stored state, not seed data — a program has a start date, and
the week index rolls over from it on the calendar. `docs/02` requires a migration per
schema change, tested against a fixture of the previous version; there is now a genuine v1
to fixture against, which is what the machinery built in Phase 2 was for. The whole change
was a handful of lines because it was not written in an emergency.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.5 A: double progression for rep ranges
**Phase:** 3.5
**Decision:** Within a program, hitting the top of the range on *every* set proposes one
increment more and resets reps to the bottom. Short of that, the weight holds and the rep
target climbs by one. A deload week holds weight outright.
**Reasoning:** `docs/09` says the range is the prescription and where you land inside it is
the performance, which is double progression by another name. It is the standard reading
and the only one that makes a range mean anything. Still a proposal, never applied.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.5 D: the art file is one exercise, not a frame sheet
**Phase:** 3.5
**Decision:** Built the slicing pipeline (`tools/slice-exercise-art.js`, pure Node PNG
decode/encode) and wired the art mechanism into the session screen, with one exercise
covered. Section D is otherwise **blocked**.
**Reasoning:** `art/source/exercise-frames.png` is described in `docs/09` as a sheet of
movement frames to slice per exercise. It is not: it is a single 1302x1325 illustration of
one movement, an incline barbell bench press, watermarked "STRENGTH LEVEL". Checked
programmatically as well as by eye — there are no interior gutters anywhere in the image.
Slicing it would produce seventeen crops of the same bench press, so I did not pretend to.
The pipeline is real and tested against the one asset; adding entries to its manifest is
all a proper sheet would need.
**Confidence:** specified (measured)
**Needs Cory:** yes — two things. The remaining 16 movements need real source art. And
that image carries a third-party watermark; this repository is public and served on GitHub
Pages, so whether it may be published is a rights question I should not decide.

## 2026-09-04 — Phase 3.5 E: the guide is derived, not transcribed
**Phase:** 3.5
**Decision:** Weekly hard-set targets are computed from the program's own slots, weighted
by each movement's activation map, rather than copied from the source app.
**Reasoning:** I do not have `november_physique_tracker_v10_OFFLINE.html`, so its numbers
were not available to transcribe. Deriving them is better anyway: a transcribed table drifts
the moment the program changes, and a derived one cannot. The output matches what docs/09
describes — upper-body-biased, with legs a distant last.
**Confidence:** inferred
**Needs Cory:** no — but compare it against the source app's numbers when convenient.

## 2026-09-04 — Phase 3.5 F: Might's accent, and logged sets stay bright
**Phase:** 3.5
**Decision:** The session screen carries one accent — Might's orange — on the active set
row, the running rest timer and the primary action. Logged set numbers keep full `--text`
contrast; the check button carries the done state instead of dimming the numbers.
**Reasoning:** `docs/04` allows exactly one accent per screen and one per attribute. A
lifting session feeds Might, so Might's colour is the honest choice. Dimming a logged set
is the obvious way to show completion and it is wrong here: those numbers are what you read
to decide the next set, at arm's length in bad light. Contrast is asserted computationally
at 4.5:1 rather than judged.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — A CSS-only sabotage was not enough to falsify one assertion
**Phase:** 3.5
**Decision:** Kept the FINISH separation assertion, after proving it fails when FINISH is
actually moved among the set controls.
**Reasoning:** Following the rule in `CLAUDE.md`, I sabotaged each section F criterion.
Removing the finish zone's spacing did NOT fail the separation check — the button stayed far
from set controls in document flow regardless. That looked like another test that cannot
fail, so I sabotaged it properly by rendering FINISH inside the exercise card, and it failed
as it should. Worth recording: a sabotage that does not fail may mean a weak test, or may
mean the wrong thing was sabotaged, and the two are worth telling apart before deleting an
assertion.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.6: completion is derived, not stored
**Phase:** 3.6
**Decision:** A slot is complete when the current program week's logged sets for that
`(programDayId, slotIndex)` reach its prescribed count. Nothing records "done".
**Reasoning:** `docs/10` needs rollover within the week and a clean slate at the boundary.
Derivation gives both for free: ask a different week and outstanding work is simply gone,
with nothing to reset and no cron job to forget. A stored flag would have needed explicit
clearing, and a missed clear is exactly how an app becomes a debt tracker.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.6: slot attribution, and schema 3
**Phase:** 3.6
**Decision:** Set logs gained optional `programDayId` and `slotIndex`.
`CURRENT_SCHEMA_VERSION` 2 -> 3 with a migration that transforms nothing.
**Reasoning:** Lateral raises appear on three days of the program; without attribution,
doing Monday's would mark Thursday's complete. A no-op migration looks like noise, but
`docs/02` requires a version per schema change, and recording where the fields appeared is
what lets a future reader know that an unattributed log is old rather than broken.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.6: one session per day, settled per slot
**Phase:** 3.6
**Decision:** Every slot completed on a given day shares one session record. Day-level Grit
— showing up, coming back, meeting the week's plan — fires once, on the first work logged;
time under load accrues every time. Settling a day's session scores only the sets just
added.
**Reasoning:** `docs/10` requires that a micro-set day still accrues Grit without a formal
session, and that XP is unchanged by the path. Five separate sessions would have paid the
showing-up bonus five times; one session settled repeatedly would have re-awarded earlier
slots. Both are wrong in the same direction — inflation — so the fix is a shared day session
plus `onlySets` scoping. A test asserts a slot done alone scores exactly what it scores
inside a block.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.6: weekly targets, and the groups the doc did not name
**Phase:** 3.6
**Decision:** Added the five ranges `docs/10` states to `data/programs.json` — chest 12–16,
back 14–18, quads 10–14, hamstrings/glutes 10–14, shoulders 12–18. The doc's "and so on"
groups carry no target: their sets are counted and shown, just not against a number. The
mapping from those coarse groups to the library's finer activation keys lives in
`src/domain/tasks.js`.
**Reasoning:** Inventing ranges for arms and core would have been inventing programming.
The mapping is a judgement call: back is lats and traps; shoulders is all three deltoid
heads; rear delts are shoulders rather than back.
**Confidence:** specified (the five ranges), inferred (the mapping)
**Needs Cory:** yes — low priority. Confirm the group mapping, and give ranges for arms and
core if you want them scored.

## 2026-09-04 — Phase 3.6: the service worker is now a module worker
**Phase:** 3.6
**Decision:** `sw.js` is registered with `{ type: 'module' }` and imports `VERSION` from
`src/version.js`, so the cache key genuinely derives from the version rather than being a
duplicate kept in step by hand.
**Reasoning:** `docs/10` asks for derivation. The alternative — duplicating the constant and
asserting equality in a test — would satisfy the letter and not the intent. Module workers
need iOS 16.4 or newer; on anything older registration rejects and is logged, and the app
runs online-only rather than failing at startup. Verified in Chromium that it registers,
activates, and produces a cache named `tempered-0.4.0 (3.6)`.
**Confidence:** inferred
**Needs Cory:** yes — if your iPhone is on iOS 16.3 or older, tell me and I will duplicate
the constant with an equality test instead.

## 2026-09-04 — Phase 3.6: two bugs found by the harnesses
**Phase:** 3.6
**Decision:** Fixed a variable shadowing bug in `train.js` and changed where the
post-session screen returns to.
**Reasoning:** `programBlock` destructured `const { program, week, deload } = active`, which
shadowed the outer `week` state with the week *number* — the weekly view crashed on first
render. And DONE always returned to Train, even for a slot opened from Today, dropping the
user on a screen they were not working in. Neither would have shown up in a unit test.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — A sabotage that did not fail, and what it meant
**Phase:** 3.6
**Decision:** Kept the slot-identity behaviour; noted that only the node tests cover it.
**Reasoning:** Sabotaging slot identity — keying completion by exercise instead of by slot —
did not fail the browser harness, though it did fail two node tests. So the behaviour is
covered, just not at the layer I sabotaged. Recording it because the useful habit is not
"sabotage until something goes red" but "find out which layer actually holds the guarantee".
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.4.0 (3.6)
**Phase:** 3.6
**Decision:** `src/version.js` carries `0.4.0 (3.6)`, built 2026-09-04. Bumped in the same
commit as the phase, as `docs/10` requires.
**Reasoning:** The minor version tracks the phase group; the parenthetical names the exact
phase, so a screenshot of Settings identifies the build precisely.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: acid is paintable only through `data-acid`
**Phase:** 3.7
**Decision:** `src/style.css` sets `#edfe73` in exactly four places, all of them selectors
on `[data-acid]`, whose value names one of the document's three roles: `primary`,
`active`, `value`. No component class paints acid. The block sits last in the file so a
same-specificity component rule cannot quietly win a tie and leave a state unpainted.
**Reasoning:** `docs/04` says acid marks three things "and nothing else", and asks for
that to be asserted. A budget you can only measure after the fact gets exceeded; a budget
that cannot be exceeded without naming the role you are claiming does not. It also makes
the assertion cheap and exact: `test/browser/surface.html` counts distinct roles on screen
and, separately, flags anything painted acid with no `data-acid` ancestor.
**Confidence:** inferred (the mechanism; the three roles are specified)
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: "under 5% of the viewport" and "a full-width acid button"
**Phase:** 3.7
**Decision:** The acid budget is asserted as: under 5% of the viewport, **or** the only
acid on the screen is the single primary action. Every tracker screen passes the 5% rule
outright — train 0.7%, today 0.7%, a session 0.9%. The post-session summary, whose one
control is a full-width acid DONE, lands at 6.9% and passes under the second clause.
**Reasoning:** The document asks for both "under 5%" and "a full-width acid button where a
bar would be wrong", and on a phone a full-width 44px button is about 6% of the screen.
The two cannot both hold literally. The 5% rule states its own purpose — more than that
and the accent "has stopped meaning anything" — and a screen whose entire acid content is
the one thing you are meant to tap has diluted nothing. The exemption is written into the
harness where it can be read, rather than being absorbed by quietly loosening the number.
**Confidence:** guessed
**Needs Cory:** answered — Cory chose the pill. See the entry below; the exemption is gone
and the rule is flat.

## 2026-09-04 — Phase 3.7: which screens get a FAB, and what it does
**Phase:** 3.7
**Decision:** The floating bar carries a circular acid FAB for the screen's one primary
action. Today and Train both get one: start the day the program prescribes for today.
History, Character and Settings get none. A session hides the bar entirely, so its primary
action is the FINISH **confirm** — the FINISH button that opens the confirm is neutral.
Train's per-routine START buttons stopped being primary buttons.
**Reasoning:** `docs/04` allows a screen to have no FAB but not two primary actions.
Train's routines and library rows are all equally valid starts, so none of them is the
primary action and inventing one would be inventing product. Today's list has the same
shape, and its one distinguishable action — run the whole block — is the FAB. Leaving the
acid on the FINISH button that merely *opens* the confirm would have made the loudest
thing on the logging screen the control docs/09 says must not be reachable by a mis-tap.
**Confidence:** inferred
**Needs Cory:** yes — low priority. Confirm you want Train's FAB to start today's day
rather than the last day you worked.

## 2026-09-04 — Phase 3.7: the plate calculator moved into the row it describes
**Phase:** 3.7
**Decision:** The per-side loading now renders inside the set row being worked, directly
under its weight cell, for barbell movements only. Bar weight and the plates you own moved
to an EQUIPMENT pill. Previously the calculator sat at the foot of the exercise card.
**Reasoning:** `docs/09` section C asks for it "next to the weight field during a session,
not behind a menu". It was not behind a menu, but it was also not next to the weight
field — on a phone it was most of a screen away from the number it describes, under four
set rows and an ADD SET button. `test/browser/surface.html` now asserts adjacency
geometrically: the strip must overlap the weight cell horizontally and sit within a
thumb's reach below it. Gating on `variant === 'Barbell'` follows from the data; a plate
solver on a dumbbell curl is noise. Configuration is not the calculator, so the bar and
plate inventory behind a pill still satisfies "not behind a menu".
**Confidence:** specified (the placement), inferred (the barbell gate)
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: removing a set moved behind EDIT SETS
**Phase:** 3.7
**Decision:** The per-row remove control is shown by the EDIT SETS pill rather than living
permanently in every row. Adding a set is unchanged and still one tap.
**Reasoning:** `docs/04` names "edit sets" as one of the pill actions and holds touch
targets at 44px. Six columns of controls in a row that also has to fit a 28px weight and a
28px rep count cannot all be 44px wide on a 390px screen; something had to leave the row,
and removing a set is rare next to logging one. It is one extra tap, and it bought every
remaining control in the row its full target.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: the attribute colours, and where they survive
**Phase:** 3.7
**Decision:** The five attribute colours are kept as tokens and used in exactly one place:
the post-session "What grew" readout, where the subject genuinely is attributes. Nowhere
in the tracker — the active set row, the rest timer, the PR marker and the started-task
mark all stopped using Might's orange.
**Reasoning:** `docs/04` says they survive "only on the Character screen where attributes
are the subject. They never appear in the tracker." The summary is not the Character
screen, but it is a screen whose content is attribute XP, and stripping colour from it
would have made an attribute list read as five identical rows.
**Confidence:** inferred
**Needs Cory:** answered — Cory kept it, and `docs/04` now says so: attribute colours
appear on Character and in the post-session "What grew" readout, nowhere else.

## 2026-09-04 — Phase 3.7: a bug the acceptance harness could not see
**Phase:** 3.7
**Decision:** Added `.tabbar[hidden] { display: none }`.
**Reasoning:** `app.js` has always set `tabBar.hidden = true` when a session starts, but
`.tabbar` sets `display: flex` (previously `grid`), which outranks the user agent's
`[hidden] { display: none }`. The bar has therefore been visible through every session
since Phase 3, and with the FAB added it was worse than cosmetic: a live control that
starts a *new* session, sitting over the set rows of the one you are in. No assertion
caught it — every harness queried elements that were present and correct. A screenshot of
the rendered session did, in about a second. Worth remembering: the harnesses check
claims, and cannot check the claim nobody thought to make.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: token names follow the document
**Phase:** 3.7
**Decision:** Spacing tokens renamed `--space-N` to `--sN`, the type scale extended to the
document's six steps, and radius tokens `--r-sm|md|lg|xl|full` added.
**Reasoning:** `docs/04` refers to `--s4`, `--s3` and `--r-lg` by name. A document naming
one token and a stylesheet defining another is how a design system stops being read.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: harnesses updated, not loosened
**Phase:** 3.7
**Decision:** Four existing harnesses needed edits: the boot check for the ground colour,
the logging-speed check for a running rest timer, and two tracker-v2 checks whose controls
moved. Each was re-pointed at the new marker; none had its threshold relaxed. tracker-v2
also gained a check that the plate calculator is in the same row as the weight field,
which the previous build would have failed.
**Reasoning:** A harness edited to match whatever the code now does is worse than no
harness. The distinction held here: every one of these was "this element is now called
something else", and each was verified to still fail when the behaviour is broken rather
than merely renamed — the sabotage runs are in the commit message.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.4.1 (3.7)
**Phase:** 3.7
**Decision:** `src/version.js` carries `0.4.1 (3.7)`, built 2026-09-04, which re-keys the
service worker cache.
**Reasoning:** The patch version moves because this is a surface re-implementation inside
the 3.x group, not a new phase group. Bumping it sweeps every cached copy of the old
stylesheet, which matters more than usual here: a stale `style.css` against new markup is
exactly the kind of half-applied build a version number exists to identify.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: the acid budget is a flat 5%, with no exemption
**Phase:** 3.7
**Decision:** Cory's call on the open question above: the summary's DONE is now a pill
(`.button--pill`, right-aligned) rather than a full-width button, and the fallback clause
came out of the assertion. `test/browser/surface.html` asserts under 5% of the viewport,
full stop. Measured: train 0.71%, today 0.71%, a session 0.18%, resting 0.24%, confirming
0.24%, summary 1.56%. Restoring the full-width button puts the summary at 6.22% and turns
the check red, which is how the rule was verified to still bite.
**Reasoning:** A rule with a stated exemption is a rule someone will widen later. The
document's "full-width acid button" was one of two permitted forms for a primary action,
not a requirement; the 5% ceiling was the one with a reason attached to it. Dropping the
form that could not fit the ceiling costs nothing and leaves one number to hold.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 3.7: looking at the screens is now part of finishing a phase
**Phase:** 3.7
**Decision:** Added to `CLAUDE.md` under How to work: at the end of any phase that changes
the interface, screenshot each screen it touched and look at them.
**Reasoning:** Cory's, after the `.tabbar[hidden]` bug. Twenty-one assertions and four
older harnesses all passed while a live control that starts a new session sat over the
session you were in, because no one had thought to assert that a hidden thing is hidden.
A screenshot has no such blind spot: it shows what is there, not what was asked about.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4: how a day's XP is settled
**Phase:** 4
**Decision:** Every `dayLogs` record carries an `awarded` ledger of XP paid per source.
Logging anything re-scores the whole day with `awardsForDay` and pays only the difference,
and the ledger keeps the high-water mark per source rather than the latest figure.
**Reasoning:** A day is logged a piece at a time and every piece re-scores the whole day,
so paying out the day's awards on each entry would pay for the morning's sleep again every
time a glass of water is logged. The high-water mark is what makes both directions of
correction safe: a mistyped 12,000 steps corrected to 4,000 pays nothing and claws nothing
back, and re-raising it to 12,000 pays nothing a second time. `CLAUDE.md` forbids
subtracting, so the ledger has to be the thing that remembers, not the current value.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4: which activities are measured and which are marked
**Phase:** 4
**Decision:** Sleep, water, steps, body metrics and every minute-based activity take a
number. Rest day, food logged, protein target and journal are one-tap marks. Water and the
minute-based entries ADD to the day; sleep, steps and a body reading REPLACE it.
**Reasoning:** `docs/01` is explicit that a measurable activity must not be a checkbox.
Add-versus-replace is not in any document and is a judgement: water arrives a glass at a
time and reading happens twice in an evening, so asking for a running total would be
asking the user to do arithmetic; a night's sleep and a step count are already totals when
they arrive. `protein_target` is seeded as `derived` with a unit of grams, but the engine
scores "target met" and nothing anywhere holds a gram target to compare against, so it is
implemented as a mark.
**Confidence:** inferred (add versus replace), guessed (protein as a mark)
**Needs Cory:** yes — low priority. If you want protein scored against a gram target, say
what the target is and it becomes a measured entry.

## 2026-09-04 — Phase 4: the body-metric value is read in exactly one place
**Phase:** 4
**Decision:** `applyActivity` writes a body reading to `day.bodyMetrics.weight` and sets
the boolean `bodyMetricsLogged`. Reading that number back happens in `src/app/daily.js`
and nowhere else; `activityValue()` in the domain returns the boolean act.
**Reasoning:** `body-weight.test.js` asserts that no module under `src/domain/` so much as
reaches for a recorded metric value, and Phase 4 requires the number shown back to the
user. The obvious move was a display helper in the domain beside the rest of the activity
model, and the guard caught it. The guard is right: it is only worth having while it has
no exceptions, and "it is only for display" is exactly how the first exception would be
argued. The read now lives at the app boundary, one layer away from anything that could
score it. The guard reads raw source, so even a comment quoting the field name trips it —
left as it is rather than taught to strip comments, because a blunt rule about this
particular value is the point.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4: what "one view, no scrolling" cost
**Phase:** 4
**Decision:** Today shows six training slots and thirteen activities in 834px of an 844px
phone. Getting there: single-line slot rows, marks as round chips, measured activities as
a three-column grid whose number field is always present, the unit as a footnote beside
the name rather than a line of its own, and no "OUTSTANDING" heading.
**Reasoning:** Nineteen outstanding items at the design system's 44px minimum is 836px
before any heading, so the criterion and `docs/10`'s slot list are in tension and something
had to give. What gave was labelling, not touch targets: a 28px section heading is two
activity tiles' worth of room spent saying what the screen's own title already says.
Everything cut was chrome; nothing outstanding is hidden, truncated or behind a "more".
The fit is asserted at a stated 390×844 rather than at whatever size the headless window
happens to be, because "one view" is a claim about a phone.
**Confidence:** inferred
**Needs Cory:** yes — low priority. It fits, but with 10px to spare. If you add a
fourteenth activity, something has to become a scroller.

## 2026-09-04 — Phase 4: logging must not make the screen taller
**Phase:** 4
**Decision:** The "+195 XP" acknowledgement replaces the framing line rather than adding a
row, and what is already logged collapses behind a single WORKED toggle.
**Reasoning:** Found by screenshot, not by assertion: three entries in, the acknowledgement
and the worked list had pushed the last outstanding tile under the floating bar, so the
screen got worse the more you used it. `docs/03` already asked for logged work collapsed by
default. There is now an assertion for the mid-day state too.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.5.0 (4)
**Phase:** 4
**Decision:** `src/version.js` carries `0.5.0 (4)`, built 2026-09-04.
**Reasoning:** New phase group, so the minor version moves. Re-keys the service worker
cache, which matters this time because `data/activities.json` is newly fetched at boot.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.1: the daily flag, and where it lives
**Phase:** 4.1
**Decision:** Every activity carries a `daily` flag. The seed supplies the default — sleep,
water, steps, nutrition, rest day on; everything else off — and the user's own list lives
on the profile as `dailyActivityIds`. Today renders the daily list; the rest is behind one
"log something else" control that opens the same chips and tiles. A profile with no list
falls back to the seed defaults rather than having a copy written into it.
**Reasoning:** Cory's call, and the right one: Phase 4 met its one-view criterion by
shaving labels and had 10px left, which meant the fourteenth activity would have broken it.
Now the rule holds by construction. The fallback matters because the defaults can then be
retuned later without every existing profile carrying a stale copy of the old ones, and
because a profile created before the flag existed still works. Measured after the change:
736px of 844px with the section heading and the wider spacing restored, against 834px
before it.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.1: the flag is placement, never scoring
**Phase:** 4.1
**Decision:** `daily` affects one screen's contents and nothing else. An activity off the
list earns exactly the same XP, logs the same way, and appears in the same worked list.
Taking one off never unlogs anything. Both are asserted.
**Reasoning:** The obvious way for this to rot is for "not on my daily list" to quietly
become "worth less" or "not really tracked". `CLAUDE.md` is clear that nothing is punished
and that measurement is what earns; a placement preference is not a measurement.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4.1: the list is editable in Settings until setup exists
**Phase:** 4.1
**Decision:** Settings gains a Daily list card — one chip per activity, tap to toggle.
`docs/03` says the flag is set during setup, which is Phase 7.
**Reasoning:** A default nobody can change is not a default, and shipping the flag with no
way to edit it for three phases would mean the defaults were never tested against a real
preference. Setup will take this over rather than duplicate it.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4.1: protein stays a mark
**Phase:** 4.1
**Decision:** Cory answered the open question from Phase 4: no gram target. `protein_target`
stays a one-tap mark, and `data/activities.json` keeps its `unit: g` as description rather
than as something the app asks for.
**Reasoning:** His words: that is programming advice he is not going to invent. Recorded so
the question does not get reopened by the next person who notices the unit.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.5.1 (4.1)
**Phase:** 4.1
**Decision:** `src/version.js` carries `0.5.1 (4.1)`, built 2026-09-04.
**Reasoning:** A correction inside the Phase 4 group, so the patch version moves, matching
how 3.7 was handled.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 5: the explanation is checked against the engine, not written beside it
**Phase:** 5
**Decision:** `src/domain/sources.js` holds one entry per XP source — a label and a worth
phrased from `data/balance.json` at call time. `sources.test.js` drives the XP engine over
a day and a session that between them trigger everything, and asserts the explanation
covers every source the engine emits, and emits every source the explanation claims.
**Reasoning:** The Phase 5 acceptance criterion is that tapping an attribute reveals
exactly what feeds it and what each is worth, and `CLAUDE.md` non-negotiable 3 says the
mapping must be legible. A hand-maintained list is true the day it is written and quietly
wrong six weeks later, and the failure mode is the worst kind — the app confidently
explaining itself incorrectly. Reading the rates out of balance at call time is the same
argument: non-negotiable 7 puts balance in config, and a worth with the old number baked
into a string would make that a lie the first time one moved. There is a test for that
too: it retunes a value and checks the sentence follows.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 5: titles are awarded, and never taken back
**Phase:** 5
**Decision:** `src/domain/titles.js` holds one predicate per catalogue entry, and
`src/app/character.js` derives the facts from what is logged — session count and hours
from `sessions`, miles and in-band sleeps from `dayLogs`, the lifts from `records`, the
return-after-a-gap from the `grit.return` the engine recorded at the time. Anything newly
earned is stamped with the day and stored. Display reads the store, never the predicate.
**Reasoning:** `docs/07` names Titles as Phase 5 work and the catalogue was sitting unused
since Phase 0. Deriving the facts rather than keeping counters follows `docs/10`'s reason
for deriving slot completion: a counter drifts and nothing notices. Storing the earned date
and displaying from the store is what makes "no punishment" hold at the edges — retuning a
threshold, or a bad import, must not silently un-award something somebody already has.
There is a test that drops an attribute back to level 0 and checks the title stays.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 5: two title conditions needed a reading
**Phase:** 5
**Decision:** "Log a rest day after three consecutive training days" is read as: a rest day
whose three preceding calendar days each carry a finished session. "Farmer's carry 200 lbs
total load" is read as the best recorded load on `farmers_carry`, not load × distance.
**Reasoning:** Both sentences admit a looser and a stricter reading. Three *consecutive*
days is the stricter and matches the words; "total load" most likely means the weight on
the bar rather than a work product, since the exercise already logs load and distance
separately and a work figure would need a distance to be stated in the condition.
**Confidence:** guessed
**Needs Cory:** yes — low priority. Confirm the carry title means 200 lbs carried, not 200
lbs × some distance.

## 2026-09-04 — Phase 5: the Character screen has no FAB
**Phase:** 5
**Decision:** No primary action on Character, so the floating bar carries no FAB there.
Acid marks two roles: the rank letter, and the attribute being read.
**Reasoning:** `docs/04` allows a screen to have no single primary action, and Character is
a reading surface — nothing on it is the thing you came to do. Inventing one would spend
the accent on whatever happened to be nearest. Measured at 0.29% of the viewport.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 5: the copy guard caught the word "behind"
**Phase:** 5
**Decision:** Reworded "nothing is locked behind one" to "nothing depends on having one".
**Reasoning:** `test/copy.test.js` bans "behind" because outstanding work must never be
framed that way, and it reads raw copy rather than trying to judge intent. The usage was
innocent; the guard is blunt on purpose, and the same reasoning applies as with the
body-metric guard — it is worth having only while it has no exceptions.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.6.0 (5)
**Phase:** 5
**Decision:** `src/version.js` carries `0.6.0 (5)`, built 2026-09-04.
**Reasoning:** New phase group. Re-keys the service worker cache, which matters here
because `data/titles.json` is newly fetched at boot.
## 2026-09-04 — Exercise art comes from free-exercise-db, and the licence chain has a kink
**Phase:** 3.5 D (unblocking)
**Decis…11497 tokens truncated…nted,
and the Progress dashboard runtime listens for the `history` signal. Its old mutation
observer remains as a compatibility fallback. Hidden legacy Progress panels now use an
explicit `display:none` rule while the widget dashboard is visible.
**Reasoning:** Reproduced on production: the first Progress visit showed only the old
recap panels; tapping `7D` woke the configurable widgets. Mutation timing was not a
reliable screen lifecycle. The post-render signal removes the race, and the regression
harness now installs the runtime before the first Progress visit.
**Confidence:** measured
**Needs Cory:** no

## 2026-09-08 — Progress rendering is event-driven and Health import has a paste sheet
**Phase:** 0.14.3 production repair
**Decision:** Removed the Progress runtime's subtree mutation observer. The dashboard now
renders from the explicit screen-mounted event, range/view clicks, and its own controls.
It keeps the current dashboard mounted until replacement data is ready. When iOS denies
clipboard reads, `IMPORT HEALTH` opens a native-feeling in-app paste sheet and imports the
pasted Shortcut snapshot through the same canonical day-log path.
**Reasoning:** The observer watched the DOM that the dashboard itself replaced, so every
successful render scheduled another render. Each pass deleted the widgets before its
asynchronous IndexedDB reads, leaving them absent for most frames and making Add/Edit
controls unstable. The old Health fallback only changed button copy after a clipboard
error, which supplied no usable import path on installed iPhone PWAs.
**Confidence:** measured from the reported iPhone state and reproduced render lifecycle
**Needs Cory:** no

## 2026-09-08 — Dashboard editing is in-place and Health never waits to show its fallback
**Phase:** 0.14.4 iPhone interaction repair
**Decision:** Add, Edit/Done, remove, and reorder now mutate the mounted Progress dashboard
in place and serialize only the persistence writes. Edit mode no longer applies continuous
transform animation to backdrop-filtered cards. `IMPORT HEALTH` mounts the paste sheet
before requesting clipboard text; a valid readable snapshot still imports automatically.
**Reasoning:** Cory's iPhone recording showed full-dashboard replacements making the page
jump during customization. The code confirmed that every control reread seven stores and
replaced the whole dashboard. Installed iOS can also leave `clipboard.readText()` pending
without resolving or rejecting, so a catch-only fallback can still appear to do nothing.
**Confidence:** measured from the recording and implementation path
**Needs Cory:** no

## 2026-09-09 — Itemized Nutrition is reviewable, compatible, and undoable
**Phase:** 0.15.0 Nutrition ledger
**Decision:** Nutrition now stores timestamped meal entries with calories, protein,
carbohydrates, fat, and fiber. Pasting an AI result only fills the form; Add Meal is the
sole save action and the dedicated Nutrition sub-screen remains open to show the entry.
Deleting a meal recalculates daily aggregates and offers immediate Undo. Existing
aggregate-only calories/protein are captured as an Earlier total on the first itemized
write, without inventing a timestamp or double-counting them. Day-level aggregate fields
remain canonical for existing Progress and reward logic.
**Reasoning:** The previous inline editor disappeared as soon as clipboard text was read,
which hid what had been logged and removed the chance to review an estimate. Optional
macro fields add no extra step to the existing AI handoff, while itemized entries make the
data understandable and correctable. Lazy carryover preserves every pre-release total.
**Confidence:** specified by Cory; carryover treatment inferred from the local-first and
history-preservation rules.
**Needs Cory:** no

## 2026-09-09 — Today enhancements and Progress cards use stable render layers
**Phase:** 0.15.0 iPhone visual repair
**Decision:** Calorie/Nutrition and Health no longer use subtree mutation observers.
They respond to explicit app screen events plus a `tempered:today-rendered` event for the
Today calendar and fold controls, then update existing Lifestyle nodes in place. Progress
cards explicitly disable animation, transforms, transitions, and backdrop filtering so
iOS does not re-composite them while edit controls or card order change.
**Reasoning:** The two Today observers watched the DOM they altered: Nutrition replaced
the Lifestyle snapshot, Health appended its button, and each mutation scheduled the next
rebuild. This made the card flicker and the Health button disappear or lose the tap. The
recording also showed iOS artifacts around translucent Progress cards during edit/reorder;
backdrop-filter creates a separate compositing layer even when JavaScript preserves the
DOM nodes.
**Confidence:** measured from the implementation loop and Cory's iPhone recording.
**Needs Cory:** no

## 2026-09-09 — Planner tasks persist until completed and open into details
**Phase:** 0.16.0 planning and navigation
**Decision:** Incomplete personal and work tasks retain one canonical record and appear on
later dates until checked off. Tapping a row opens the full title, notes, task type, and an
optional due date. Train shows the exercise library as one button leading to a dedicated
searchable screen, and the product is portrait-only across the PWA and iPhone wrapper.
**Reasoning:** A clipped title cannot carry real work, and copying unfinished tasks into
each day would corrupt completion history. The large inline exercise catalogue made Train
needlessly long for a secondary path.
**Confidence:** specified by Cory.
**Needs Cory:** no

## 2026-09-09 — Health normal use is one tap and setup owns repair details
**Phase:** 0.16.0 Health repair
**Decision:** Today launches the saved Tempered Health Shortcut directly. The Shortcut's
URL handoff imports on launch with no second tap. Setup is a dedicated screen reachable
from Today, Settings, and Body Metrics. It documents the required Health Sample to numeric
Value/Duration conversion, includes all body-metric tags, and retains paste and manual
fallbacks.
**Reasoning:** iOS does not permit a static web app to silently install a Shortcut or read
the clipboard at launch. A Shortcut-initiated URL handoff is the reliable one-action path.
The reported Calculate Statistics failure came from passing objects or Text where the
action requires numbers.
**Confidence:** measured from the error screenshot and implementation; platform boundary
verified against Apple's Shortcuts documentation.
**Needs Cory:** no

## 2026-09-09 — Active workouts show elapsed time and hold the display awake
**Phase:** 0.16.0 workout session
**Decision:** Every open workout logger displays an elapsed timer. It requests the Screen
Wake Lock API while visible, re-requests it after foregrounding, and releases it on close.
The iOS wrapper mirrors the lifecycle with `UIApplication.isIdleTimerDisabled`.
**Reasoning:** Rest and session context should remain readable without repeatedly waking
the phone, but the display must return to normal system behavior as soon as logging ends.
**Confidence:** specified by Cory.
**Needs Cory:** no

## 2026-09-09 — Light legs adds calves and rotates the ab slot
**Phase:** 0.16.0 training program
**Decision:** Minimal Legs + Abs adds three sets of Standing Calf Raise. Crunch is replaced
by Ab-Wheel Rollout on odd program weeks and Cable Crunch on even program weeks. A
versioned program migration carries this change into existing installs while preserving
configured weights and the active program's start date.
**Reasoning:** Weekly alternation is deterministic, visible before logging, and keeps one
stable program slot identity. Updating only seed JSON would strand existing users on the
old stored plan.
**Confidence:** specified by Cory; odd/even starting order inferred from the order named.
**Needs Cory:** no

## 2026-09-09 — Release 0.16.0 (12)
**Phase:** 0.16.0 continuity and workout usability
**Decision:** `src/version.js` carries `0.16.0 (12)` and the native wrapper uses marketing
version 0.16.0 with build 12.
**Reasoning:** The release changes product behavior and must re-key the installed PWA
cache. Keeping native and web identities aligned makes field reports unambiguous.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-09 — Today prioritizes entry and moves status into Daily Recap
**Phase:** 0.17.0 Today density
**Decision:** Today removes its redundant visible title/date, compresses the seven-day
calendar and daily progress into short rails, and keeps Plan and Lifestyle entry rows on
the main surface. A one-tap Daily Recap card owns the read-only lifestyle snapshot, Apple
Health actions, and selected-day exercise minutes, working sets, movements, and sessions.
The recap is a stable overlay with no entrance animation.
**Reasoning:** Calendar selection already communicates the date. Large status cards and
read-only Lifestyle tiles displaced the actions people actually use, especially on an
iPhone where the bottom navigation covered the first logging rows. Recap information is
valuable once or twice a day, while entry needs to remain immediate.
**Confidence:** specified by Cory; the four exercise facts are the smallest useful summary
derived from canonical session and set logs.
**Needs Cory:** no

## 2026-09-09 — Release 0.17.0 (13)
**Phase:** 0.17.0 Today density
**Decision:** `src/version.js` carries `0.17.0 (13)` and the native wrapper uses marketing
version 0.17.0 with build 13.
**Reasoning:** The Today information architecture and runtime assets changed, so the PWA
cache and native field identity must advance together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-09 — Companion art is selectable and growth has ten visible levels
**Phase:** 0.18.0 companion direction
**Decision:** Forge Guardian is the default companion style: a disciplined blackened-
steel, bronze, and teal figure that develops through ten distinct forms inside a three-
state industrial training den. The original Ember Sprout remains selectable in setup and
directly on Companion. Both styles share one positive-only care total and ten named levels
at 0, 24, 50, 85, 130, 185, 250, 330, 430, and 550 care. Switching the visual style does
not reset the name, level, or earned progress.
**Reasoning:** The original art was likable but read too cute for the intended adult
strength-training product. More frequent early forms make growth perceptible within normal
use rather than asking the user to wait roughly a month for visible change. A preference
preserves the approved older art without forcing it on users who want the more mature
direction.
**Confidence:** specified by Cory; exact visual motifs and care spacing implemented from
the existing positive-only progression contract.
**Needs Cory:** no

## 2026-09-09 — Release 0.18.0 (14)
**Phase:** 0.18.0 companion direction
**Decision:** `src/version.js` carries `0.18.0 (14)` and the native wrapper uses marketing
version 0.18.0 with build 14.
**Reasoning:** Companion runtime modules and production art changed, so installed PWA
caches and the native field build must advance together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-09 — Trailback Turtle restores the nature-forward default
**Phase:** 0.18.1 companion correction
**Decision:** Trailback Turtle replaces Forge Guardian as the default companion while
Forge and Ember Sprout remain available options. The turtle has ten distinct forms from
Egg and Breaking Through through Hatchling, Strong, Muscular, Cut, and Shredded. Its three
habitat states evolve from a rugged lakeside nest into an established pond-side home and
a broad natural training territory. The selector remains data-driven so additional animal
species can be added without creating another progression system.
**Reasoning:** Forge overcorrected the request for a more masculine workout companion and
abandoned the nature theme and Cory's established visual language. The corrected art uses
the Courjahan Defense rules: bold dark outlines, saturated cel shading, chunky readable
forms, one hard shadow, blue and green emphasis, and "serious game, silly world." The
animal growth itself now carries the strength-training reward without armor or an indoor
gym.
**Confidence:** specified by Cory; visual rules recovered from his prior project chats.
**Needs Cory:** no

## 2026-09-09 — Release 0.18.1 (15)
**Phase:** 0.18.1 companion correction
**Decision:** `src/version.js` carries `0.18.1 (15)` and the native wrapper uses marketing
version 0.18.1 with build 15.
**Reasoning:** The default companion, runtime art, setup choices, and offline asset set
changed after the 0.18.0 Forge release candidate.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-09 — Companion evolution happens only as an on-screen reveal
**Phase:** 0.18.2 evolution reveal
**Decision:** Canonical care continues to accumulate from training and lifestyle logs,
but the rendered companion and habitat remain at the last explicitly revealed level.
Opening Companion with a newer earned level starts a visible evolution-ready takeover,
automatically performs the transformation while that screen is mounted, and holds an
evolution-complete splash until the user dismisses it. A Reveal button allows the short
prelude to be advanced immediately. The numeric revealed-level checkpoint is persisted
only when the on-screen transformation occurs. Profiles from the earlier silent system
have no trusted numeric checkpoint and begin from Level 1 so their missed reveal is
replayed rather than treating the already-rendered form as acknowledged.
**Reasoning:** Quietly replacing the sprite in the background removes the emotional
payoff of companion growth. Separating earned and revealed state preserves authoritative
activity data while making every visual transformation noticeable and reload-safe.
**Confidence:** specified by Cory; the 1.1-second automatic prelude and persistent
completion card are the smallest low-friction cinematic implementation.
**Needs Cory:** no

## 2026-09-09 — Release 0.18.2 (16)
**Phase:** 0.18.2 evolution reveal
**Decision:** `src/version.js` carries `0.18.2 (16)` and the native wrapper uses marketing
version 0.18.2 with build 16.
**Reasoning:** Companion persistence, interaction, and presentation changed, so the PWA
cache and native field identity advance together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-09 — Evolution requires a presentation receipt, not only a level
**Phase:** 0.18.3 reveal migration repair
**Decision:** A numeric revealed level is no longer sufficient evidence that an evolution
was visibly presented. Companion now stores a separately versioned presentation receipt
only when the on-screen transformation runs. Any existing above-Level-1 profile without
that receipt is reset visually to the egg once and receives the evolution takeover again.
The Growth card also exposes Replay Evolution for every evolved companion; replay removes
the receipt and visible checkpoint, never care or canonical activity, then runs the same
earned transformation again.
**Reasoning:** The 0.18.2 clean-profile test passed, but Cory's installed profile did not
replay the silently reached form. The earlier checkpoint could not distinguish a rendered
sprite from a reveal the user actually saw. A presentation receipt makes that distinction
explicit, while a replay control provides a deterministic recovery path on real devices.
**Confidence:** failure observed by Cory; repair behavior is covered with an installed
high-level checkpoint fixture that has no receipt.
**Needs Cory:** no

## 2026-09-09 — Release 0.18.3 (17)
**Phase:** 0.18.3 reveal migration repair
**Decision:** `src/version.js` carries `0.18.3 (17)` and the native wrapper uses marketing
version 0.18.3 with build 17.
**Reasoning:** The installed-profile migration and public Companion controls changed, so
the PWA cache and native field identity advance together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-10 — Evolution stays inside a phone-safe cinematic stage
**Phase:** 0.18.4 evolution presentation correction
**Decision:** Evolution now has three explicit states: a 2.2-second ready prelude, a
3.2-second transformation, and a completion card that remains until dismissed. Both the
old and earned forms stay inside the same compact circular stage, and the surrounding
card is bounded to the available viewport with internal overflow as a last resort. The
visible-level checkpoint and presentation receipt are written only after the full morph
finishes. Presentation receipt version 2 replays this corrected reveal once for installs
that recorded the earlier broken presentation as seen.
**Reasoning:** The first reveal saved immediately and used a 0.7-second appearance flash
whose artwork could scale outside the useful phone area. That made most of the change
happen off screen and provided no readable old-to-new transformation. A fixed stage,
deliberate pacing, and post-animation persistence keep the entire event visible and make
the saved checkpoint match what the user actually saw.
**Confidence:** failure observed by Cory; timing, state, persistence order, and viewport
bounds are covered by the Companion browser harness.
**Needs Cory:** no

## 2026-09-10 — Release 0.18.4 (18)
**Phase:** 0.18.4 evolution presentation correction
**Decision:** `src/version.js` carries `0.18.4 (18)` and the native wrapper uses marketing
version 0.18.4 with build 18.
**Reasoning:** Companion presentation, migration behavior, runtime styles, and offline
assets changed, so installed PWA caches and the native field build advance together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-10 — Evolution is portaled above the scrolling app shell
**Phase:** 0.18.5 iPhone reveal positioning correction
**Decision:** Companion no longer renders its evolution takeover as a descendant of the
screen. The app owns a fixed, viewport-sized overlay host as a direct shell child, and
Companion portals the ready, transforming, and complete states into it. The host sits
above both navigation and Settings, clears when Companion deactivates, and clips all
presentation graphics to the dynamic viewport. Presentation receipt version 3 gives
affected installs one corrected replay.
**Reasoning:** The global screen-entry animation retains a transform on every screen.
On iOS, a fixed descendant of that transformed screen is positioned against the entire
scrolling Companion page instead of the phone viewport. That is why the completion card
appeared below the fold and the navigation bar crossed over it even though the card's own
dimensions were bounded. A shell-level portal removes the transformed ancestor from the
positioning and stacking chain instead of attempting another size adjustment.
**Confidence:** root cause confirmed from Cory's iPhone screenshot and the shipped CSS;
the browser harness now requires the takeover to be owned by the shell overlay and remain
fully inside the viewport.
**Needs Cory:** no

## 2026-09-10 — Release 0.18.5 (19)
**Phase:** 0.18.5 iPhone reveal positioning correction
**Decision:** `src/version.js` carries `0.18.5 (19)` and the native wrapper uses marketing
version 0.18.5 with build 19.
**Reasoning:** App-shell structure, Companion mounting, presentation migration, and
runtime styles changed, so installed PWA caches and the native field build advance.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-10 — Equipment method changes do not replace the movement
**Phase:** 0.19.0 exercise method selection
**Decision:** Selected presses and shoulder movements have a METHOD control in the active
session. It changes only the performed equipment among curated Barbell, Dumbbell, Cable,
and Machine choices. The canonical exercise id, program slot, activation, task completion,
and XP stay unchanged. Each set stores its method, and LAST, history, PR display, and PR
awards compare only like methods. Existing logs without a method inherit the exercise's
original variant. A method locks after the first set is checked and unlocks when those sets
are undone. Cable selections participate in the existing machine profile and optional peg
entry. Additive seed metadata upgrades existing installs without replacing user fields.
**Reasoning:** A gym station choice should not rewrite the workout. It does need explicit
load context because 45 lb on dumbbells, a cable stack, and a machine are not equivalent
progression records. Curated choices avoid nonsensical equipment options while keeping the
change fast inside the logger.
**Confidence:** specified by Cory; service tests cover method persistence, legacy history,
method-scoped PRs, and stable movement identity, with browser harnesses for the selector,
post-set lock, resume-safe state, and cable peg integration.
**Needs Cory:** no

## 2026-09-10 — Release 0.19.0 (20)
**Phase:** 0.19.0 exercise method selection
**Decision:** `src/version.js` carries `0.19.0 (20)` and the native wrapper uses marketing
version 0.19.0 with build 20.
**Reasoning:** Workout interaction, persisted set metadata, seeded exercise metadata,
cable-machine integration, and offline assets changed, so PWA and native identities advance.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-10 — Cable redraws keep the workout draft's current peg values
**Phase:** 0.20.0 completion payoff and equipment correction
**Decision:** The cable adapter reverse-converts nominal pounds only when a movement first
enters peg mode. Later redraws treat the workout draft's rendered selector values as
canonical and refresh the adapter state from them. Browser checks also reacquire the
movement card after METHOD redraws before choosing Cable.
**Reasoning:** Restoring older per-row adapter entries after set one had already cascaded a
new peg replaced valid values with stale empty state. The readout cleared and logging was
blocked despite a valid selector.
**Confidence:** reproduced in the hosted app; the cable harness covers redraw, cascade,
readout, nominal conversion, method selection, and stored peg metadata.
**Needs Cory:** no

## 2026-09-10 — Workout completion pays off performance and companion growth together
**Phase:** 0.20.0 completion payoff and equipment correction
**Decision:** The single post-workout screen now celebrates completion with restrained
motion, shows duration, sets, reps, volume, and new records, then gives the selected
companion equal visual weight. It names exact care earned, separates the workout and
working-set contributions, shows current growth, and opens Companion directly. If care
has unlocked a new form, the summary announces it but keeps the actual transformation on
Companion so evolution remains deliberate and on-screen. Companion and the recap now use
one shared care calculation.
**Reasoning:** The workout should end with a visible payoff. A generic note that training
"helps your companion grow" did not explain causality or create a satisfying finish. The
reference video established the useful hierarchy—celebration, facts, records, progression—
without requiring its social feed, calorie prompt, or visual identity.
**Confidence:** specified by Cory and grounded in the supplied finish-screen recording;
domain tests cover the shared care math and browser checks cover the visible causal link.
**Needs Cory:** review the finish treatment on iPhone after deployment.

## 2026-09-10 — Release 0.20.0 (21)
**Phase:** 0.20.0 completion payoff and equipment correction
**Decision:** `src/version.js` carries `0.20.0 (21)` and the native wrapper uses marketing
version 0.20.0 with build 21.
**Reasoning:** The completion screen, shared companion-care domain, cable runtime, browser
coverage, and installed PWA assets changed together.
**Confidence:** implementation.
**Needs Cory:** no

## 2026-09-10 — Release 0.20.1 (22)
**Phase:** 0.20.1 cable carry-forward correction
**Decision:** Peg entry now carries a valid set-one selector into every later unlogged set
on input, before focus leaves the field. `src/version.js` carries `0.20.1 (22)` and the
native wrapper uses marketing version 0.20.1 with build 22.
**Reasoning:** Live testing confirmed that the entered peg survived redraw but later rows
could remain blank when iOS focus movement did not produce the core logger's change event.
Immediate propagation preserves the same one-entry workflow as ordinary load fields and
requires a new PWA cache identity after the short-lived 0.20.0 deployment.
**Confidence:** reproduced against 0.20.0 and verified through the hosted interaction.
**Needs Cory:** no

## 2026-09-12 — Program setup does not cut the first week off on Saturday
**Phase:** 0.21.0 starter-week boundary correction
**Decision:** A program started on any weekday keeps its first week for at least seven
calendar days and through the following Sunday. The first rollover is Monday after that;
subsequent program weeks are Monday through Sunday. Week-scoped completion and the visible
week index use the same boundary. Today keeps current-day movement rows prominent and
groups a long list of earlier-week opportunities in a collapsed disclosure.
**Reasoning:** A Saturday setup previously advanced after exactly seven days, so the app
showed Week 2 on Saturday, discarded the apparent current-week completion, and surfaced
24 earlier-day rows as a giant rolled list. Preserving the starter weekend avoids a
premature switch; grouping earlier opportunities retains access without making the screen
look like a debt list.
**Confidence:** reproduced from Cory's September 12 screenshot; service and domain tests
cover Saturday, Sunday, and Monday with logged sets preserved until the real boundary.
**Needs Cory:** verify the installed-app week label and Today density after deployment.

## 2026-09-12 — Cable defaults to PEG; Health handoff is explicit; repeat meals are fast
**Phase:** 0.21.0 feedback batch
**Decision:** Selecting Cable enables the physical FTX PEG input by default, with
movement-specific stack count and an explicit generic-LBS opt-out. Train adds a compact
monthly 30-minute-day calendar and a positive four-days-per-week rhythm; five strong weeks
bank a keeper protecting one quiet completed week. Mobility offers four short selectable
flows. Nutrition keeps a brief AI-derived or manually entered meal description and exposes
frequent/recent entries for one-tap repeat logging. The Home Screen PWA Shortcut copies a
snapshot; the user returns to the installed icon and taps Import Copy. Native iOS reads
HealthKit directly. Sleep outside 0–16 hours is not imported.
**Reasoning:** The old Cable method's LBS field erased the peg convenience. An HTTPS
Shortcut return opens Safari with storage separate from the installed PWA, so the purported
automatic handoff could report success in the wrong app. Explicit clipboard import is
honest and usable; native HealthKit remains the true passive route. Meal labels keep a
history useful for repeat logging without adding friction to the AI photo flow.
**Confidence:** unit tests cover cable defaults, streak accounting, nutrition, and sleep
rejection; browser harnesses cover controls and copy flow. Live iPhone review remains useful.
**Needs Cory:** confirm the two-step Home Screen Health flow and iOS visual fit.

## 2026-09-12 — Release 0.21.0 (23)
**Phase:** 0.21.0 feedback and starter-week correction
**Decision:** Version 0.21.0 (23) advances the installed PWA cache and native wrapper
identity for these changes.
**Reasoning:** Runtime logic, styles, test contracts, and offline module inventory changed.
**Confidence:** implementation, pending CI and deployment verification.
**Needs Cory:** no

## 2026-09-12 — Health clipboard safety and launch automation
**Phase:** 0.21.1 Health handoff clarification
**Decision:** A Home Screen web app must wait for an Import Copy tap to read a Shortcut's
clipboard snapshot. Shortcuts automations may prepare the copy on a time, sleep, or
workout trigger, but cannot make the PWA launch a Shortcut and silently paste on open.
The native iOS HealthKit wrapper remains the automatic on-launch route. Only clipboard
text whose first line exactly matches the Health snapshot marker can be imported;
the copied setup recipe and its example numbers are explicitly rejected.
**Reasoning:** iOS clipboard access requires user interaction, and the setup recipe
previously contained enough marker/example text for the permissive parser to accept it.
**Confidence:** parser regression tests and full local unit suite pass; iPhone workflow
still needs device validation.
**Needs Cory:** confirm native-wrapper availability if zero-tap Health sync is desired.

## 2026-09-12 — Release 0.22.0 (25) launch readiness card
**Phase:** PWA one-tap Health import on launch
**Decision:** Installed Home Screen web app launches into an art-backed motivational
Ready card after onboarding. The main tap requests clipboard access and imports a
Health snapshot dated today; stale or unrelated copies do not change logs. Run
Health Shortcut and Continue Without Sync are always available. The native iOS
HealthKit wrapper does not show the card and continues direct launch sync.
**Reasoning:** The user gesture makes the clipboard handoff feel like one app entry,
while respecting WebKit paste privacy and avoiding a misleading background-sync claim.
**Confidence:** unit and browser harness coverage, with real-device paste prompt
and standalone foreground behavior awaiting user validation.
**Needs Cory:** try the installed Home Screen flow on iPhone and report any paste prompt.

## 2026-09-12 — Shortcut repair must edit the installed action sequence
**Phase:** 0.22.1 Health setup correction
**Decision:** Health Setup and the launch card deep-link to the user's existing
`Tempered Health` Shortcut using Apple's `open-shortcut` URL. Health Setup can also
inspect the current clipboard snapshot without importing it or changing any log.
**Reasoning:** The former “Open Shortcut Editor” linked to `create-shortcut`, which
opened a blank editor and could not repair the already-installed Shortcut. The
updated app recipe is guidance only; app deployments cannot modify personal
Shortcuts stored on the iPhone. A preview exposes a bad numeric output safely.
**Confidence:** Apple documents the URL scheme; unit/browser regression checks.
**Needs Cory:** show which fields or raw snapshot are wrong, then fix those actions
in the installed Shortcut. Do not share anything sensitive beyond what is needed.

## 2026-09-12 — Implausible sleep from the iPhone Shortcut
**Phase:** 0.22.2 Health preview guard
**Decision:** A screenshot shows the Shortcut copied `SLEEP=19.549565571083` for
2026-09-12. The app did not calculate that number. The existing >16-hour importer
guard must remain, and Inspect Copy now flags such sleep values inline before
import, without changing data. Repair guidance calls for inspecting sample
value, source and date, filtering one source plus Core/Deep/REM sleep stages,
and leaving the SLEEP field blank until the Shortcut output agrees with Health.
**Reasoning:** HealthKit In Bed can overlap detailed sleep stages; an unfiltered
sum can count overlapping time. The snapshot alone does not prove which filter
or transformation caused this particular 19.55-hour result. Do not "fix" by
arbitrarily dividing by two.
**Confidence:** Apple HealthKit documentation and regression tests for 19.55h.
**Needs Cory:** inspect the actual Shortcuts Sleep action and show its filters
or resulting stage list; then repair the installed action sequence on-device.

## 2026-09-12 — Iterative sleep diagnostics and temperature removal
**Phase:** 0.22.3 Health Shortcut experiment
**Decision:** Pause automatic sleep calculations in the copied recipe with
`SLEEP=` blank until an independent sleep-only probe establishes sample count,
stage values and duration units. Remove body temperature from the visible
Shortcut recipe, Health Setup manual form, and Progress Body Metrics tile.
Preserve old stored temperature values and parsing for backward compatibility.
**Reasoning:** A replacement Shortcut copied an implausible `SLEEP=809.292677...`
after an earlier 19.55h result. That may reflect a filter, unit conversion, or
both. No safe arithmetic correction can be inferred from the final number.
Cory does not capture body temperature, so it should not occupy UI or setup.
**Confidence:** snapshot evidence and regression coverage for the UI omission;
sleep probe needs a real-device result before a new import recipe is offered.
**Needs Cory:** run the sleep-only probe and share its count, stage labels,
duration list and Find Health Samples filter screenshot.

## 2026-09-12 — Hide the PWA Health experiment until native distribution
**Phase:** 0.22.4 product cleanup
**Decision:** Do not install the Health Shortcut runtime in the production Home Screen PWA.
Hide its launch Ready screen, Today import controls, Settings setup and repair flow, and the
Progress Body Metrics widget. Keep manual sleep, steps and weight logging. Preserve the
underlying Shortcut parser/runtime, native HealthKit wrapper and previously stored values so
the work can be resumed without a destructive migration.
**Reasoning:** Real-device testing confirmed that the Shortcut and clipboard handoff could
not provide the passive launch sync the product promised. Its setup burden and empty advanced
metrics created more friction than value. Native HealthKit remains the appropriate long-term
implementation and does not require the app to be publicly released during development.
**Confidence:** the visible Health surfaces share one runtime installer, while the independent
Progress widget is now absent from both defaults and the add-widget catalogue.
**Needs Cory:** no

## 2026-09-12 — Release 0.22.4 (29) hides experimental Health UI
**Phase:** 0.22.4 PWA cleanup
**Decision:** Version 0.22.4 (29) advances the cache identity for the Health UI retirement.
**Reasoning:** The installed PWA must replace the cached entry module and Progress dashboard.
**Confidence:** implementation and local regression checks.
**Needs Cory:** no

## 2026-09-13 — Unknown history is not zero and turtle heads stay attached
**Phase:** 0.22.5 Progress accuracy and companion polish
**Decision:** Trim every Progress range to Tempered's first recorded day before calculating
habit percentages, training totals, charts, or other time-window statistics. Keep explicit
numeric zeroes when the user actually logged them, label partial 7/30/90-day views with their
real data coverage, show the sample count behind averages, and suppress prior-period
comparisons until both periods have complete coverage. Correct the lower row of the turtle
sprite sheet at render time with a slightly taller, undistorted viewport on every surface.
**Reasoning:** Days before Tempered had any data are unknown, not missed or zero. Counting them
made longer ranges artificially poor and comparisons falsely optimistic. The generated turtle
lineup also lets Levels 6–10 cross above their nominal row boundary, which clipped Level 8 at
the forehead under a square CSS crop.
**Confidence:** shared coverage helpers, unit regressions, source-sheet inspection, and CSS
coverage for habitat, header, evolution, workout summary, setup, and style picker renders.
**Needs Cory:** confirm the installed iPhone view after its service worker updates.

## 2026-09-13 — Open workouts are part of the shell, not a modal dead end
**Phase:** 0.22.5 active workout navigation
**Decision:** Let any open workout add unused movements without changing its saved routine or
program. Minimize persists the full screen draft, returns to the prior Tempered tab, releases
the screen wake lock, and shows a compact Resume control above navigation. A fresh launch goes
to Today and offers Resume rather than deleting the draft or auto-opening the exercise screen.
**Reasoning:** A live workout needs to coexist with planning and logging elsewhere in Tempered.
Treating it as an inescapable full-screen route forced users to finish or cancel before doing
anything else. Added movements remain ad-hoc so they count as training without falsely marking
a prescribed program slot complete.
**Confidence:** source lifecycle review, checkpoint regressions, full unit suite, and updated
browser acceptance coverage; no local Chromium was available, so CI and real-device layout remain.
**Needs Cory:** verify the Resume dock position and add-movement search on iPhone.

## 2026-09-13 — Release 0.22.5 (30) fixes Progress, Companion, and workout flow
**Phase:** 0.22.5 PWA release
**Decision:** Version 0.22.5 (30) advances the installed cache for partial-history accuracy,
turtle sprite framing, add-movement controls, and minimizable/resumable workouts.
**Reasoning:** These changes touch precached application code, documentation, tests, and styles.
**Confidence:** implementation and local regression suite.
**Needs Cory:** no

## 2026-09-13 — Retired RPG code leaves the startup and offline payload
**Phase:** 0.23.1 production cleanup
**Decision:** Keep the old Character and Battle routes available through dynamic imports for
backward compatibility and regression fixtures, but remove their services, screens, effects,
styles, catalogues, and art from normal startup and the service-worker precache. Load the old
styles only if the hidden route is explicitly requested.
**Reasoning:** The visible product no longer links to these routes. Loading and installing the
retired feature on every launch added work without helping the tracker or Companion.
**Confidence:** static-import and precache regression checks plus the full unit suite.
**Needs Cory:** no

## 2026-09-13 — Pages deploys runtime files, not the working repository
**Phase:** 0.23.1 deployment cleanup
**Decision:** Replace root publication and the unused Netlify configuration with a GitHub Pages
artifact workflow. Publish the application shell, runtime modules, data, icons, and runtime art;
retain generation originals under `art/source/` in git without publishing them.
**Reasoning:** Original image generations are valuable project history but add roughly 80 MB to
the public deploy. Tests, docs, native sources, and scratch material are not web-app assets.
**Confidence:** deployment contract test and explicit staging list.
**Needs Cory:** no

## 2026-09-13 — Nutrition fields respect iPhone grid width
**Phase:** 0.23.1 mobile UI fix
**Decision:** Make form inputs shrink within their grid cell and give the native Time control a
full row through 430 CSS pixels, with Calories and Protein sharing the following row.
**Reasoning:** iOS gives `input[type=time]` an intrinsic minimum width. The former 390px media
query missed common 393px iPhones, allowing Time to render on top of Calories.
**Confidence:** screenshot diagnosis and CSS regression coverage.
**Needs Cory:** confirm the installed iPhone layout after its service worker updates.

## 2026-09-13 — Release 0.23.1 (32) reduces the production payload
**Phase:** 0.23.1 release
**Decision:** Advance the cache identity for the nutrition layout repair and startup cleanup.
**Reasoning:** Installed copies must replace the nutrition CSS, application shell, and precache.
**Confidence:** implementation and local regression suite.
**Needs Cory:** no

## 2026-09-13 — Workout elapsed time counts only an open workout screen
**Phase:** 0.23.2 active-session repair
**Decision:** Persist accumulated active-screen seconds instead of an absolute start timestamp.
Pause the timer whenever the workout is minimized, backgrounded, page-hidden, or destroyed;
resume it from the accumulated value only when the workout screen is active again. Treat old
checkpoints without the new elapsed value as zero.
**Reasoning:** An absolute timestamp counted every hour the PWA was closed, producing a false
600+ minute Delts workout. The feature was requested to show time spent in the active workout,
not time since a card was first opened.
**Confidence:** source lifecycle trace and browser acceptance coverage using a simulated full day minimized.
**Needs Cory:** no

## 2026-09-13 — Confirmed workout discard also deletes its screen checkpoint
**Phase:** 0.23.2 active-session repair
**Decision:** Clear the resumable local checkpoint after its set/session records are successfully
discarded and before returning to the main app.
**Reasoning:** The prior cancellation path deleted IndexedDB work but left localStorage intact,
so the active-workout card immediately returned and could reopen the discarded Delts screen.
**Confidence:** direct lifecycle trace plus an end-to-end cancel, confirm, checkpoint, dock, and set-log regression.
**Needs Cory:** no

## 2026-09-13 — Release 0.23.2 (33) repairs stuck workout sessions
**Phase:** 0.23.2 release
**Decision:** Advance the installed cache identity for active-time accounting and reliable discard.
**Reasoning:** Installed PWAs must replace the session screen and guard modules.
**Confidence:** implementation and regression suite.
**Needs Cory:** confirm the old Delts card disappears after one confirmed discard on the updated build.
## 2026-09-13 — Training rhythm shows workouts separately from qualifying days
**Phase:** 0.23.3 accuracy and mobile UI repair
**Decision:** Keep the forgiving strong-week rule at four distinct 30-minute days, but also show
how many active-program workouts contain logged work. Mark every trained calendar date; reserve
the solid acid fill for dates that reach the 30-minute threshold.
**Reasoning:** A fifth completed program workout could be invisible when it was shorter than 30
minutes or shared a calendar date. The app was accurately reporting qualifying days but looked as
though it had lost the workout.
**Confidence:** domain regression coverage and source-level UI verification.
**Needs Cory:** confirm the card reports all five workouts from live history.

## 2026-09-13 — Nutrition time gets a full row on large iPhones
**Phase:** 0.23.3 accuracy and mobile UI repair
**Decision:** Extend the full-width native Time input layout through 520 CSS pixels.
**Reasoning:** Current Pro Max viewports can exceed the previous 430px breakpoint, allowing the
intrinsically wide iOS time control to paint over Calories.
**Confidence:** screenshot diagnosis and responsive CSS regression coverage.
**Needs Cory:** confirm Time no longer overlaps Calories after the installed cache updates.

## 2026-09-13 — Release 0.23.3 (34) repairs weekly reporting and nutrition layout
**Phase:** 0.23.3 release
**Decision:** Advance the installed cache identity for the Train and Nutrition fixes.
**Reasoning:** Installed PWAs must replace the Train screen and responsive nutrition stylesheet.
**Confidence:** implementation and regression suite.
**Needs Cory:** no
## 2026-09-13 — Steps has a personal daily target
**Phase:** 0.23.4 target settings
**Decision:** Add Steps beside Calories in Daily targets, default new and existing profiles to
10,000, and use the saved target everywhere activity metadata drives Today and Progress. Keep the
15,000-step XP cap separate so exceeding a personal goal can still earn the existing configured XP.
**Reasoning:** A fixed 15,000-step completion target made honest 8,000–12,000-step days look
unfinished and could not reflect the person's actual goal.
**Confidence:** specified configurable behavior; inferred 10,000 default from recent recorded days.
**Needs Cory:** no — the target can now be changed in Settings.

## 2026-09-13 — Release 0.23.4 (35) adds configurable steps
**Phase:** 0.23.4 release
**Decision:** Advance the installed cache identity for the settings and activity metadata change.
**Reasoning:** Installed PWAs must replace the Daily service, Settings screen, and activity seed.
**Confidence:** implementation and regression suite.
**Needs Cory:** no

## 2026-09-13 — ChatGPT Health replaces the failed Shortcut handoff
**Phase:** 0.23.5 Health paste import
**Decision:** Add one compact Import Health entry to the Today Daily Recap. It opens a bounded
sheet that can copy the exact ChatGPT Health prompt, paste the nine-line `TEMPERED_HEALTH_V1`
response, preview only populated metrics, and import after a separate confirmation. Blank
fields are skipped. The Apple Shortcuts launch gate, setup screen, and deep links stay dormant.
**Reasoning:** Connected ChatGPT Health produced credible steps, weight, resting HR, HRV,
respiration, and SpO2 in the existing contract. Sleep was correctly blank on a night when no
watch was worn. This makes the explicit paste path useful without reviving the unreliable
Shortcut workflow or cluttering Settings.
**Confidence:** real-device output supplied by Cory, snapshot unit coverage, full regression
suite, and a dedicated mobile browser acceptance harness.
**Needs Cory:** confirm the first live import and iPhone sheet fit.

## 2026-09-13 — Release 0.23.5 (36) adds reviewed Health paste import
**Phase:** 0.23.5 release
**Decision:** Advance the installed cache identity for the ChatGPT Health importer and shared
snapshot engine.
**Reasoning:** Installed PWAs must receive the new runtime, styles, and offline cache entries.
**Confidence:** implementation and regression suite.
**Needs Cory:** no

## 2026-09-13 — Practical health controls replace passive and oversized surfaces
**Phase:** 0.24.0 product utility pass
**Decision:** Daily Recap refreshes immediately after Health import and includes recovery
signals. Mobility opens a dedicated guided screen with routines, cues, timers, and explicit
logging. Train shows only the prior and current week, followed by a transparent readiness
estimate, recent training stats, and a bounded ChatGPT coaching handoff. The third navigation
destination is now Fuel: calories, protein, water, and sleep lead, while the existing companion
is retained below as an optional reward without resetting earned progress.
**Reasoning:** Imported data must visibly land, high-frequency training controls deserve the
screen space, and the former Companion tab did not offer enough repeat utility. Retaining the
pet below Fuel avoids deleting earned history while testing a more practical destination.
**Confidence:** user screenshots and direct product feedback, domain coverage, source-level
regressions, and focused screen acceptance harnesses.
**Needs Cory:** verify the installed iPhone handoff to ChatGPT and decide later whether the
demoted companion earns a permanent place.

## 2026-09-13 — Release 0.24.0 (37) ships the utility pass
**Phase:** 0.24.0 release
**Decision:** Advance the installed cache identity for recap, Mobility, Train, and Fuel changes.
**Reasoning:** Installed Home Screen copies must atomically receive the new runtime and styles.
**Confidence:** implementation and regression suite.
**Needs Cory:** no


## 2026-09-14 — Release 0.26 import, review, and coaching follow-through

- ChatGPT Health import owns the top overlay layer and refreshes the mounted Today screen after confirmation. Imported sleep and steps therefore update the canonical habit rows immediately instead of only refreshing the recap enhancement.
- The prior-day review prompt checks only the most recent seven days that contain recorded data. It is neutral, remains actionable until the day is reviewed, and never creates a penalty or lost-streak state.
- Nutrition uses a native date input capped at today. Switching dates rebuilds the journal so every add, delete, restore, completion flag, and AI paste remains bound to the selected calendar date.
- Readiness keeps the existing personal-baseline calculation and adds explicit green Ready, gold Steady, and warm-orange Recover presentation on Train and Fuel.
- The coaching handoff now sends latest-session duration, working sets, movement count, volume, strongest sets, and reconstructable same-method load or volume PRs. It labels only improvements over earlier stored work as confirmed PRs.

## 2026-09-14: Product Phase 2 is program foundation, not beta hardening

**Phase:** Pre-beta product completion

**Decision:** Withdraw the beta-ready classification. Product Phase 2 is Program Foundation
and Guided First Use. Tempered must explain its tracker-first thesis during onboarding,
support complete on-device program creation and management, offer several editable starting
templates, and guide a new user into the first useful action before TestFlight beta work.

**Reasoning:** The existing tracker has substantial logging, recovery, nutrition, workout,
and progress capability, but it has only one seeded program and no mechanism to create,
edit, duplicate, or archive a program. Setup begins with preferences and companion choice
rather than explaining why Tempered exists and how a person should use it. A product cannot
be considered beta-ready when its core training plan must be supplied by the developer.

**Scope:** Follow `docs/12-pre-beta-product-foundation.md`. New companion content, additional
AI handoffs, public beta positioning, and expanded native distribution remain deferred until
the program and onboarding exit criteria pass.

**Confidence:** Repository audit of the current seed data, setup flow, Train surface, program
storage, and product history.

**Needs Cory:** Validate the first program-builder prototype and the revised onboarding
language on a physical iPhone.

## 2026-09-16 — Phase 2.2: versioned program foundation
**Phase:** Product Phase 2 / P2.2  
**Decision:** Add a program ownership/lifecycle envelope, immutable prescription revisions,
a programRevisions store, export schema 7 coverage, and scheduled workout snapshots that
record the program, revision, day/slot, and prescription used. Migrate existing seeded
programs in place without changing their start date, configured weights, completed sessions,
set logs, records, or other history. Keep the builder UI unreleased until it can create and
edit a complete plan.
**Reasoning:** A future edit must affect future work only. Without an immutable revision,
historical sessions can no longer explain what was prescribed when they happened. The
migration adds metadata and a first revision for the current program but never invents an
old prescription or rewrites a completed log. The new store is included in backup/restore so
the local-first promise remains true.
**Confidence:** specified architecture and migration behavior, implemented with domain and
seed regression coverage.
**Needs Cory:** yes — validate the first program-builder prototype and the revised onboarding
language on a physical iPhone before the next release.


## 2026-09-16 — Completed workout duration can be corrected
**Phase:** 0.28.0 duration correction
**Decision:** Add a bounded manual duration correction in Progress → Log. A correction replaces the
inferred time-under-load value for that completed session and is constrained to 1–240 minutes.
**Reasoning:** The active timer is useful, but a short prescribed workout with full rest can be
legitimate training even when set timestamps undercount it. Conversely, forgetting to stop should
not inflate history. A deliberate correction keeps the record honest without rewarding extra sets
or shame-driven data manipulation.
**Confidence:** implementation and regression coverage.
**Needs Cory:** verify Wednesday's short leg day can be corrected to 30 minutes on the deployed build.


## 2026-09-24 — Away weeks preserve rhythm without pretending to be training
**Phase:** 0.29.0 forgiving rhythm
**Decision:** Settings accepts dated Away ranges. If a completed week touched an Away range and
did not reach four qualifying days, it preserves an existing rhythm without spending a keeper,
adding workout days, or advancing keeper progress. Four real qualifying days still make the week
strong normally. Away time alone never creates a streak.
**Reasoning:** Travel, illness, and life interruptions should not turn a positive consistency system
into punishment. Freezing continuity is honest; fabricating workouts or awarding progress is not.
**Confidence:** domain and service regression coverage.
**Needs Cory:** mark the recent travel dates in Settings and confirm Train shows “streak parked safely.”


## 2026-09-25 — Training history scrolls by week
**Phase:** 0.30.0 training history
**Decision:** Replace the fixed prior-plus-current Training calendar with one horizontally
scrolling, snap-aligned page per week. Include every week from the first recorded workout
through the current week and open at the current week. Preserve the existing markers:
an outline means work was logged and a solid fill means the day reached 30 qualifying minutes.
**Reasoning:** A fixed 14-day window hid earlier completions and made the calendar a status
snapshot rather than useful training history. Weekly pages keep the mobile card compact while
making all recorded weeks reviewable.
**Confidence:** source regression coverage, full CI, and deployed Pages verification.
**Needs Cory:** confirm horizontal swiping and week labels on the installed iPhone.


## 2026-09-28 — Three qualifying days maintain the training streak
**Phase:** 0.31.0 forgiving weekly rhythm
**Decision:** Three distinct days with at least 30 completed training minutes start and
maintain the weekly streak. A fourth qualifying day makes the week strong and advances the
five-strong-week keeper meter. Three-day weeks preserve existing keeper progress but do not
advance it. The rule is derived across stored history, so earlier three-day weeks count.
Away and keeper protection continue to apply only when a completed week falls below the
three-day minimum.
**Reasoning:** Three days is Cory's realistic minimum during busy weeks. Treating that as
failure made the streak stricter than the behavior the product is supposed to support.
Keeping a fourth-day strong-week reward preserves a useful incentive without turning it
into the baseline.
**Confidence:** specified directly by Cory and covered by threshold, mixed-week, Away, and
keeper regression tests.
**Needs Cory:** confirm prior three-day weeks now remain in the visible streak history.


## 2026-09-29 — Tempered uses an autonomous product-team release contract
**Phase:** Product operations / 0.31.1

**Decision:** Codex owns the routine product-manager, developer, and QA loop for the approved
product phase. Every release must pass domain tests, browser acceptance, deterministic mobile
captures at 390×844 and 430×932, direct visual inspection of those captures, and a live
post-deploy inspection. CI preserves the capture matrix as a release artifact. Product promise,
destructive data changes, new external services or permissions, public beta positioning, and
other explicitly flagged product choices still require Cory's approval.
**Reasoning:** Passing assertions did not reveal obsolete RPG language still visible during
first launch. Treating visual inspection as release evidence catches copy, hierarchy, overflow,
occlusion, and integration defects before Cory has to discover them in normal use.
**Confidence:** repository and production audit, full regression suite, hosted CI status, and
live visual inspection of onboarding plus Today, Train, Fuel, and Progress.
**Needs Cory:** validate major product-direction prototypes and the eventual physical-iPhone
pre-beta acceptance pass; routine fixes and release verification do not wait for approval.

## 2026-09-29 — Phase 2.1: Guided First Use
**Phase:** Product Phase 2 / 0.32.0

**Decision:** Replace the preference-first setup with an eight-step, skippable first-use flow.
The flow explains Tempered's effort-and-recovery thesis and local-first boundary, captures a
realistic goal, weekly rhythm, session length, equipment, starting path, optional starting
weights, tracking cadence, and companion preference, then names the user's next action before
entering the app.

**Reasoning:** A new user could previously reach a seeded plan without understanding what
Tempered was for or how recovery fit into the system. The flow now teaches the product promise
before asking for configuration and makes the first useful action explicit. It stores only
preferences and existing-plan edits, so rerunning setup never rewrites history or silently
creates a new program.

**Confidence:** copy regression coverage, updated companion/setup browser acceptance, static
release-visual coverage for welcome, rhythm, and starting-path screens, and the existing full
domain suite.

**Needs Cory:** validate the onboarding language and first-use flow on a physical iPhone;
full template selection and blank-plan creation remain the next Phase 2 slice.
## 2026-09-29 — Phase 2.2: Templates and visual refresh
**Phase:** Product Phase 2 / 0.33.0

**Decision:** Make the starting-path choice real with three templates (Strength Foundation,
November Physique, and Mercy Mode) plus a safe blank-program draft. Refresh the visible palette
from acid lime/moss green to warm amber and lifted teal while keeping the existing dark forest
ground and attribute semantics.

**Reasoning:** Guided onboarding should end in an honest choice that changes the user's starting
point, not a placeholder. Mercy Mode preserves the approved relaxed humor around leg day. The
palette refresh removes the dated lime/pee-green emphasis without changing the no-shame product
contract or the data model.

**Needs Cory:** choose the preferred final art direction after seeing the refreshed release on a
physical iPhone; program editing remains the next implementation slice.
## 2026-09-29 — Phase 2.3: Mobile Program Builder foundation
**Phase:** Product Phase 2 / 0.34.0

**Decision:** Add a small Settings-launched builder for program name, weeks, training days,
exercise selection, sets, rep ranges, draft save, and explicit review/activation. Persist every
save as a new immutable program revision and precache the builder for offline use.

**Reasoning:** Users can now choose a blank program, so the next useful action is a complete
small path to make that draft real. Keeping the builder behind Settings avoids competing with
Today and Train, while the existing revision envelope protects completed history.

**Needs Cory:** physical-iPhone review of the builder's tap density and editing flow; richer
progression rules and exercise substitutions remain future slices.
## 2026-09-29 — Phase 2.4: First-Week Guidance
**Phase:** Product Phase 2 / 0.35.0

**Decision:** Add a small, derived guidance card to Today and Train that names the next useful
program session, offers the existing start action, and explicitly frames repeatable work and
recovery as sufficient. Guidance is visible only where an active program and current day exist.

**Reasoning:** The builder can create a plan, but a new plan still needs a clear first action.
The guidance reduces ambiguity without adding notifications, missed-goal language, debt, or
streak pressure, and it remains derived from the same program state as the workout UI.

**Needs Cory:** physical-iPhone review of hierarchy and copy during the first-week pass.
## 2026-09-29 — Pre-beta proof harness
**Phase:** Product Phase 2 / 0.36.0

**Decision:** Add a real-browser acceptance harness for the Program Builder workflow and move
the Phase 2 exit gate to In progress. The harness verifies opening the builder, adding a day and
exercise, saving a draft, and reviewing/activating without changing the user's history contract.

**Reasoning:** The new builder is the highest-risk user-facing path added since the last visual
release. A deterministic browser journey makes failures visible to the autonomous QA loop before
the 14-day proof and keeps beta readiness evidence separate from unit-test confidence.

**Needs Cory:** physical iPhone acceptance and the eventual 14-day daily-driver observations.


## 2026-09-29 — R1 redesign foundation

- **Decision:** Implement the approved `docs/13-redesign-v1.md` foundation in the real styles and shell, remove `src/slate.css`, and centralize all CSS colour literals in `src/tokens.css`.
- **Art exceptions:** None. Companion image URLs remain illustration references, but no `src/*.css` file outside `tokens.css` retains a hex colour literal.
- **Needs Cory:** None for R1. The phase is fully specified by the approved redesign.


## 2026-09-29 — R2 Today redesign

- **Decision:** Rebuild Today to match section 5 of `docs/13-redesign-v1.md` in the specified order, with no legacy Today surfaces left in the DOM.
- **Behavior preserved:** Habit logging, additive quick-add semantics, configurable quick-add amounts, mobility flows, Health import, nutrition logging, and persisted workout task progress.
- **Shell change:** Settings access now belongs to the Today header rather than a global floating control.
- **Needs Cory:** None. The approved redesign spec and mockup are the source of truth.
## 2026-09-30 — R5 pre-change feature inventory

Inventory source: `d9850f5`, as required by Redesign V1 section 0.1. This inventory was
written before changing the Progress screen or the R5 sweep surfaces.

### Progress — `src/ui/screens/history.js` and `src/ui/progress-dashboard-runtime.js`

- 7, 30, and 90 day ranges, including actual recorded-date coverage and sample counts.
- Period totals for sessions, training days, working sets, tonnage, nominal training volume,
  steps, sleep, weight, and micro cardio.
- Prior-period comparisons gated on complete coverage.
- Daily habit completion rates, a day-by-day heatmap, and current/longest streaks.
- Exercise records for best weight, best volume, and estimated one-rep max.
- Per-exercise load history sparklines and training-session history.
- Session detail data including duration, total volume, working-set count, and manual duration
  correction persisted through `workout.adjustSessionDuration`.
- Recovery signals imported from Health, including resting heart rate, heart-rate variability,
  respiratory rate, and oxygen saturation.
- Configurable progress dashboard: default widgets, add/edit/remove/reorder, and local saved
  order. **Specified removal in R5:** the customizable dashboard tiles and their runtime.
- **Specified removals in R5:** the headline tonnage number, “no prior comparison yet” chips,
  and the stat tile grid.
- Kept in the replacement: ranges, truthful coverage, working-set history, PRs, trend signals,
  recovery signals, habit rates/streaks/heatmap, lift records, log totals, duration correction,
  and micro-cardio totals; duration correction moves into a training-day detail view.

### R5 sweep surfaces — unchanged source inventory at `d9850f5`

- **Settings:** current plan and units; setup rerun and program-builder entry; planned/retroactive
  Away periods with remove action; calorie and step targets; activity tracking cadence and
  weekly targets; exercise-frequency overrides; storage-protection state; full backup download;
  restore-file validation, preview, explicit confirmation, and data replacement; licensing
  credits; version/build date and update check; reset phrase and destructive reset confirmation.
- **Setup:** seven-step first-use and rerun flow; name and units; training goal, sessions/week,
  typical session duration, equipment, template or blank path, template selection, optional
  primary-lift weights, daily/weekly activity cadence, and final next step; saves profile and
  versioned program state.
- **Program Builder:** program name and duration; training-day selection and editing; focus text;
  exercise add/remove; sets and rep ranges; draft save; validation; review and activation with
  immutable revisions and existing training history left intact.
- **Summary:** workout completion date, duration, sets, reps, nominal volume moved, new weight
  and volume PRs, and Done action.
- **Active sheets and overlays:** Health snapshot copy/paste, nutrition entry and photo-prompt
  handoff, cable-machine settings, Today mobility and task details, session finish/discard
  confirmation, restore preview/confirmation, and reset confirmation.

No R5 feature removal beyond the three items explicitly specified above is intended. The
sweep changes presentation copy and token/case consistency while preserving existing controls,
stored data, validation, navigation, and behavior.

**Needs Cory:** none; placements and wording follow the R5 screen list and existing actions.

---


## 2026-09-30 — R8.1 recovery and delivery

- The original R8 task pushed ba00920 while the recovery checkout was validating. Its Node/browser/native checks passed; the explicit Pages deploy failed because its staging step still copied the deleted art/tempered directory. Remove that retired directory from staging, preserving runtime exercise photos and internal legacy assets.
- The R8 stylesheet removal also swept up the independent summary Done-button container and recorded-workout confetti rules. Restore those existing styles from R7 under section 0.1; no character payoff is reintroduced.
- Recovery evidence: R8 acceptance failed three checks at 5c318d6 and passes after removal, including all four tabs, 19 real set logs, summary, and unchanged legacy profile fields. No stored data is changed.
- The R9 browser test was written before its fixes and produced seven failures across all four requested defects at 5c318d6. The next-Monday and correct target-session controls already passed and remain regression guards.

- R8.1 validation: 667 Node tests, 585 checks across 34 browser harnesses, and logging speed pass. The exact curated staging commands now succeed locally. Captured the complete 84-view Light/Dark matrix and inspected the restored summary at 390×844 and 430×932; retained Done controls/recorded-workout celebration match the pre-removal styles, with no character surface.


## 2026-09-30 — R9 rollover and Today fixes

- Started from remote main 3f1c9c7, which includes the completed R8 and delivery repair. Read CLAUDE.md and the complete redesign spec, including section 0.1 and all four R9 items.
- Feature inventory: the d9850f5 Today inventory from R3.1 remains the baseline. R9 retains every movement row, completed/rollover expansion, single-slot opening, full-session opening, summary link, readiness and details, calendar-week stats, Fuel, all Daily log actions, prior-date review, day recap and planner. Changes affect only the Today workout card, queue weekday ordering, and Today's date-refresh lifecycle. Version and continuity notes are release bookkeeping. No other runtime surface, storage or domain engine is edited.
- Test first: added today-r9.html, then ran it on unmodified 5c318d6 and again on current main 3f1c9c7. Both report 10 checks / seven failures: numeric week meta and week-one guidance; Sunday's rollover and the paired Sunday/Monday contract; foreground-after-midnight and explicit refresh; done-plus-leftovers wording. The already-correct Monday-reset and target-session checks remain guards. No fixes preceded these failing runs.
- Use todayTasks().week, the numeric value spread from activeProgram(), rather than changing the public shape of weekStatus().week. The same number drives the week-one guidance branch.
- Weekday indices are Monday-first in the existing queue helper. Existing canonical per-slot/week completion, full-session construction, and storage stay intact.
- Refresh recomputes realToday before loading data. A visible, mounted Today refreshes only if the clock's local date changed; navigation deactivates the listener.
- Completed-today-plus-rollover uses the scheduled day's done title and remaining count; the button names queue.primaryDay and opens the same remainingProgramDay route.

- R9 verification: syntax checks; 667 Node tests; 595 real-browser checks across 35 harnesses; logging-speed and battle-art checks all passed. The R9 acceptance page also passes at the larger phone viewport. Native wrapper remains unchanged; the full iOS build runs in post-push CI.
- Visual QA: captured all 84 release surfaces plus 20 R9-specific states (numeric week, Sunday, following Monday, overnight foreground, done/leftovers × Light/Dark × 390×844/430×932). Inspected both matrices. The Today changes match the R9 spec; the finished-day title, exact count, and Finish Push A fit without clipping. Other screens keep R7/R8 presentation. Compared with the approved R7 Today mockup: the missing character strip/gear beside title are approved R8 changes; seeded movement counts, expanded rollover, dates, and empty readiness differ intentionally by scenario. No unexplained layout or behavior changes remain.

## 2026-10-01 — R10 feature inventory before edits (section 0.1)

Read `CLAUDE.md`, the full redesign spec on `5d99f3d`, current state and release contract.
Reviewed `git show d9850f5:<path>` for Today, Train, History, Settings, Health paste runtime,
and Nutrition runtime. Existing R3.1 inventories remain the broader baseline audit.

- Today: dated activity logging/undo, editable sleep/additive values, quick presets, weekly
  targets, extra logging, date navigation, planner CRUD/rollover/notes/due date/type,
  program exercise/frequency logging, recap/Health, guided mobility timers and completion,
  readiness/baselines, weekly training, nutrition entry and workout/summary routes. Keep all;
  only the workout movement lists gain a disclosure and leftovers-first Next up.
- Train: program/week/deload, prescriptions, next/full/single exercise/routine sessions,
  searchable library with last/PR context, hard-set targets, program builder, training
  history including qualifying days, today, strong weeks/keepers/away protection. Keep all;
  current week moves under program, complete history remains a drill-in.
- Progress: ranges, observed coverage, canonical working sets/volume, PRs/e1RM/lift
  history, habits/rates/current/best streak and daily completion map, session dates/minutes
  correction. Keep all; date rows merge for presentation only, every constituent session
  retains its own duration editor, sets group by exercise, heatmap gets a visible label.
  R5's explicitly retired customizable dashboard is not reinstated.
- Nutrition: dated totals including carryover, all five macro fields, description and time,
  AI photo prompt/import review, manual save, recents/frequent quick logging, timestamped
  history/delete/undo, complete/partial day status. Keep all in the same view; restyle only.
- Health: exact copy/open prompt, clipboard and long-press paste, field/date preview,
  blank-field skipping, future/earlier-date warnings, explicit canonical import, provenance,
  underlying recap refresh, Done/back/escape. Keep all in a full-screen numbered flow.
- Settings: plan/setup/builder, appearance, away ranges/remove, calorie/steps targets,
  cadence/frequency, backup/export/preview/confirmed restore, persistence report, credits,
  version/update and explicitly confirmed reset. Keep all; neutral fills/ember selection.

Before runtime edits, the R10 Today browser fixture seeds 8 today + 3 leftovers.
The baseline fails collapsed default, disclosure, collapse persistence and next-day reset;
expanded assertions also require the actual disclosure state, avoiding baseline false passes.

## 2026-10-01 — R10 implementation and release evidence

All nine approved items implemented. Today stores `{date, expanded}` on the existing profile
through the storage adapter, so navigation/reload keeps the choice until the local day changes.
Its collapsed movement prioritizes leftovers; expanded lists retain all slot and full-session
routes and completed-movement disclosure. Saves are serialized before refreshing to avoid a
quick collapse/navigation race. R6/R9 tests now expand before inspecting the full queue.

Train exposes the current-week strip immediately under the program card and opens the complete
history on tap. Program details becomes a pushed view with description/deload, hard-set targets
and builder. Keeper progress and protected-week labels remain available in full history.
Health uses a full-screen three-step view with a scrollable body and a separate bottom action,
sized to the visual viewport as the keyboard changes; it does not summon the keyboard on open.
The apparent stray input was the empty preview's grid style overriding the HTML hidden state.
Only parsed data reveals that preview. Removed an obsolete `enhance()` call that made a successful
import report a false failure; preview, date warnings, confirmation, provenance and Done remain.

Nutrition has plain surface-2 totals, green macro ink/quick Add and one green Add meal primary;
copied-nutrition import is secondary. Day status is a two-choice segmented control. The time
input spans its own row with bounded sizing and native appearance normalization. All meal fields,
history, carryover, quick-log, delete/undo, date corrections and AI review remain functional.
Pushed views use their owning token styles rather than a new override stylesheet; neutral
rectangular outlines are removed while specified Today tint borders, circular day/check markers,
dividers and keyboard focus indicators are retained. No colors or important rules added.

Progress uses train ink for lift lines, recovery ink for sleep/recovery, and fuel ink for
weight/steps. Only favorable deltas use fuel ink; weight and respiratory changes stay neutral.
Lifts explicitly labels e1RM in lb and omits an unavailable change instead of a stray dash.
Log has one row per date, using routine/program day names where known and otherwise a canonical
movement count. Detail groups every set by exercise/method with warm-up and non-rep measurements
preserved, and exposes each original session's minutes correction independently. No records
are merged in storage. Habits retains Best, shows current streak only above zero, and labels
its daily completion map.

Fail-first: final Today fixture on `5d99f3d` reports 8 checks / 7 failures; Next up's underlying
single-slot path was already valid and remains a regression guard. The separate sub-screen
fixture reports 29 checks / 20 failures on that baseline. Fixed versions pass all 37 checks.
Full gates: 667 Node tests; 632 browser checks across 37 harnesses; syntax, logging-speed,
battle-art, token and no-uppercase checks pass. Version is 0.47.0 (65).

Visual review: expanded CI matrix has 28 views × 2 sizes × 2 themes = 112 captures. Reviewed
both compact/large contact sheets in Light/Dark. Per-view computed audit also records rectangular
outline and non-domain spark findings in the manifest; none remain. Retired Shortcut setup/launch
fixtures are excluded from release captures and production Settings mounting, because production
has used the independent ChatGPT Health import since 0.24; retained archive code/tests are unchanged.
The matrix adds current Health review, Nutrition meal form, Train history/details/routine/library,
Today expansion/day details and Mobility. Captures blur keyboard focus after navigation so a
focus outline is not mistaken for a tile border.

Mockup comparison: Today adds the approved R10 Next up/disclosure and R8 removes the character;
R7/R10 intentionally add domain tints/colors and Light mode. Core order is preserved. Fuel's
empty ring, green meal action and water controls match the revised spec. The session fixture
shows a real RDL prescription/photo/plate line per R3.1, rather than the mockup's two generic
exercises. Progress uses real seeded PRs/trends and Habits rather than the mockup Body tab;
colored chart lines supersede its grey lines. Data, fixture date/week and long names differ;
no unexplained outlines, clipping or layout differences in touched views remain.

Needs Cory: installed-iPhone Health keyboard/paste/back flow and status/home-indicator safe
areas need physical-device confirmation; the browser tests simulate the visual-viewport shrink
but cannot reproduce iOS clipboard permissions, native date/time rendering or standalone chrome.

## 2026-10-01 — Active workout header clearance (0.47.1)

- **Decision:** The session header content now starts 10px below `env(safe-area-inset-top)` and its height includes the inset; the dark-theme `--status-bar` strip matches `--bg`.
- **Reasoning:** On Cory's iPhone the header title sat flush under the status bar and rendered faded, consistent with iOS 26 standalone blurring content just below the status bar, and the darker strip drew a visible band above the header. Light theme keeps its dark strip for status-text legibility.
- **Needs Cory:** confirm on the installed app that the title is crisp and no band shows.

## 2026-10-01 — Screen entry animation no longer leaves a transform (0.47.2)

- **Decision:** `phase8-screen-enter` now ends at `transform: none` and uses `animation-fill-mode: backwards`, so no transform remains on `.screen` after it plays.
- **Reasoning:** 0.47.1 moved the session header lower but the title stayed blurry while Cancel and the timer were sharp, so position was not the cause. A permanent identity transform keeps the screen composited, and iOS WebKit can rasterize sticky header text at fractional offsets inside that layer. Best hypothesis, not reproducible in desktop Chromium.
- **Needs Cory:** confirm the workout title is sharp on the installed app.


## 2026-10-01 — R11 Training score

### Feature preservation and scope
- Re-read `git show d9850f5:src/ui/screens/history.js`: Overview recap/comparisons, training volume and PRs, habits and streaks/heatmap, exercise records/history, session history and minutes correction. The R10 inventory remains the item-by-item baseline. All retained functionality stays in its existing Progress section; R11 adds the first Overview card, four evidence drill-downs, and lines in the existing clipboard report. No other screen module changes, no stored data edits or migrations.
- Domain takes canonical finished sessions, non-warmup set logs, exercise metadata, program states, programs and immutable revisions. Dates arrive as calendar-local ISO strings from the clock adapter; date arithmetic never reads a clock or constructs a Date in the domain.

### Calculation choices for unspecified details
- Score weeks are Monday–Sunday, matching program rollover and existing training rhythm. The current week is explicitly `so far`. Compare the current score with the preceding four scored calendar weeks, excluding current; fewer available weeks are used and identified. Round only the final score and displayed change; grade the displayed score.
- Compare equipment methods independently. Require three distinct finished sessions and evidence in both comparison periods. Up earns 1, held within 1% earns 0.6, down earns 0. Unloaded movements compare measured reps at the same load instead of claiming a load e1RM; loaded/bodyweight variants use the existing effective-load and e1RM engines.
- Planned sets match program/day/slot identity within the week, including substitutions and Sunday leftovers, with credit capped per slot. Rep attainment uses the logged prescription minimum when present and the resolved slot minimum for older compatible logs; unplanned sets contribute to volume but cannot complete a planned slot.
- Consistency sums finished-session minutes per local date, uses the existing 30-minute qualifying threshold and the program's nonempty planned days. Its trailing four weeks include current, with untracked weeks omitted. Volume counts canonical working sets, compares the preceding four tracked weeks, and reaches full credit at 95% of their average.
- Insufficient progression history or a missing/zero prior-volume baseline is excluded and remaining weights renormalize. Missing plan components are excluded rather than inventing targets. Deload excludes progression and volume, leaving adherence and consistency at 30/55 and 25/55. Untracked weeks and all-history-empty points are never assigned artificial zero scores.
- Prefer the week's first recorded immutable program revision, otherwise the stored state/envelope prescription. Older weeks without a recorded historical prescription cannot recover an unknown past edit; no history is rewritten. For states starting on the same day the active plan breaks the tie. These are compatibility fallbacks, not a new data model.

### Evidence
- Wrote the five named fixtures before the implementation existed: improving block, stalled block, deload week, missed week and brand-new user. Ran them with 0 passing / 5 failing, each `ERR_MODULE_NOT_FOUND` for training-score.js; then implemented. Additional tests protect caps, rep thresholds, leftovers, warmups, method isolation, future/incomplete sessions and immutable revisions. Same-day switching test independently failed with 99 versus 4 prescribed sets before its fix.
- Browser acceptance covers the first card, 12 weekly points, both themes, all four evidence drill-downs/back controls, report score/grade/components/change, existing Log and empty state. All displayed component percentages have both weights and evidence; inaccessible history says why it is not scored.
- R11 captures extend the release matrix with all four drill-downs at both phone sizes in Light/Dark. Mockup differences: Training score is now first per R11; existing Weekly sets, PRs, Trends, Recovery and report follow unchanged. The new evidence views follow existing filled surface rows and chevron back navigation. No new outlined tiles, shadows, literal colours or theme-specific overrides.
- Release identity 0.48.0 (68), with training-score.js explicitly precached for offline Progress. Physical-device behaviour and all other screen layouts are unchanged.

- Final engineering gates: 678 Node tests, 656 browser checks across 38 harnesses, 17 logging-speed checks, syntax and battle-art contract all pass. Reviewed the 20 new score/evidence captures in Light/Dark at both sizes against the mockup; 128 release captures total. Card summaries fit phone width; complete attainment counts remain in evidence/report. R11 is rebased onto the concurrent 0.47.1/0.47.2 device fixes and preserves them unchanged.

## 2026-10-01 — R11.1 training score corrections (0.48.0)

- **Headline:** the graded score is the last completed, non-away week. The week in progress shows `This week: X of Y sets due so far`, where due = prescribed sets for program days before today plus today's sets once logged. Program days map to weekdays by id (`monday` ...), otherwise by position.
- **Training day:** 6+ working sets or 30+ total minutes on a date, in both the score and Training rhythm (`minimumSets` option, default 6).
- **Away weeks:** reuse the existing profile `awayPeriods` (Settings) rather than a second store. New `Mark away` / `Not away` toggles in Progress › Training score › Weeks and in Training rhythm add or remove a Monday-Sunday period. Multi-week periods made in Settings show as "set in Settings" and are edited there.
- **Slot matching:** exact slot identity first, then the slot's exercise or its `substitutedFor`, from any session type in that week, capped per slot, each set used once. The R11 test asserting that unplanned sets never fill a slot now uses a different exercise, because crediting the planned exercise logged outside its slot is the intended R11.1 behaviour.
- **Explanation:** `explainTrainingScore()` is pure template text from component data; the ChatGPT report includes it.
- **Known unrelated failure:** `calorie-ai.html` "Meal keeps its timestamp and AI source" fails on this container before and after this change (time-zone dependent); not touched here.
- **Needs Cory:** check that the recalculated weeks match how they felt, and mark the travel week away.

## 2026-10-01 — R12 readable trend charts (0.49.0)

- **Decision:** `src/domain/trend.js` (pure, tested) provides the rolling average (7 days for daily metrics, 3 sessions for lifts), change text, good-direction table, and usual-range band. Every Progress sparkline (Trends, Recovery, Lifts rows, Lift detail) now draws faint readings, a bold average line, an end dot, and on Recovery a usual-range band.
- **Band width:** mean ± 1 SD but never narrower than ±2% of the mean. A pure ±1 SD band flagged blood oxygen at 98% as "above your usual range" because readings barely vary.
- **Lifts rows** keep R10's 30-day peak change text; the chart uses the last 12 sessions.
- **Superseded checks:** R6's "Steps delta appears after three samples" and the R5 regression asserting `progress-trend__samples` were updated: R12 replaces sample counts with a change sentence and requires 7 readings before showing a trend.
- **Capture set:** added `progress-trends` (scrolled to Trends and Recovery) to the release visuals.

## 2026-10-01 — Smoother, contained trend charts (0.49.1)

- **Overflow:** charts were a fixed 132px inside a 104px (88px on small phones) grid column, so they ran off the card. Charts now fill their column (112px, 96px under 390px wide) with `overflow: hidden`.
- **Smoothing:** daily metrics use time-aware exponential smoothing (7-day half-life) run forward then backward, so the line is smooth and has no lag; drawn as a monotone cubic curve that cannot overshoot the data. Lifts keep the 3-session average.
- **Change text:** daily metrics compare the mean of the last 7 days of readings with the first 7 days, so one odd day at either end does not set the headline.

## 2026-10-01 — Score explanation sheet above the tab bar (0.49.2)

- **Decision:** the explanation sheet is mounted on `<body>` and closed on every re-render that leaves Overview; the page behind it stops scrolling while open. Inside the card it was trapped in the scrolling page's stacking context, so the tab bar covered it and hid Done.
- Added `progress-score-explain` to the release captures.

## 2026-10-01 — Explanation credits points added (0.49.3)

- **Decision:** "X carried it" names the component with the largest value × weight, not the highest raw percentage. Cory's real week read "Volume trend carried it" because volume (10% weight) scored 100%.

## 2026-10-01 — Health import always reachable (0.49.4)

- **Decision:** Readiness on Today always shows an `Import` button (recovery blue) beside its info button, in addition to the empty-state `Import from Health`. Since R2 the import view was reachable only when today had no recovery values, so logging sleep in the Daily log removed the only way in.

## 2026-10-01 — My foods replaces Recent on Fuel (0.50.0)

- **Decision:** Fuel's three-item Recent list is now `My foods`: a search box over every distinct food ever logged (same description and macros), the three most-logged pinned under `Most logged` (only foods logged more than once), and `All foods` newest first (5 shown, `Show all N foods`). One tap on + logs the saved macros to today; the row confirms `Added to today`. Search requires every typed word, any order, case-insensitive. Typing updates only the results so the keyboard stays up.
- Domain: `foodLibrary()` and `searchFoods()` in `src/domain/nutrition.js`, test-first. Browser proof: `test/browser/fuel-foods.html`.
- Copy and R4 regression tests that named the old Recent list were updated to the new names.

## 2026-10-01 — Meal entry inline on Fuel (0.51.0)

- **Decision:** Fuel no longer sends meal entry to a separate screen. The nutrition runtime builds an inline panel (once per date, reused across Fuel re-renders so half-typed meals survive) containing `Add a meal` (meal, time, five nutrients, Meal photo, Import copied nutrition, Add meal), `Today's meals` with delete and Undo, Day status, and `Log for an earlier day`, which opens the existing dated full-screen view. Fuel's `Log a meal` button is gone; Add meal is the single filled button.
- **Mechanics:** Fuel dispatches `tempered:mount-nutrition-panel` with a persistent slot only when the slot is empty or the date changed; My foods taps dispatch `tempered:nutrition-refresh`. The runtime's shared helpers resolve the active host (overlay if open, otherwise the panel). A browser test proves no idle refresh loop.
- **Search to entry:** a My foods search with no match offers `Add "…" as a new meal`, filling the form and focusing Calories.
- **Kept:** Today's Fuel `+` still opens the full-screen entry view for a quick add without leaving Today; the dated view remains for earlier days.
