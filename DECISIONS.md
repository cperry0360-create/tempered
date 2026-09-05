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

## 2026-09-04 — What counts as a session, and why the guard sits above every Grit source
**Phase:** bug fix (docs/01)
**Decision:** A session earns Grit only if at least one set was logged. The guard returns
early from `gritAwards` before any source, so the flat award, time under load, the return
bonus and the weekly plan bonus are all suppressed together. `docs/01` now defines this.
**Reasoning:** Cory saw +142 for zero sets and zero pounds: 140 flat, plus 2 for the
one-minute floor on duration. The spec said "session completed — flat per training
session" and never said what a session was, so the engine paid for opening one.

Guarding only the flat award would have moved the hole rather than closed it. All four
sources rest on the same premise — that a session happened. Time under load with nothing
logged is time under nothing; the return bonus would pay for coming back to log zero; the
week bonus would count a session that never was.

Might was already immune, because it is derived from volume and an empty session has none.
That is the difference the spec now states in general terms: score the measurement where
one exists, and where an award pays for an action instead, the action has to be one the
user deliberately took and the app can see evidence of.
**Confidence:** specified — Cory defined the rule; the scope of the guard is inferred.
**Needs Cory:** no

## 2026-09-04 — A warm-up-only session still counts as showing up
**Phase:** bug fix
**Decision:** The guard counts any logged set, warm-ups included. A session of nothing but
warm-up sets earns full Grit and no Might.
**Reasoning:** The rule Cory wrote is "at least one set was logged", and a warm-up is a
logged set. It is also the least punishing reading: someone who warmed up, felt a tweak and
stopped did show up, and non-negotiable 4 says missing produces no gain rather than a loss.
Might already declines to pay for warm-ups, which is the right place for that distinction —
Grit is about attendance, Might about load.

Worth noting this was not a free choice: `workout.test.js` already carried a test asserting
that a warm-up-only session scores no Might "but showing up still counts". The rule was
therefore already in the codebase, and the guard was written to preserve it rather than to
introduce it.
**Confidence:** inferred
**Needs Cory:** no — but it is the one place the rule could reasonably read the other way.

## 2026-09-04 — The empty session is discarded, not stored as completed
**Phase:** bug fix
**Decision:** `finishSession` returns `null` and deletes the session record when nothing
was logged. The deletion is guarded against the whole session, never against `onlySets`.
**Reasoning:** Suppressing the XP was not enough. A stored empty session is not inert: it
counts toward `sessionsThisWeekBefore`, inflating the week-met-plan bonus, and it resets
`daysSinceLastSession`, which silently swallows a later return-after-a-gap bonus. Open a
session on the day you come back, log nothing, close it, then actually train — and the
bonus for coming back is gone for good. There is a test for exactly that.

The `onlySets` distinction is load-bearing and nearly went wrong. In slot mode the record
is the DAY's session and may already carry earlier slots. Deleting it because *this* slot
logged nothing would destroy real training, so the delete asks whether the session holds
anything at all, not whether this settlement does.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Finishing with nothing logged closes silently
**Phase:** bug fix
**Decision:** `finishSession` returning `null` means the screen closes back to the tab it
came from. No summary.
**Reasoning:** Cory asked for this and it is right: there is nothing to summarise. A
post-session screen reporting no sets, no volume and no XP is a screen that reports
nothing, and against an app whose whole posture is "missing produces no gain, never a
loss", it reads as a rebuke. Silence is the correct absence of an event.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Audit: where else an XP source pays for an action
**Phase:** bug fix
**Decision:** Checked every source in all five attributes. One live bug, found in two
places; one latent class, now governed by a written rule.
**Reasoning:** Cory asked whether the same hole existed elsewhere. Findings:

- **Might** — derived from volume. An empty session has none. No hole, and this is why the
  bug showed as Grit 142 with Might 0.
- **Wind** — fully derived. Every source multiplies a measured quantity, and awards of zero
  are dropped, so nothing can pay for an absence. No hole.
- **Mind** — the four duration sources are gated on minutes greater than zero. `mind.journal`
  is flat on a boolean.
- **Vitality** — `proteinTargetMet`, `nutritionLogged`, `restDay` and `bodyMetricsLogged`
  are all flat on booleans.
- **Grit** — the bug. And a second door into it: the seeded `cardio` routine ships with
  zero exercises, so starting and finishing it logged nothing and paid the full flat award.
  The same guard closes both.

The Mind and Vitality booleans are **not** the same bug. They pay for an action the user
deliberately took, which `docs/01` mandates ("the act of logging honestly", "rest day taken
— a rewarded action, not an absence") and non-negotiable 4 requires. Nothing in the app
writes any of those flags yet, so there is no live hole. The risk is a future day-logging
screen that sets them on open rather than on save, which is precisely the Grit bug in
another costume — so `docs/01` now carries the general rule: opening a screen is not an
action, and any flat award must name the evidence it requires or it pays for navigation.
**Confidence:** specified (measured against each module)
**Needs Cory:** no

## 2026-09-04 — Netlify replaces GitHub Pages, and what that does not fix
**Phase:** hosting
**Decision:** Added `netlify.toml` — publish the repository root, no build command, cache
headers that keep `sw.js` and the shell revalidating. Documented connecting the site and
making the repository private in `README.md`, and repointed `CLAUDE.md`, `docs/07` and the
Phase 0 report away from Pages. The Netlify site itself is not connected: that needs a
browser sign-in and authorisation of Netlify's GitHub app against Cory's account.
**Reasoning:** The move is cheap because the app was already base-path agnostic — every
path is relative, which is what `CLAUDE.md` demanded for the `/tempered/` project path and
what now lets it serve from a domain root unchanged. Nothing in the app needed touching.

**One correction to the premise, flagged rather than assumed away.** Cory's reasoning was
that a private repository serving a personal app publishes nothing, which removes the
exercise-art licensing question. Going private does remove one channel: the images, the
provenance file and the README attribution stop being publicly readable. It does not make
the deployed site private. A Netlify site is reachable by anyone with the URL, so the
images are still published — and the attribution that is supposed to travel with them is
now in a README nobody can read, which is strictly worse than today under a CC BY-SA
reading. So the question is narrowed, not removed. Two things close it properly, both
small, neither done: password-protect the Netlify site, or carry the attribution on the
Settings screen so it travels with the images. `README.md` says this plainly.
**Confidence:** inferred
**Needs Cory:** yes — which of the two, if either. The app ships either way.

## 2026-09-04 — Version bumped to 0.4.2 (3.6)
**Phase:** bug fix
**Decision:** `src/version.js` carries `0.4.2 (3.6)`.
**Reasoning:** Awarding behaviour changed, so an installed phone must not keep serving the
build that paid for empty sessions. The cache key derives from this.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.5 E: the backdrop is Cory's own work, and the palette comes from it
**Phase:** 4.5 E
**Decision:** `art/source/bg-night-forest.jpg` is committed, and the colour scheme —
ground gradient, surfaces, and all five attribute colours — is derived from it. Credited
in `README.md`; `docs/04`'s colour section is superseded and says so.
**Reasoning:** Provenance is clear and first-party: Cory confirmed the artwork is his own
original work. `docs/11 E` says "do not commit the image until its provenance is
established… the image layer goes behind a flag until cleared" — that condition is met, so
the flag was never built. Recording it because the doc reads as an unconditional
instruction and someone will otherwise wonder why the flag is missing.

This is the opposite situation to the exercise photographs, and worth naming as such: there
the chain of licences was three deep and the images had to be attributed defensively; here
there is no chain at all, and nothing to attribute except authorship.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.5 E: four of the five attribute colours had to be lifted
**Phase:** 4.5 E
**Decision:** The art's sampled accents are kept as `--lantern`, `--wisp`, `--moss`,
`--cap` and `--stone`. The five attribute tokens are those colours raised in HSL
lightness — hue and saturation held — until each clears 4.5:1 as text on `--surface` and
3:1 for a `--canopy` glyph on it as a tile fill.

| Attribute | Sampled | Shipped | Lift |
|---|---|---|---|
| Might | `#d2a44d` | `#d2a44d` | none needed |
| Wind | `#3798a8` | `#3ba4b5` | +4% L |
| Grit | `#4a7890` | `#6f9db5` | +14% L |
| Vitality | `#306c59` | `#4ba88a` | +17% L |
| Mind | `#755e98` | `#a190ba` | +16% L |

**Reasoning:** Measured before building anything. At the raw sampled values only Might
passed: Wind read 3.91:1, Grit 2.76:1, Mind 2.40:1 and Vitality 2.15:1 as text on a card.
Section A puts these colours on every row of the densest screen in the app and section C
floats XP in them, so unlifted they would have shipped a list nobody could read at arm's
length in bad light — the exact failure `docs/04` was rewritten to fix.

Lifting is not a departure from the doc: `docs/11 E` already does it once itself, mapping
Grit to "`--stone` lifted to `#4a7890`". That lift was simply not far enough. Hue and
saturation are held so each colour still reads as the thing it came from — the lantern is
still lantern-light, the caps still violet.

Proven load-bearing rather than assumed: reverting Vitality to the sampled `#306c59` turns
three assertions in `structure-and-feel.html` red at 2.15:1.
**Confidence:** inferred (the values are measured; the decision to lift is a judgement)
**Needs Cory:** no — but if the palette should match the picture exactly at the cost of
legibility, that is a call only you can make, and it reverses this.

## 2026-09-04 — Phase 4.5 B: steps and mobility live in RECOVER
**Phase:** 4.5 B
**Decision:** TRAIN holds the program slots and nothing else. The two Wind activities,
steps and mobility, go at the end of RECOVER.
**Reasoning:** `docs/11 B` names three sections and assigns every Vitality activity to
RECOVER and every Mind activity to SHARPEN, leaving the Wind pair unnamed. Putting them in
TRAIN was tried first and broke two things: it made steps the first daily action on the
screen where `docs/03` requires rest day to be — `daily.html` caught it — and it stretched
"today's program slots" to mean something it does not. Incidental daily movement sits more
honestly with the things that keep the body going than with the prescription.
**Confidence:** guessed — the doc does not place them, and either home is arguable.
**Needs Cory:** yes, but trivially. If steps belongs under TRAIN, the section list at the
top of `today.js` is a one-line change, and rest day's primacy would then need re-solving.

## 2026-09-04 — Phase 4.5 A: the glyphs are Phosphor's idiom, not Phosphor's files
**Phase:** 4.5 A
**Decision:** Thirteen activity glyphs drawn by hand in `src/ui/icons.js`, matched to
Phosphor's proportions — even strokes on a 24 grid, round caps, geometry over illustration.
**Reasoning:** `docs/11 A` names the Phosphor set. The stack forbids dependencies, there is
no build step to subset an icon font, and a CDN would break the offline rule — so the
actual Phosphor files cannot ship. Copying its path data from memory would be worse than
drawing: it would claim to be Phosphor while being an approximation of it. Hand-drawn in
the same idiom is the honest version of the instruction.
**Confidence:** inferred
**Needs Cory:** no — but if the real set matters, vendoring the handful of SVGs used here
is small and legitimate, since Phosphor is MIT.

## 2026-09-04 — Phase 4.5 C: the logged row holds its place for one render
**Phase:** 4.5 C
**Decision:** The activity just logged stays in its section for the render immediately
after logging, then moves to the collapsed "worked" list on the next refresh.
**Reasoning:** Found by the acceptance harness, not by reading the code. Section C puts the
acknowledgement ON the row — the ring completing, the XP floating up — but logging moves
that row out of Outstanding in the same beat, so the row carrying the animation was gone
before it could play. The screen acknowledged a completion by making the evidence vanish,
which is the opposite of what C is for.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4.5 F1: duration is time under load, not wall clock
**Phase:** 4.5 F1
**Decision:** New pure module `src/domain/duration.js`. Set logs are grouped into
**sittings** — runs of sets no more than `session.sittingGapMinutes` apart — and each
sitting counts for its span plus `session.minutesPerSet` for the set that ends it. Both
constants live in `data/balance.json`. Gaps between sittings count for nothing.
**Reasoning:** This is the one Cory called out as mattering most, and the cause is exactly
as diagnosed: `docs/10` makes the slot the unit, so every slot completed in a day joins one
session record, and the gap between the first and last log measures the day rather than the
work. A five-minute session reported 2h 30m. It also fed `grit.hours` directly, so the day
was paid XP for the hours it spent not training.

Two details worth recording. The trailing `minutesPerSet` is not decoration: without it a
single-set sitting is zero minutes, and a slot completed on its own is the commonest shape
in the app. And the sitting boundary is exclusive — a gap exactly at the threshold stays one
sitting — because rest between heavy triples is genuinely long and an inclusive boundary
would split one visit into two.

Fixing it exposed a second bug at both call sites: the session screen and `completeSlot`
were both keeping the object they *sent* to `logSet` rather than the record that came back,
so the settled sets carried no `completedAt` at all. Time under load would have measured
nothing. That is now the written record in both places.
**Confidence:** specified (the rule) and inferred (the two constants)
**Needs Cory:** no — but 45 minutes and 2 minutes per set are guesses at your training, and
they are one line each in `balance.json`.

## 2026-09-04 — Phase 4.5 F2: only the first set cascades
**Phase:** 4.5 F2
**Decision:** Editing set 1's weight or reps fills every later unlogged set of that
exercise. Editing any other set changes only that set. Logged sets are never touched.
**Reasoning:** `docs/11 F2` specifies the first set and the protection of logged ones. The
restriction to set 1 is the part worth stating: set 1 means "this is what I am doing today",
where an edit to set 3 is a correction to set 3. Rewriting logged sets would falsify history
and, worse, the volume the XP was already computed from.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.5: Today runs a tighter rhythm than the other screens
**Phase:** 4.5 A–D
**Decision:** `.screen--today` uses a 12px gap and 8px block gaps against the app's 20px;
rows are 44px, their height set by the 44px action button and no vertical padding.
**Reasoning:** Phase 4's one-view rule — the whole outstanding day fits a 6.1" phone
without scrolling — is a hard acceptance criterion, and tiles plus three section headings
cost height. First build came to 1196px against an 844px budget. Every value above was
trimmed to pay for the structure docs/11 asks for, and nothing else was allowed to give:
the tile stays 32px as specified, and the action button stays 44px because that is the
minimum honest touch target. Today is the only screen with a height budget, so it is the
only screen whose rhythm was tightened.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4.5: two acceptance assertions had quietly stopped meaning anything
**Phase:** 4.5
**Decision:** Rewrote two checks in `task-model.html` rather than deleting or pinning them.
**Reasoning:** Both were found by this phase breaking them, and neither was really testing
what it claimed.

The first read the border colour of `.task__mark` and compared it to one hex — the old
vitality red. The redesign removed that element, but the deeper problem was that the hex no
longer existed anywhere in the palette, so the check could not have failed whatever the UI
did. It now states the rule instead: nothing in an outstanding row may be red-dominant,
judged by both other channels being far below red so that Might's lantern gold keeps
passing.

The second asserted the version string contained `(5)`. That needs editing every phase, and
an edit that can only ever be made to agree with what the code already says tests nothing.
It now checks the shape — that a phase is named at all.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Phase 4.5 D: a session records what it paid
**Phase:** 4.5 D
**Decision:** Sessions gained an optional `xpBySource`, written when the session settles.
`CURRENT_SCHEMA_VERSION` 3 -> 4 with a migration that transforms nothing.
**Reasoning:** The summary strip has to show what moved today, and the day log only records
what the day's own activities paid — a lifting day would have shown an empty strip. The
alternative was re-deriving today's session awards from history, which would quietly
disagree with the XP the person was actually given, because awards depend on records and
context at the moment of finishing. Recording what was paid is the same reasoning that
already governs `dayLogs.awarded`. A version 3 session carries no record and counts as
nothing, which is the truthful answer for a session finished before the app kept it.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-04 — Version bumped to 0.7.0 (4.5)
**Phase:** 4.5
**Decision:** `src/version.js` carries `0.7.0 (4.5)`, up from main's `0.6.0 (5)`.
**Reasoning:** A new phase, so the minor moves; the parenthetical names the phase as the
convention requires, even though 4.5 was built after 5. The cache key derives from this and
the whole surface changed, so an installed phone must not keep the old one.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-04 — Phase 4.5 F3: a piecewise activity is never finished for the day
**Phase:** 4.5 F3
**Decision:** Quick-add buttons and a typed-amount field stay on the row after it has been
logged, rather than leaving with it.
**Reasoning:** Found by the acceptance harness. Logging any water at all moves the row out
of Outstanding — Phase 4's rule, which `daily.html` enforces — and the first `+8` therefore
took the buttons off screen with it. You could log one glass a day and no more without
going hunting. The row still leaves the outstanding list, as required; it keeps its
controls, because "arrives in pieces" means there is always another piece.

**What this does not yet do: correct a total downwards.** The field adds, because the
activity's spec says `mode: 'add'` and the daily service has no way to override that per
call. Typing 23 adds 23 ounces; it cannot say "actually the day's total is 40". `docs/11 F3`
asks for "a manual field for correction", and this is the adding half of it.
**Confidence:** inferred
**Needs Cory:** yes — small, and worth knowing about. Correcting downwards needs either a
"set to" mode on the daily service or an edit control on the worked row. Neither is hard;
neither is in this phase.

## 2026-09-05 — F3 revised: the field corrects, the buttons accumulate
**Phase:** 4.5 F3 (revision)
**Decision:** `applyActivity` takes a per-entry `options.mode` that overrides the
activity's own mode; `daily.log` threads it through. The typed field on any activity that
also offers quick-add sends `{mode: 'set'}`, so it makes the day's total what you typed.
The quick-add buttons keep the spec's `add`. The logged row's field gained a real confirm
button.
**Reasoning:** Cory corrected my earlier reading, and the correction is right. I had shipped
a "manual field for correction" that could only add, which makes a mistyped entry
*uncorrectable*: every attempt to fix 400 ounces makes it larger. That contradicts the
Phase 4 high-water ledger, where `dayLogs.awarded` keeps XP already paid and a correction
therefore costs nothing in either direction. An app that cannot take a number back is
punishing a typo, which non-negotiable 4 forbids as plainly as it forbids losing a level.

The override is per call rather than per activity because both behaviours are correct for
the same activity at the same moment: the buttons mean "another glass", the field means
"the day's total is this". One mode could not express both.

Applied to every add-mode activity with a field, not just water — read, study, meditate,
instrument and mobility all have quick-adds and all had the same trap.

Two things worth recording beyond the ask. `'set'` and the spec's own `'replace'` both mean
the same thing and are both accepted, because anything that is not `add` replaces; a second
vocabulary for one behaviour would be a trap of its own. And the logged row's field had no
confirm button at all — only Enter committed it, which on a numeric keypad is a field you
can type into but not submit. The acceptance harness found that, not review.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — Phase 6: the battle pays gold, and the XP line is a switch at zero
**Phase:** 6
**Decision:** The battle awards gold and, occasionally, an item. `balance.battle.xpPerEnemy`
is **0** as shipped. The mechanism that would pay attribute XP is built, wired and tested;
only the number is zero.
**Reasoning:** `docs/06` says "gold and a small XP contribution" and `docs/07` lists XP among
the rewards, so the mechanism belongs here. But paying attribute XP for the battle would
pay twice for the same training — the battle is a *readout* of work already scored — and it
compounds: XP buys a stronger hero, which clears more, which buys more XP. `CLAUDE.md`'s
one-line version is that nothing is awarded for ticking a box that could be awarded for
doing the work, and the battle costs no interaction at all, so it is not even a box.

Which attribute it would feed is also unspecified, and any answer breaks non-negotiable 3:
there is no one-sentence justification for a gauntlet raising Might rather than Grit.

So the simplest defensible version, per the "never invent product philosophy" rule: build
it, set it to zero, and leave the decision where it belongs. Non-negotiable 7 makes this
the right shape — balance lives in config, so turning it on is a data edit and needs no
code. A test asserts both halves: that nothing is paid at the shipped value, and that
setting it to 3 in config alone would pay it.
**Confidence:** inferred — the mechanism is specified, the value is my judgement.
**Needs Cory:** yes. One number in `data/balance.json`. If you want it on, say what it
should feed and I will make the mapping legible rather than arbitrary.

## 2026-09-05 — Phase 6: difficulty tracks the character, because ~80% at every rank asks it to
**Phase:** 6
**Decision:** The gauntlet's composition comes from rank — slimes at F, wyrms at S — and its
strength is then fitted to the character by searching for the multiplier at which the day's
matchup is survived about `clearRateTarget` of the time.
**Reasoning:** Two attempts failed before this one, both measured rather than guessed.

Scaling by rank alone gave 0% clear from rank D upward: rank is a seven-step function of
levels, the roster's tiers are a five-step function of rank, and two coarse staircases
against smooth character growth produce cliffs. Fitting to a health margin instead gave
100% everywhere, then 45% at one level and 97% at the next from the same setting — the
translation from "health left over" to "win rate" runs through the combat loop and is
wildly non-linear.

Fitting against the clear rate itself is stable: 74–90% across every level from 0 to 20,
centred on the 80% `docs/06` asks for. It is mild rubber-banding, which is what "roughly an
80% clear rate **at every rank**" specifies — a constant challenge is the stated goal. What
still grows visibly is *who* you fight, which is the reward for a year of training.

One consequence worth stating: "a stronger character clears more of the gauntlet" is now
false by design, and the test that asserted it has been rewritten to assert what is true.
**Confidence:** specified (the target) and inferred (the method)
**Needs Cory:** no

## 2026-09-05 — Phase 6: damage varies per hit, or a new character has no battle at all
**Phase:** 6
**Decision:** Every blow rolls within `battle.damageVariance` (0.22) of its nominal damage.
**Reasoning:** Found while tuning. Crit was the only source of variance, and crit comes from
Mind — so a character with Mind 0 had none, and every day resolved identically. Two
identical days are not a battle, they are a screensaver, and the 80% target is meaningless
without a distribution to take 80% of. The roll comes from the same seeded generator, so
determinism is untouched.
**Confidence:** inferred
**Needs Cory:** no

## 2026-09-05 — Phase 6: no sprites were invented
**Phase:** 6
**Decision:** The battle screen uses the app's existing icon and colour vocabulary. A `foe`
glyph was added to the icon set in the same geometric idiom as the rest; no hero sprite, no
enemy sprites, no item icons were drawn.
**Reasoning:** `docs/06` names sprites as the entire art requirement of the product, and
`CLAUDE.md` non-negotiable 8 says no illustration is required to ship and that decorative
art must not be invented. Those agree: the screen is built so sprites can drop into places
that already exist, and it reads without them in the meantime. Recorded so the absence is
understood as a decision rather than an omission.
**Confidence:** specified
**Needs Cory:** yes, eventually — this is the one thing the product genuinely needs drawn.

## 2026-09-05 — Phase 6: a unit test that could not fail, caught by the browser
**Phase:** 6
**Decision:** Strengthened `src/app/battle.test.js` to count the purse rather than the
battle records.
**Reasoning:** Sabotaging the service so it regenerated the day on every request left all
ten service tests green while the browser harness went red — the battle is keyed by date, so
a regenerating bug overwrites its own record and the count stays at one. What actually goes
wrong is that the day is *paid for* twice. Recording it because the lesson generalises: a
test that counts rows is not testing an effect that is measured in something else.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — Version bumped to 0.8.0 (6)
**Phase:** 6
**Decision:** `src/version.js` carries `0.8.0 (6)`, built 2026-09-05.
**Reasoning:** A new phase, so the minor moves and the parenthetical names it.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — The one-view rule and docs/11's structure do not both fit the largest day
**Phase:** 4.5 / 6 (found while verifying)
**Decision:** Trimmed Today's rhythm as far as it goes without breaking a floor, which fits
every program day except the largest. Reporting rather than shaving further.
**Reasoning:** Phase 4 requires the whole outstanding day to fit a 6.1" phone without
scrolling. `docs/11` adds a 32px tile to every row and three section headings. Measured on a
390×844 screen, with the twelve rows of a seven-slot day, the screen now comes to 839px —
five pixels of headroom. A row costs 46px, so the eight-slot day (Upper Specialization,
eight slots plus five daily activities) overflows by roughly 41px.

Everything that could give has given: the screen runs a tighter rhythm than the rest of the
app, the two footer toggles share one line instead of taking a row each, and the title is a
step smaller here than elsewhere. What has *not* given is the 44px touch target or the 32px
tile — the first is the minimum honest target for a thumb mid-set, the second is what
`docs/11 A` specifies, and shaving either to win 41px would be trading a real property for a
number.

Worth noting how this surfaced: the failure appeared on its own overnight, because the
program day is chosen by weekday and Saturday prescribes seven slots where Friday prescribed
six. `daily.html` had also pinned "six slots" as a constant, which is a property of whichever
day the suite happens to run on; that assertion now derives the count from the program.
**Confidence:** measured
**Needs Cory:** yes — three ways out, all yours to pick. Let the largest day scroll
(the rule bends). Drop the section headings when a day is large (the structure bends).
Or split a day of eight into two program days (the program bends). I did not choose,
because each trades away something a different document calls non-negotiable.

## 2026-09-05 — Reset and update check live in a service, not in the screen
**Phase:** 6 (maintenance)
**Decision:** New `src/app/maintenance.js`. It owns the typed-phrase check, the backup, the
shell teardown and the version stash; every platform API it needs — service workers, the
cache store, `deleteDatabase`, session storage, `location.reload` — arrives through an
injectable `platform` so the whole thing is testable in node against fakes.
**Reasoning:** Cory's framing is right that these are conveniences now and safety features
later, and the safety half is what decided the shape.

**The typed phrase is checked in the service, not the screen.** A confirmation that lives
only in the UI is one the next screen forgets, and the button that erases everything should
refuse on its own terms whatever a caller believes. A test asserts that calling it with no
confirmation at all is refused; sabotaging the check turns two tests red.

**The backup is offered before the erase, and the order is asserted**, because after the
reset there is nothing left to export. It reuses the export format `docs/02` already
defines rather than inventing a second one.

**Everything the platform offers is allowed to be missing.** This is the code path out of a
broken state, so it must not require a good one: a browser with no cache API, no service
worker, or a private window refusing session storage still resets. That was not true when
first written — the platform wrapper was careful but `clearShell` trusted it, and a fake
that threw took the whole reset down. The teardown now defends itself.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — The update check reports both sides of the reload
**Phase:** 6 (maintenance)
**Decision:** The version is parked in session storage before the reload; Settings reads it
once on arrival and says either "Updated — was X, now Y" or "No change — still X".
**Reasoning:** Cory asked for the version before and after, and the "no change" case is the
one that carries the value: installed to a home screen there is no address bar and no reload
button, so without it there is no way to tell a build that failed to deploy from one that
deployed and did not fix the problem. Silence answers neither.

Said once, then forgotten — the service clears its own record on the first read. Getting
that right needed the screen split into `refresh` (arriving) and `load` (redrawing), because
the first version kept the notice in a closure variable that was only ever set, so it
persisted for the life of the screen and a second visit still showed a stale answer. Found
by the harness, not by reading.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — The Settings daily-list chips had been unstyled for a phase
**Phase:** 6 (found while verifying)
**Decision:** Restored `.marks`/`.mark` chip styles, scoped through `.marks` so Today's
`.row.mark` — which is a row, not a chip — is untouched.
**Reasoning:** Phase 4.5 rebuilt Today by replacing the CSS block those rules lived in, and
Settings still renders chips. Every test stayed green: nothing asserts what the daily list
looks like, and the harnesses that touch it use data attributes. It shipped in Phase 4.5 and
Phase 6 as grey boxes with a giant plus.

It was found by screenshotting Settings while checking something else, which is exactly the
case `CLAUDE.md`'s "some bugs are only visible to an eye" rule was added for. Worth
recording as evidence that the rule earns its place: two phases of green assertions did not
see it, and one screenshot did.
**Confidence:** specified
**Needs Cory:** no

## 2026-09-05 — Version bumped to 0.8.1 (6)
**Phase:** 6 (maintenance)
**Decision:** `src/version.js` carries `0.8.1 (6)`.
**Reasoning:** A patch on top of Phase 6 rather than a new phase. It also gives the update
check something true to report on the first deploy that carries it.
**Confidence:** specified
**Needs Cory:** no
