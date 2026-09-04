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

## 2026-09-04 — Exercise art comes from free-exercise-db, and the licence chain has a kink
**Phase:** 3.5 D (unblocking)
**Decision:** All 17 program movements now have art in `art/exercises/`, sourced from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) at revision
`a859101`. The watermarked `art/source/exercise-frames.png` and its crop are deleted.
Attribution is in `README.md`; per-file provenance is in `art/exercises/SOURCES.json`.
**Reasoning:** Cory directed me to source openly licensed art rather than publish the
"STRENGTH LEVEL" watermarked image, which was the rights question I flagged in Phase 3.5 D.

The licence needs stating carefully, because it is not one licence but three.
free-exercise-db carries **the Unlicense** — a public domain dedication that permits
copying, modifying and publishing with no conditions at all. Read alone, that settles it.

It does not stand alone. That archive took its imagery from
[wrkout/exercises.json](https://github.com/wrkout/exercises.json) (also Unlicense), which
took it from the [Everkinetic](https://github.com/everkinetic/data) open data project by
Greg Priday — and Everkinetic, the oldest ancestor still carrying a licence file, is
**CC BY-SA 4.0**. Two intermediaries relicensed CC BY-SA material as public domain. A
relicensing like that is only valid if whoever did it held the rights, and there is nothing
in either repository showing they did.

So I did not pick a side. The images are used **as if CC BY-SA 4.0 still bound them**:
attributed to Everkinetic and to the archive, with the modification described, the licence
named and linked, and the images stated to remain under CC BY-SA 4.0 while the rest of the
repository does not. That costs a paragraph in the README and satisfies both readings —
whereas relying on the Unlicense and being wrong would mean stripping attribution from
CC BY-SA work on a public site. Under BY-SA, including the images in a larger collection is
allowed; it is the images themselves that carry the licence, not Tempered.
**Confidence:** inferred — the Unlicense text is unambiguous, the chain behind it is not.
**Needs Cory:** yes, but not blocking. Two things worth an opinion. (1) If you want the
simple story, the position is defensible either way and the app ships as is. If you want
certainty, the safest version is dropping the attribution question entirely by paying for
a licensed set. (2) If Tempered ever gets a LICENSE file of its own, it must exclude
`art/exercises/` or it will claim terms over images it does not own.

## 2026-09-04 — Two frames per movement, not one
**Phase:** 3.5 D
**Decision:** Each art file is the archive's frame 0 and frame 1 side by side, scaled to
300px tall and joined with a 2px gap. JPEG, quality 78. 17 files, 800 KB total.
**Reasoning:** `docs/09 D` says the art exists to answer "which incline curl variant is
this". One frame often cannot. The start frame of a lateral raise is a man standing still
holding dumbbells, which is also the start frame of a hammer curl, a shrug and a deadlift;
only the second frame distinguishes them. Start-plus-finish also reads as a movement rather
than a pose, which is what a reference image is for. JPEG because these are photographs —
PNG was right for the sprite work and is wrong here, at roughly four times the size for no
visible gain. The existing single-filename `art` field needed no change.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Exercise art is precached
**Phase:** 3.5 D
**Decision:** All 17 art files were added to `PRECACHE` in `sw.js`, adding ~800 KB to the
install. A node test asserts the list and the `art` fields cannot drift apart.
**Reasoning:** `CLAUDE.md` non-negotiable 5 is that the app works fully offline. The runtime
handler caches images once seen, but that makes the first sight of a movement depend on
signal — and the place you look up an unfamiliar lift is a basement gym with no bars. 800 KB
once, at install, buys reference imagery that is never missing. Art is referenced from
`data/exercises.json`, not imported, so the existing import-graph test could never have
caught a missing entry; that gap is now covered by four assertions, each proven to fail.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — `tools/slice-exercise-art.js` kept, with an empty manifest
**Phase:** 3.5 D
**Decision:** The slicing tool stays in the repo, its `ART_MANIFEST` emptied and its purpose
restated at the top. Running it prints that there is nothing to slice and exits 0.
**Reasoning:** Its only entry cropped a source file that is now deleted, so leaving the
manifest as it was would have left a tool that crashes on sight. Deleting the tool outright
was the other option and I did not take it: the PNG decode/encode/trim cropper is the
expensive part, it is written and it works, and a real frame sheet would need it back. An
honest note costs less than rewriting it later. Flagging rather than deciding silently,
since dead code is exactly what rots.
**Confidence:** inferred
**Needs Cory:** no — but say the word and it goes.

## 2026-09-04 — The plate calculator was already surfaced; docs/09 C needed no work
**Phase:** 3.5 C (verification)
**Decision:** Changed nothing. Confirmed that `platePanel()` renders inline in every
exercise card in `src/ui/screens/session.js`, unconditionally, for any exercise not measured
in time — not behind a menu, a tab or the `openPanel` toggle that gates REST, HISTORY, SWAP
and the art enlargement.
**Reasoning:** Asked to surface it, I checked before building. `docs/09 C` requires it "next
to the weight field during a session, not behind a menu", and it was already put there in
Phase 3.5, with a test in `test/browser/tracker-v2.html` asserting `.plates` is present
without any interaction. The one nuance worth recording: it sits directly below the set rows
and the ADD SET button rather than horizontally beside the weight input, so "beside" is
satisfied in the sense of same card, always visible, no interaction — not literal adjacency.
That reads as correct on a phone, where a horizontal split beside a numeric field would
leave neither enough room.
**Confidence:** specified
**Needs Cory:** no — unless you read "beside" literally, in which case say so and it moves.

## 2026-09-04 — Version bumped to 0.4.1 (3.6)
**Phase:** 3.5 D (unblocking)
**Decision:** `src/version.js` carries `0.4.1 (3.6)`. A patch bump, and the parenthetical
still names 3.6.
**Reasoning:** `PRECACHE` changed, and the cache key derives from this — without a bump an
installed phone keeps serving a cache with no art in it. Not a phase completion, so the
minor stays put; the parenthetical names the last phase reached rather than 3.5 D, because
this work landed after 3.6 and labelling it "(3.5 D)" would read like a build going
backwards.
**Confidence:** inferred
**Needs Cory:** no
