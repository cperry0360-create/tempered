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
