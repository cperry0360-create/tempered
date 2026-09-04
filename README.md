# Tempered

A health and training tracker with an RPG progression layer. Real training data drives
character progression — a squat PR raises Might; ticking "I lifted" does not.

*Tempering* is strengthening metal through controlled stress **followed by rest**. That
is the whole product thesis: load and recovery, both rewarded, neither punished. The
word is used deliberately throughout the app and should not be replaced with generic
fitness language.

## For Claude Code

Read **`CLAUDE.md`** first. It is the contract and should be re-read at the start of
every session. Then follow **`docs/07-build-plan.md`** in order.

## Documents

| File | What it is |
|---|---|
| `CLAUDE.md` | Session contract. Non-negotiables, working rules, stack. |
| `docs/00-product.md` | Vision, loop, principles. |
| `docs/01-attributes-and-xp.md` | The XP engine. The heart of the app. |
| `docs/02-data-model.md` | Schemas and storage shape. |
| `docs/03-screens.md` | Every screen, specified. |
| `docs/04-design-system.md` | Type, colour, spacing, components. |
| `docs/05-workout-system.md` | Routines, sessions, progression rules. |
| `docs/06-battle.md` | The passive daily battle. |
| `docs/07-build-plan.md` | Phased plan with acceptance criteria. |
| `DECISIONS.md` | Claude's running log of anything not specified here. |

## Data

`data/` holds seed content and balance configuration as hand-editable JSON. Balance
constants live in `data/balance.json` and must never be hard-coded.

## Exercise art

The movement photographs in `art/exercises/` are not original work. Each one is two
frames — start and finish — of an exercise from the **[free-exercise-db][fedb]** archive
by yuhonas, released under the [Unlicense][unlicense] (a public domain dedication).
Tempered scales the two frames to a common height and joins them side by side; nothing
else about them is changed.

That archive inherited its imagery, by way of [wrkout/exercises.json][wrkout], from the
**[Everkinetic][everkinetic] open data project by Greg Priday**, which is licensed
**[CC BY-SA 4.0][ccbysa]**. Both downstream repositories relicensed the set as public
domain. Tempered does not rely on that: the images are attributed and shared alike as
though CC BY-SA 4.0 still bound them, which satisfies either reading. The images remain
under CC BY-SA 4.0; the rest of this repository does not.

`art/exercises/SOURCES.json` records the exact archive entry, revision and modification
behind every file, so any picture can be traced back to its origin.

[fedb]: https://github.com/yuhonas/free-exercise-db
[unlicense]: https://unlicense.org
[wrkout]: https://github.com/wrkout/exercises.json
[everkinetic]: https://github.com/everkinetic/data
[ccbysa]: https://creativecommons.org/licenses/by-sa/4.0/

## The backdrop

The night-forest artwork behind every screen — `art/source/bg-night-forest.jpg` — is
**Cory's own original work**, and the app's colour scheme is sampled from it: the ground
gradient, the card surfaces, and all five attribute colours. See
`docs/11-structure-and-feel.md` section E.

Unlike the exercise photographs, there is no third-party licence question here. It is
first-party art, and the palette derived from it is first-party too.

## Deployment

The live app is served by **Netlify**, from the repository root. There is no build step,
so what is committed is what is served — `netlify.toml` only names the publish directory
and sets cache headers.

### Connecting the site (one-time, needs Cory's Netlify account)

Claude cannot do this part: it needs a browser sign-in and authorisation of Netlify's
GitHub app against this account.

1. Netlify → **Add new site → Import an existing project → GitHub**, and authorise it for
   `cperry0360-create/tempered`.
2. Confirm the settings Netlify reads from `netlify.toml`: **branch `main`**, **build
   command empty**, **publish directory `.`**.
3. Deploy. Every push to `main` redeploys from then on.
4. Note the site URL. Netlify assigns something like `tempered-xyz.netlify.app`; rename it
   under **Site configuration → Site details → Change site name**.

### Making the repository private afterwards

Do this *after* the Netlify site is connected and has deployed once — Netlify keeps its
access through the authorised GitHub app, so private repositories continue to deploy.

1. GitHub → **Settings → General → Danger Zone → Change repository visibility → Private**.
2. Push a trivial commit and confirm Netlify still builds. If it does not, reconnect the
   repository under **Site configuration → Build & deploy → Repository**.
3. GitHub Pages stops serving at this point. That is expected: **Netlify is the live URL.**
   Under **Settings → Pages**, set the source to *None* so nothing points at a dead site.

### What going private does and does not change

Making the repository private stops the *source* from being redistributed — the images,
`SOURCES.json` and this README are no longer public.

It does **not** make the deployed site private. A Netlify site is reachable by anyone with
the URL, so the exercise images are still published, and the attribution that travels with
them is now in a README nobody can read. If the intent is to close the licensing question
rather than narrow it, one of these two closes it properly:

- **Password-protect the site** (Netlify → Site configuration → Access control), which
  makes it genuinely personal rather than merely unlisted; or
- **Carry the attribution inside the app**, as a line on the Settings screen, so it travels
  with the images wherever they are served.

Either is small. Neither is done yet — see `DECISIONS.md`.

## Status

Specification in progress. Not yet built.
