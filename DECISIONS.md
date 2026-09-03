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
**Needs Cory:** yes — which display face, and may I vendor its woff2 into the repo?

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
