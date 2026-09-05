# Tempered — Phase 0 verification report

**Date:** 2026-09-03
**Commit:** `904f72a` — *Phase 0 — convert to a no-build stack*
**Branch:** `main`
**Verified on:** Node v22.22.2, Chromium 141.0.7390.37 (Linux)

---

## Summary

Phase 0 (Skeleton) is complete against two of its three acceptance criteria. The third
requires a physical iPhone and the live GitHub Pages URL, so it cannot be closed from a
build environment.

The phase was delivered twice. The first attempt used Vite + TypeScript + Vitest and
**shipped unverified** — the npm registry is unreachable from the build environment
(`x-deny-reason: host_not_allowed`), so no dependency could be installed and none of the
acceptance commands could be run. The stack was then changed to eliminate the toolchain
rather than work around it. Everything in the repository now runs with nothing but a
browser and the `node` binary.

| # | Criterion | Result |
|---|---|---|
| 1 | `index.html` opens in a browser with no build step | **Pass** (see caveat) |
| 2 | `node --test` runs and passes | **Pass** |
| 3 | Installs to an iPhone home screen from the Pages URL and opens offline | **Not verified — needs a device** |

---

## Criterion 1 — Opens in a browser with no build step

**Result: pass.** Loaded in Chromium 141 over HTTP. Every request returned 200, no 404s:

```
GET /                            200
GET /index.html                  200
GET /src/style.css               200
GET /manifest.webmanifest        200
GET /src/main.js                 200
GET /src/pwa/register.js         200
GET /sw.js                       200
GET /icons/icon-180.png          200
GET /icons/icon-512.png          200
GET /icons/icon-1024.png         200
```

`/sw.js` appearing in that log is the meaningful signal: it is only requested if
`main.js` executed, which means the ES module chain resolved and ran natively — no
bundler involved.

The same page was then served under a `/tempered/` subpath, matching the shape of the
real GitHub Pages project URL. All ten requests resolved correctly beneath that prefix,
confirming that the relative-path approach survives deployment.

### Caveat: ES modules do not work over `file://`

This was measured, not assumed. Opening `index.html` by double-clicking it **loads the
page but silently never runs the script**. The module fetch is treated as cross-origin
from an opaque `null` origin and is blocked. The identical page served over `http://`
runs correctly.

Service workers additionally require a secure context, which `file://` is not, so
offline support could not function there either.

This is a browser security rule, not a build step, and it applies to any bundler-free
project. **To open the app: serve the directory.** From the repository root:

```
python3 -m http.server
```

Then visit `http://localhost:8000/`. This is now documented in
`docs/07-build-plan.md` alongside the criterion.

---

## Criterion 2 — `node --test` runs and passes

**Result: pass.**

```
TAP version 13
# Subtest: every seed file in data/ parses as JSON
ok 1 - every seed file in data/ parses as JSON
# Subtest: balance.json is an object, not an array or scalar
ok 2 - balance.json is an object, not an array or scalar
1..2
# tests 2
# pass 2
# fail 0
EXIT CODE: 0
```

`node --check` also passes on all four JavaScript files in the repository
(`src/main.js`, `src/pwa/register.js`, `sw.js`, `test/seed-data.test.js`).

**Note on the test count.** `node --test` exits 0 even when it finds no test files at
all. A criterion of "runs and passes" would therefore have been satisfied by an empty
repository. Two real tests were added so the criterion proves something: that test
discovery works for this layout, and that the seed data in `data/` is well-formed.

---

## Criterion 3 — iPhone install and offline

**Result: not verified.** This needs a physical device against the deployed Pages URL
and cannot be closed from a build environment.

**The underlying mechanism was verified, however.** With the service worker installed
and **the HTTP server killed**, the page still rendered from the worker's cache in
Chromium. So offline serving works; what remains untested is iOS's home-screen
installer specifically.

> **Superseded (2026-09-04).** Hosting moved to Netlify so the repository can be
> private. Everything verified below still holds — the app is base-path agnostic, which
> is exactly what let it move — but the Pages instructions no longer apply. See
> "Deployment" in `README.md`.

**Remaining step:** set the GitHub Pages source to *Deploy from a branch: `main`,
`/(root)`*, then open the published URL on an iPhone, add it to the home screen, enable
airplane mode, and launch it.

---

## Judgement calls made during this phase

Three decisions worth a second opinion. All are recorded in full, with reasoning, in
`DECISIONS.md`.

**`art/dist/` is committed, not ignored.** This corrects an earlier mistake in the same
session. It had been gitignored as build output, but under root-serving Pages those
processed sprites are *deployed content* — `docs/08-art.md` specifies that the app loads
them at runtime, and what is not committed is not served. Left uncorrected, this would
have broken the battle screen in Phase 6.

**The service worker uses stale-while-revalidate, not cache-first.** Without a build
step there are no content-hashed filenames, so nothing busts the cache automatically.
Cache-first would pin users to old code until someone remembered to bump the `VERSION`
constant, and forgetting is the obvious failure mode. Stale-while-revalidate makes a
missed bump cost one stale load rather than a stuck app; a deliberate bump still forces
an immediate clean sweep of every old cache.

**Two specification documents were edited without being asked.**
`docs/02-data-model.md` and `docs/BALANCE-PROJECTION.md` both pointed at `.ts` files
that can no longer exist under the new stack. Left alone they would have misdirected
Phase 1. File paths only — no specified behaviour was changed.

---

## Repository state

```
.nojekyll            index.html            sw.js
jsconfig.json        manifest.webmanifest  icons/
src/  main.js  style.css  pwa/register.js
      domain/  adapters/{storage,health,clock}/  ui/
test/ seed-data.test.js
docs/ data/ art/
CLAUDE.md  README.md  DECISIONS.md  .gitignore
```

No `package.json`, no lockfile, no `node_modules`, no bundler, no CI workflow.

---

## Open items

1. **Set the Pages source** to *Deploy from a branch: `main`, `/(root)`*, then complete
   criterion 3 on a device.
2. **Delete the stale remote branch** `claude/restore-directory-structure-32b7uk`. It is
   fully merged into `main`. It could not be deleted from the build environment, which
   returns HTTP 403 on ref deletion.
3. **Choose a display typeface.** `docs/04-design-system.md` asks for a condensed
   geometric sans (Chakra Petch, Rajdhani, or Barlow Condensed). Loading it from a font
   CDN would break the offline and local-first rules, so it must be vendored into the
   repository as woff2. Until then `--font-display` aliases the system stack. This is
   flagged **Needs Cory** in `DECISIONS.md`.

**Phase 1 (the XP engine) has not been started**, per the build plan's rule that a phase
does not begin until the previous phase's criteria pass.
