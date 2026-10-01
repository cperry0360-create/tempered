# 13 — Redesign V1 (approved)

**Status:** Approved by Cory, 2026-09-29. This is an approved product requirement under
`docs/PRODUCT-TEAM.md`. Implement it without asking for further approval.

**Visual reference:** `docs/mockups/redesign-v1.png` (four screens: Today, Active workout,
Fuel, Progress). Match its layout, hierarchy, and density. Where this document and the
image disagree, this document wins.

**Supersedes:** CLAUDE.md non-negotiable 8 (visual language), `docs/04-design-system.md`
(colour, type, surfaces), the colour and background sections of
`docs/11-structure-and-feel.md`, and the "warm amber and lifted teal" note in
`docs/CURRENT-STATE.md`. Domain logic, storage, data model, and product rules 1 to 7 and
9 are unchanged.

---

## 0. Why the last attempt failed. Do not repeat it.

Release 0.37 added `src/slate.css`, a 49-line override loaded last with 20 `!important`
rules. It recoloured the old layouts and hid companion elements with `display:none`. The
screens still have the old structure: duplicated cards, all-caps micro labels, gear on
every screen, explanation copy, dashboards of equal tiles.

Rules for this redesign:

1. **Do not add another override stylesheet.** Do not add new `!important` rules. Change
   the real styles and the real markup.
2. **Layout changes happen in the screen modules** (`src/ui/screens/*.js`, `src/ui/app.js`),
   not by hiding elements with CSS.
3. **Do not hide features with `display:none`.** If a feature moves, move its markup. If a
   feature is removed from a screen, remove the code that renders it there.
4. **Finish each phase with screenshots** from `tools/capture-release-screens.js` at both
   viewports. Put each capture next to the matching mockup screen and list every visible
   difference before committing. A phase is not done while a listed difference remains
   unexplained.

---

## 0.1 Feature preservation (added after R3, overrides the mockup)

The mockup shows layout and visual hierarchy only. **It is not a feature list.** Where the
mockup leaves something out, the existing feature stays.

1. A redesign phase must not remove any working feature, data field, or behaviour unless
   this document names that specific feature for removal.
2. Before changing a screen, inventory its features from the last pre-redesign version of
   the file (`git show d9850f5:<path>`) and write the list into `DECISIONS.md`. After the
   change, confirm each item still works, and say where it now lives.
3. If a feature does not fit the new layout, move it into the ⋯ menu, a detail view, or a
   one-line footnote. Do not delete it. If you truly cannot place it, keep it and add it to
   "Needs Cory".
4. Behaviour beats appearance. Speed of logging and correctness of what is logged matter
   more than matching the mockup pixel for pixel.

## 1. Design tokens

Create `src/tokens.css`, loaded first in `index.html`. Every colour in every stylesheet
must reference these variables. After Phase R1, no hex colour appears in any `src/*.css`
file except `tokens.css` (art-specific files may keep hex values that belong to artwork;
list any exceptions in `DECISIONS.md`).

| Token | Value | Use |
|---|---|---|
| `--bg` | `#1F252C` | Screen background |
| `--surface-1` | `#2A323B` | Cards |
| `--surface-2` | `#36404B` | Inputs, raised rows, ring and bar tracks, chips |
| `--surface-3` | `#414C58` | Sheets, rest bar, pressed states |
| `--hairline` | `#4A5562` | Dividers, 1px borders |
| `--tabbar` | `#1A1F25` | Tab bar background |
| `--text-1` | `#F4F6F8` | Primary text |
| `--text-2` | `#C2CAD2` | Secondary text |
| `--text-3` | `#A9B3BD` | Tertiary text, placeholders, inactive tab |
| `--accent` | `#E8833A` | Ember. Primary button, active tab, PR badge, highlighted chart value, Finish |
| `--on-accent` | `#15191D` | Text on ember |
| `--success` | `#4FB286` | Completed set row, positive delta only |
| `--success-tint` | `rgba(79,178,134,0.14)` | Completed set row background |
| `--warning` | `#E0B04A` | Stale data notice only |
| `--danger` | `#E5484D` | Discard, delete |
| `--chart` | `#7A8592` | All chart series, sparklines, non-highlighted bars |

Colour rules:

- One accent. Ember appears on at most one filled button per screen.
- No teal, aqua, blue, purple, gold, or lime anywhere. Remove them, do not remap them.
- Green means only "done" or "went up in a good direction". Weight change is neutral
  (`--text-2`) because the app does not know the goal direction.
- No gradients on surfaces, bars, or text. No glow, no text-shadow, no box-shadow, no
  backdrop blur, no translucent cards.
- **No scenic or painted background anywhere behind UI.** Remove `body::before` background
  art and the inline background style in `index.html`.

## 1.1 Colour revision (R7, approved 30 Sep, supersedes the section 1 values it names)

Cory found the single-accent grey too flat. Each part of the app now owns one colour, used
on its icons, bars, rings, chart lines, and its one tinted card. Text and other card
backgrounds stay neutral. There is no fourth colour; habits use green because they are
about completion.

Surfaces (slightly blue slate) and text, replacing the section 1 values:

| Token | Value |
|---|---|
| `--bg` | `#1B222C` |
| `--surface-1` | `#242D39` |
| `--surface-2` | `#2F3A48` |
| `--surface-3` | `#3A4656` |
| `--hairline` | `#445164` |
| `--tabbar` | `#161C24` |
| `--text-1` | `#F3F6FA` |
| `--text-2` | `#BCC7D4` |
| `--text-3` | `#A2AEBD` |

Domain colours (new tokens):

| Token | Value | Owns |
|---|---|---|
| `--train` | `#E8833A` (same as `--accent`) | Workout card, Start buttons, set progress, PR badges, Weekly sets current bar, rest bar, Finish, active tab, This week dots |
| `--train-muted` | `#8A5A3A` | Weekly sets earlier bars |
| `--fuel` | `#4FB286` (same as `--success`) | Calorie ring, kcal and protein bars, water bar, `Log a meal` button fill on Fuel, Daily log progress bars and checks, completed set rows |
| `--recovery` | `#5FA8E8` | Readiness deltas, sleep, resting HR, HRV and respiration sparklines, recovery card in Progress |

Rules:

- **Tinted cards, two only:** the Today Workout card uses `--train` at 12% over
  `--surface-1` with a 1px `--train` border at 40%. The Readiness card uses `--recovery` at
  8% with a 1px `--recovery` border at 35%. Every other card is plain `--surface-1`.
- Each screen still has at most one filled primary button. On Fuel it is green (`--fuel`
  fill, `--on-accent` text); elsewhere ember.
- Daily log: icons `--text-2`, progress bars and checks `--fuel`, quick-add pills
  `--surface-2` with `--text-1` text.
- Weight and steps sparklines stay neutral `--chart`; weight deltas stay `--text-2`.
- No violet, teal, gold, or any other hue. No gradients, glow, or shadows.
- Reference image: `docs/mockups/redesign-v1-today-r7.png` (ignore its companion strip,
  which R8 removes).

## 1.2 Light mode and theme setting (R7, approved 30 Sep)

**Setting:** Settings gets an `Appearance` row with three choices: `System` (default,
follows the iPhone's light/dark setting), `Light`, `Dark`. Store the choice in local
settings through the storage adapter. Apply it immediately by setting
`data-theme="light"` or `"dark"` on `<html>`; for `System`, follow
`prefers-color-scheme` and update live when the phone switches.

**How:** light mode is a token swap only. Every colour already comes from `tokens.css`, so
define the light values under `:root[data-theme="light"]` and change nothing else. If a
screen looks wrong in light mode, the fix is a missing token, never a per-screen override.

**Fill versus ink:** domain colours are bright enough for fills (buttons, bars, rings,
tinted cards) in both modes, but too light for text and thin lines on a white background.
Add `-ink` tokens and use them for any domain-coloured text, icon, sparkline, or 1-2px
line. In dark mode each `-ink` equals its fill colour.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#1B222C` | `#F3F5F8` |
| `--surface-1` | `#242D39` | `#FFFFFF` |
| `--surface-2` | `#2F3A48` | `#EBEFF4` |
| `--surface-3` | `#3A4656` | `#DFE5EC` |
| `--hairline` | `#445164` | `#D3DAE3` |
| `--tabbar` | `#161C24` | `#FFFFFF` |
| `--text-1` | `#F3F6FA` | `#141A22` |
| `--text-2` | `#BCC7D4` | `#4A5563` |
| `--text-3` | `#A2AEBD` | `#5F6B7A` |
| `--train` (fill) | `#E8833A` | `#E8833A` |
| `--train-ink` | `#E8833A` | `#A04E0C` |
| `--train-muted` | `#8A5A3A` | `#EDC7A6` |
| `--fuel` (fill) | `#4FB286` | `#4FB286` |
| `--fuel-ink` | `#4FB286` | `#1F7A55` |
| `--recovery` (fill) | `#5FA8E8` | `#5FA8E8` |
| `--recovery-ink` | `#5FA8E8` | `#2B6CB0` |
| `--on-accent` | `#15191D` | `#15191D` |
| `--chart` | `#7A8592` | `#9AA5B2` |

All text pairs above pass 4.5:1 on their surfaces. Tinted cards keep the same percentages
in light mode. Completed set rows use `--fuel` at 14% in both modes.

**iOS status bar:** `index.html` uses `apple-mobile-web-app-status-bar-style` =
`black-translucent`, which keeps the status bar text white. In light mode that text would
be invisible on `#F3F5F8`. Find a fix that keeps the clock and battery readable in both
modes on an installed iPhone web app (for example, a dark-tinted strip behind the status
bar in light mode only), and flag in "Needs Cory" if no clean option exists. Update
`<meta name="theme-color">` to match the active theme.

## 2. Type

- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`.
  Remove any condensed or display font.
- `font-variant-numeric: tabular-nums` on all numbers.
- **Sentence case everywhere**, including tab labels (`Today`, `Train`, `Fuel`, `Progress`),
  buttons, headings, and eyebrows. Remove `text-transform: uppercase` and letter-spacing
  above `0.02em` from all stylesheets. Uppercase is allowed only for one-or-two character
  labels: `PR`, `W`, `D`, `F`.

| Style | Size / line height | Weight |
|---|---|---|
| Large title (screen title) | 34 / 41 | 700 |
| Title (card hero) | 22 / 28 | 600 |
| Headline (card title, exercise name, button) | 17 / 22 | 600 |
| Body, inputs | 17 / 22 | 400 |
| Subhead (secondary lines) | 15 / 20 | 400 |
| Footnote (targets, meta) | 13 / 18 | 400 |
| Caption (chart axes) | 12 / 16 | 500 |
| Tab label | 11 / 13 | 500 |
| Big number | 28 to 34 / 1.1 | 600 |

Minimum text size anywhere: 11px (tab labels only). Everything else 12px or more.

## 3. Layout and shape

- 4pt spacing grid. Screen side gutter 16px. Card padding 16px. 16px gap between cards.
- Radius: cards 16px, inner rows and inputs 10px, buttons and chips full pill.
- Primary button: full width, 52px tall, ember fill, `--on-accent` text, 17px semibold.
- Secondary button: `--surface-2` fill, `--text-1` text, same shape.
- Tap targets at least 44 x 44.
- Safe areas: `viewport-fit=cover`; header padded with `env(safe-area-inset-top)`, tab bar
  and rest bar padded with `env(safe-area-inset-bottom)`.
- Line icons only, 1.5px stroke, `--text-3`; active tab icon and label in `--accent`.

## 4. Shell

- Tab bar: four tabs, `Today`, `Train`, `Fuel`, `Progress`, sentence case, icons above
  labels, solid `--tabbar` background, hairline top border.
- **Remove the floating play button (`.fab`) code**, not just its display. While a workout
  is active and minimized, show a 56px dock directly above the tab bar: `Pull A · 23:14`
  on the left, `Resume` secondary pill on the right.
- **Settings gear appears only on Today**, top right. Remove the settings access button
  from every other screen.

## 5. Screens

### Today (`src/ui/screens/today.js`)

Top to bottom. Nothing else on this screen.

1. **Header row:** companion chip on the left (32px companion avatar from existing art +
   `Tank · Lv 10` using the real name and level), gear on the right. Tapping the chip opens
   the existing Companion screen.
2. **Title:** `Today` (large title), date line `Tuesday, 29 Sep` (subhead, `--text-2`).
3. **Workout card (amended R6, restores the pre-R2 rollover behaviour).** Cory's favourite
   feature: unfinished movements roll forward through the program week, and any single
   movement can be logged on its own between calls. The card is driven by the existing
   `buildDailyWorkoutQueue(await workout.weekStatus(), clock.today())` and
   `remainingProgramDay()` in `src/ui/today-workout.js`. Render it natively in `today.js`;
   do not bring back the MutationObserver enhancer.
   - Title: today's program day (`Pull A`). Meta line from the queue, for example
     `4 today · 2 from earlier this week` or `Week 4 of 8 · 6 exercises · ~55 min` when
     nothing has rolled over.
   - **Movement rows** for today's unfinished slots, 52px each: movement name, `1 / 3 sets`
     in `--text-2`, and a `Log sets` (or `Continue` if started) secondary pill. Tapping a row
     opens that single movement as a slot session (`app.startSession({ slotTask })`), the
     between-call path. Sets logged there count toward the program day exactly as before.
   - **From earlier this week:** a collapsible group below today's rows, header
     `2 movements from earlier this week`, open by default when fewer than 6. Each row adds
     `From Mon` in `--text-3`. Same tap behaviour.
   - Completed movements collapse into one row at the bottom: `3 done` with a green check,
     expandable.
   - Full-width ember `Start full session` opens `remainingProgramDay()` (today's day plus
     its unfinished slots).
   - When everything today and earlier this week is done, the card reads
     `Pull A done · 52 min · 23 sets` with a secondary `View summary` and no ember button.
   - Train's next-session card shows the same rollover count in its meta line.
4. **Readiness card:** three columns: Sleep, Resting HR, HRV (big number + label, small
   delta vs 7-day average under it). If there is no data for today, the whole card is one
   line: `No recovery data today` plus a text button `Import from Health`. Never show a
   grid of dashes.
5. **This week card:** one meta line `2 sessions · 41 sets · 118 min` and seven dots
   labelled M T W T F S S for the **calendar week (Monday start)**. Filled ember = trained
   that day. Today = ember outline ring. Future and untrained = `--hairline` ring. The
   numbers in the meta line must be the same calendar week as the dots.
6. **Fuel card:** `0 / 2,100 kcal` with a thin bar, `0 / 135 g protein` with a thin bar,
   and a 44px `+` button that opens meal logging.
7. **Daily log card:** the existing habit rows (Alcohol-free day, Water, Body, Mobility,
   Read, Meditate, and any others). Each row is 52px: icon, name, one-line status in
   `--text-2`, one quick action on the right (for example `+5 min`) as a `--surface-2`
   pill. Completed rows show a green check and move to the bottom. Keep all existing
   behaviour, only the presentation changes.

Remove from Today: the duplicated Active Program card, "This week at a glance" tile grid,
"Workout control center", readiness explanation paragraph (put it behind an info button on
the Readiness card), "Import recovery data" circle, AI progress check button (moves to
Progress), "Weekly goals", "Log something else" (move into the Daily log card as a final
text row `+ Log something else`).

### Active workout (`src/ui/screens/session.js`)

The most important screen. Speed between sets is the metric.

- **Header, sticky, 56px:** `Cancel` (text, `--text-2`, left), centre `Pull A` over elapsed
  `23:14` (footnote), `Finish` (ember text, right). Remove "Minimize · keep workout open"
  bar; minimizing happens from the ⋯ menu or by switching tabs, and the dock appears.
- **Exercise block (card):**
  - Line 1: short exercise name, Headline, one line, ellipsis. Use a display name like
    `Lat Pulldown · Wide`; derive it from the existing name by moving the parenthetical
    into a `·` suffix and dropping the equipment word when it duplicates the name.
  - Line 2: `4 × 6-10 · Rest 2:00` (footnote, `--text-2`). Tapping the rest value edits it.
  - Right: 44px ⋯ button. The menu holds every existing per-exercise action: History, Swap,
    Method, Plate settings, Cable/machine settings, Notes, Rest timer, Move up, Move down,
    Remove. Remove the horizontal chip row and the up/down arrow buttons.
  - **Exercise photo (amended R3.1):** a 56px square thumbnail, 10px radius, to the left of
    lines 1 and 2, for every exercise that has art. Tapping it opens the full image panel,
    as before R3. The photo is kept; the mockup omitted it by mistake.
  - Line 3, footnote, `--text-2`: `Best 125 lb × 8 · 17 Sep` when a record exists.
  - **Coaching line:** the progression proposal's reason when one exists
    (`entry.proposal.reason`, for example `Every set hit 12. Proposing 130 lb and back to 8.`).
    Only fall back to slot cue text when there is no proposal. Never replace the proposal
    reason with generic text.
- **Set table:** column header row (footnote, `--text-3`): `Set`, `Previous`, `lbs`,
  `Reps`, check icon.
  - Row height 52px. Columns: Set 36px, Previous flex, lbs 76px, Reps 60px, Check 44px.
  - `Previous` shows last session's set (`115 × 6`) in `--text-3`; tapping it copies those
    values into the inputs.
  - **Inputs are prefilled with the prescribed values (amended R3.1).** Each unlogged row's
    inputs hold the real values from `prepared.proposal.sets` (the progression engine's
    target, for example 130 × 8), as they did before R3. They are real input values, not
    placeholders, at `--text-1`. Last session's numbers appear only in the Previous column.
    Editing the first set's weight or reps still cascades to later unlogged sets.
    `inputmode="decimal"` for weight, `inputmode="numeric"` for reps. Inputs are
    `--surface-2`, 10px radius, 17px semibold tabular.
  - Check is a 28px outline circle in a 44px target. **One tap logs exactly the values
    shown in the inputs** (the prescription unless the user edited them). Completed rows
    get `--success-tint` background and a filled green check.
  - **Plate calculator (amended R3.1):** for barbell exercises, the next unlogged row shows
    a compact line directly under it: `Per side: 45 · 10 · 2.5 · 45 lb bar`, footnote,
    `--text-2`, updating as the weight changes. Same solver and plate settings as before R3.
    Logged rows do not show it.
  - Tapping the set number opens set type: Working, Warm-up (W), Drop (D), Failure (F).
  - Swipe left on a row to delete it.
  - Beating the best e1RM shows a small ember `PR` pill in place of the Previous text.
  - `+ Add set` as a 44px text row under the table.
- **Rest bar:** after each check, a sticky bar above the home indicator on `--surface-3`:
  `Rest 1:47` (Title size) with a thin ember progress line, and pills `-15`, `+15`, `Skip`.
  Compute remaining time from a stored end timestamp so it survives the screen sleeping.
- Target density on a 430px-wide viewport: one full 4-set exercise plus the start of the
  next visible at once.
- The discard confirmation sheet appears only when leaving with unlogged edits.

### Train (`src/ui/screens/train.js`)

1. Title `Train`.
2. Program header card: `November Physique Sprint` (Title), `Week 4 of 8 · Deload week 8`
   (subhead), a 8-segment progress bar (4 filled ember), and a `Program details` row with a
   chevron that opens the description and Program Builder entry.
3. Next session card: name, meta line, **secondary** `Start session` button (Today owns the
   ember button).
4. Sessions list, one card: rows of `Push A` / `6 exercises · Last 26 Sep` / chevron.
5. Training history calendar and "Training rhythm" move behind a `Training rhythm` row at
   the bottom that opens its own view. Remove "This week" slot bars, "Workout control
   center", the stats tile grid, the AI button, and the duplicated Active Program block.
6. Routines: keep as a card section `Routines` with plain rows (name, `7 exercises · 19
   sets`, chevron). Starting a routine happens from its detail view.

### Fuel (`src/ui/screens/fuel.js` and nutrition views)

1. Title `Fuel`. No eyebrow, no subtitle paragraph.
2. Energy card: a ring (track `--surface-2`, arc `--accent`, arc length = kcal eaten / goal;
   **empty when nothing is logged**), centre `2,100` Big number and `kcal left`. Under it
   `Protein 0 / 135 g` with a thin bar. Then one row of three small stats: Carbs, Fat,
   Fiber. Then full-width ember `Log a meal`. Remove the "No meals yet" box and the
   `Open today` pill.
3. Recent card: quick-log rows from existing recents, `Greek yogurt + berries · 220 kcal`
   with a `+` on the right.
4. Water card: `0 / 120 oz`, thin bar, three secondary pills `+8`, `+12`, `+25`.
5. Remove the Recovery card from Fuel (recovery lives on Today and Progress). Remove any
   companion content from Fuel.

### Progress (`src/ui/screens/history.js`)

1. Title `Progress`, range picker `30D` as a small pill menu (7D, 30D, 90D) top right.
2. Segmented control: `Overview`, `Lifts`, `Habits`, `Log`.
3. **Overview:** `Weekly sets` bar chart, last 8 weeks, bars `--chart`, current week
   `--accent` with its value above it, first and last week labels under the axis. Then
   `Recent PRs` card (rows only, no PR pill). Then `Trends` card: Weight, Steps, Sleep rows
   with value, delta, and a `--chart` sparkline. Then `Recovery` card with the four signals
   only if data exists. Then a text row `Copy progress report for ChatGPT` (the existing AI
   progress check, moved here). Remove the headline tonnage number, "no prior comparison
   yet" chips, the stat tile grid, and the customizable dashboard tiles.
4. **Lifts:** rows of exercise name, e1RM, 30D delta, `--chart` sparkline. Tap opens detail.
5. **Habits:** existing habit percentages as rows (name, `13 of 25 days`, percentage,
   thin `--chart` bar with `--success` fill). Streak text on one line.
6. **Log:** existing training day rows; move "Adjust minutes" into the row's detail view.

### Companion (retired in R8, Cory's decision 30 Sep)

Cory never used the companion during testing and wants it gone. R8 removes it from every
user-facing surface: the Today chip or strip, the Companion screen and its route, the
workout summary payoff, setup and onboarding mentions, Settings, and any copy that refers
to it. Today starts with the title row and then the Workout card.

- Remove the UI code and its stylesheet rules. Do not just hide them.
- **Do not delete or migrate stored data.** Companion records in IndexedDB stay untouched so
  old local data loads without errors. Domain code in `src/domain/companion-*.js` and
  `src/app/companion-care.js` may stay unreferenced with its tests, like the legacy
  Character/Battle code.
- Update CLAUDE.md: the one-line version, non-negotiables 1 and 3, and "What this is NOT"
  so they no longer describe a companion. Tempered is a tracker with no reward character.
  Update `docs/CURRENT-STATE.md` the same way.
- The exercise photos in the active workout are now the only images in the app.

---

## 6. Phases

Each phase: one commit, phase number in the message, screenshots reviewed against the
mockup (see section 0 rule 4), `docs/CURRENT-STATE.md` updated, any guess logged in
`DECISIONS.md` under "Needs Cory". Update UI tests that assert old copy or old structure;
do not weaken tests of logging, persistence, or domain logic.

- **R1 Foundation.** Update CLAUDE.md rule 8 to point to this document. Mark the superseded
  docs. Add `tokens.css`. Delete `slate.css` and the inline background style. Replace every
  colour in every stylesheet with tokens. Remove uppercase and wide letter-spacing. Remove
  scenic backgrounds, shadows, blur, translucency. Type stack and scale. Tab bar labels and
  icons. Remove `.fab` code, add the active workout dock. Gear on Today only.
  *Done when:* `grep -rE "#[0-9a-fA-F]{3,8}\b" src/*.css` finds only `tokens.css` and
  documented art exceptions; `grep -r "uppercase" src/` finds nothing; no `!important` was
  added; screenshots show no background art on any screen.
- **R2 Today.** Section 5 Today. *Done when:* the Today capture matches mockup screen 1 in
  order and content, and the Daily log card holds all habit rows.
- **R3 Active workout.** Section 5 Active workout. *Done when:* the session capture matches
  mockup screen 2; `tools/verify-logging-speed.js` passes and logs a set with one tap on the
  check using the prescribed values shown in the inputs.
- **R3.1 Session feature restore.** Apply section 0.1 to the active workout and the amended
  section 5 Active workout: prescribed values prefilled and logged by one tap, proposal
  reason as the coaching line, photo thumbnail and full image panel, in-row plate calculator,
  best-set line. Then audit the R2 and R4 diffs (`git diff d9850f5 HEAD -- src/ui/screens/`)
  for any other removed feature and restore it under section 0.1 rule 3.
  *Done when:* a browser test proves one tap on the check logs the prescription (for example
  130 × 8 when last session was 125 × 12) and fails if it logs last session's values; a
  barbell exercise shows the per-side plate line under its next unlogged row; every exercise
  with art shows its thumbnail and opens the full image; the feature inventory for Today,
  Active workout, Train, and Fuel is in `DECISIONS.md` with each item marked kept and where.
- **R4 Train and Fuel.** Section 5 Train and Fuel. *Done when:* Fuel capture matches mockup
  screen 3 and the ring is empty with 0 kcal logged.
- **R5 Progress and sweep.** Section 5 Progress. Then a sweep of every other screen
  (Settings, Setup, Program Builder, Summary, sheets) for tokens, sentence case, and
  explanation copy longer than one sentence. *Done when:* Progress capture matches mockup
  screen 4 and every screen passes the section 1 and 2 rules.
- **R6 Rollover restore and device fixes** (from Cory's iPhone recording, 30 Sep).
  1. **Rollover:** restore the Today workout card per amended section 5 Today item 3. R2
     disconnected `installDailyWorkoutEnhancer` and the R3.1 audit missed it.
  2. **Dead space at the bottom of every tab screen:** on the installed iPhone PWA the tab
     bar sits roughly 50pt above the home-indicator area with an empty band under it. The
     tab bar background must run to the physical bottom edge, with only
     `env(safe-area-inset-bottom)` of padding under the labels. Find the real cause (likely
     candidates: safe-area inset applied twice, `100vh` versus `100dvh` on html/body/app,
     iOS standalone viewport height, or legacy tab bar rules in `style.css` and `calm.css`
     that still offset `bottom`). Consolidate to one `.tabbar` rule. Page bottom padding
     must equal tab bar height plus 16px, no more.
  3. **Dead space at the top of the active workout:** the session header sits about 60pt
     below the status bar. Apply the top safe-area inset once.
  4. **Weekly sets chart is broken:** earlier weeks render as thin slivers along the top and
     only the current week renders as a bar. Bars must share one baseline at the bottom,
     heights proportional to each week's sets on a zero-based scale, value label above the
     current week only. Remove the orphan line under the chart (`Micro cardio · 6 min`).
  5. **Trends deltas:** show a delta only when both periods have at least 3 samples;
     otherwise show nothing. A `-4,471` steps delta from 2 samples is noise.
  6. **Display name bug:** `Standing Calf Raise · Standi...`. Never repeat the base name in
     the suffix; if the suffix only restates the name, drop it.
  7. **Readiness labels** use the short forms from the spec: `Sleep`, `Resting HR`, `HRV`,
     so they fit on one line.
  *Done when:* a browser test seeds a program week where Monday's day has 2 unfinished
  slots and proves that on Wednesday Today lists them under "from earlier this week", that
  tapping one opens a single-movement session, and that logging all its sets removes it from
  the list (prove the test fails with the card removed); screenshots at both viewports show
  the tab bar flush to the bottom and the session header directly under the status bar; and
  the Weekly sets chart renders 8 bottom-aligned bars from seeded data. Ask Cory to confirm
  the bottom spacing on his phone, since the simulator may not reproduce it.
- **R7 Colour revision.** Apply section 1.1 in `tokens.css` and wherever colours are used
  on Today, Train, the active workout, Fuel, and Progress. Section 0.1 still applies: no
  feature, row, or behaviour changes in this phase.
  Also apply section 1.2: the light theme tokens, `-ink` tokens, and the Appearance setting.
  *Done when:* `grep -rE "#[0-9a-fA-F]{3,8}\b" src/*.css` still finds only `tokens.css`; CI
  captures show the Today Workout card ember-tinted and the Readiness card blue-tinted, the
  Fuel ring and bars green, recovery sparklines blue, and no violet anywhere; the capture
  matrix includes every core screen in both Light and Dark, and a browser test proves the
  Appearance choice persists across reloads and that System follows `prefers-color-scheme`.
- **R8 Retire the companion.** Apply the "Companion (retired in R8)" section.
  *Done when:* `grep -rniE "companion|tank" src/ui index.html` finds no user-facing
  reference (comments explaining retained data are allowed); a browser test loads a
  profile that has companion data and proves every tab and a full workout, including the
  summary, render without errors; CLAUDE.md and CURRENT-STATE no longer describe a
  companion.
- **R9 Rollover and Today fixes** (found by Claude's browser probe of the R6 build, 30 Sep).
  1. **"Week [object Object] of 8":** whenever nothing has rolled over, the Workout card meta
     prints `[object Object]`. `weekStatus()` spreads the active program and then overwrites
     `week` with the `weekTasks()` object, so `weekProgram.week` is not a number. Read the
     program week number from the active state (or rename one of the two fields) and fix
     the `week === 1` guidance check that has the same bug.
  2. **Leftovers disappear on Sunday:** `buildDailyWorkoutQueue` orders days with Sunday as
     index 0, so on Sunday every earlier program day (Mon to Sat) counts as "later" and the
     rollover list is empty. Order days Monday-first so Sunday sees the whole week's
     leftovers. The list still resets the following Monday.
  3. **Today goes stale if the app stays open overnight:** `realToday` is captured once when
     the Today screen is created. After midnight, `refresh()` moves `selectedDate` forward
     but `isRealToday()` still compares with yesterday, so the Workout card shows
     "Workout details are available for today." Recompute the real date on every refresh,
     and refresh Today when the app becomes visible again (`visibilitychange`) if the date
     has changed.
  4. **Today done, leftovers waiting:** the card currently shows today's day name with
     `0 today · 2 from earlier this week`, and the ember button opens a different day.
     Instead: title `Minimal Legs + Abs done`, meta `2 left from earlier this week`, and the
     button names what it opens: `Finish Push A`.
  *Done when:* a browser test proves each item: meta shows `Week 2 of 8` with no rollover;
  a fresh launch on Sunday lists Monday's unfinished movements and a fresh launch the next
  Monday does not; with the clock moved past midnight and the app made visible again, Today
  shows the new date's workout; and the done-plus-leftovers card shows the wording above.
  Prove each check fails on the current code first.
- **R10 Sub-screens, Today density, and device fixes** (Cory's recording, 1 Oct).
  1. **Today Workout card is too tall.** With 8 today and 3 leftovers it fills two screens.
     Collapsed by default: title, meta (`8 today · 3 from earlier this week`), one
     `Next up` row (the first unfinished movement, leftovers first), a row
     `Show all 11 movements` that expands the full today and leftover lists inline, then
     `Start full session`. Remember expanded or collapsed for the rest of the day.
  2. **Calendar buried in Train.** Move the Training rhythm current-week strip (dates,
     filled training days, today ring) directly under the program header card on Train,
     with `3 weeks strong · 2 / 3 days` as its meta line. Tapping it opens the full Training
     rhythm history. Remove the `Training rhythm` row at the bottom. Fix the clipped
     `urrent week` label.
  3. **Import from Health sheet** is pinned to the bottom, neither full screen nor floating,
     with an empty stray input under the text box. Make it a full-screen view like Nutrition:
     header with back chevron and `Import health data`; three numbered steps
     (1 `Copy prompt and open ChatGPT`, 2 paste box, 3 `Review and import`). Remove the stray
     input. The paste box and button must stay visible above the keyboard.
  4. **Sub-screens are still grey and use the old look.** Apply sections 1.1 and 1.2 to every
     pushed view, not only the four tabs: Nutrition (green: macro values, `Add meal` primary
     green button, quick-log `Add`, Day status as a two-option segmented control; replace the
     outlined stat tiles with plain `--surface-2` tiles), Training rhythm and Program details
     (ember), Log day detail (ember), Health import (blue), Settings (neutral with ember
     selection). No outlined boxes anywhere; surfaces separate by fill.
  5. **Progress trend lines are grey.** Colour every sparkline and line chart by domain:
     lifts and training `--train-ink`, sleep and recovery `--recovery-ink`, weight and steps
     `--fuel-ink`. This supersedes the "weight and steps stay neutral" rule in section 1.1.
     Deltas: up in a good direction `--fuel-ink`, otherwise `--text-2`.
  6. **Lifts tab:** label the number (`e1RM 94.7 lb`), show the 30D change
     (`+4.2 lb`), and remove the stray `—` before each sparkline.
  7. **Log tab:** name each day by what was trained (`Pull A`, or `Micro sets · 3 movements`)
     instead of `Training day`; merge multiple sessions on the same date into one row; the
     detail view's back control is a chevron `‹ Log`, not a pill; in the detail, group sets
     by exercise (`Front Squat · 45 × 6, 45 × 6, 45 × 6`) instead of one line per set.
  8. **Habits tab:** drop `0 day streak`; show `Best 11 days` only, plus the current streak
     when it is above zero (non-negotiable 4). Label or remove the unlabeled row of dots under
     the last habit.
  9. **Nutrition Add meal:** the time field overflows the right edge of its card.
  *Done when:* CI captures in both themes show every pushed view using tokens and domain
  colour with no outlined tiles; a browser test proves the Today card is collapsed by
  default with one Next up row and expands to all rows; the Train capture shows the week
  strip under the program header; and Cory confirms the Health import view on his phone.
- **R11 Training score.** A weekly 0-100 score that answers "am I improving as a lifter?",
  with a grade and a 12-week trend. Domain logic in `src/domain/training-score.js`, pure and
  test-first, with fixtures for an improving block, a stalled block, a deload week, a missed
  week, and a brand-new user.
  - **Progression, 35%:** for each lift with at least 3 sessions in the last 6 weeks, compare
    best e1RM over the last 2 weeks with the 4 weeks before. Up (or more reps at the same
    load) = 1, holding within 1% = 0.6, down = 0. Component = average.
  - **Plan adherence, 30%:** prescribed working sets completed this week / prescribed
    (capped at 100%), 70%; working sets that reached the bottom of their rep range, 30%.
    Leftovers finished later in the week count.
  - **Consistency, 25%:** qualifying training days this week versus the program's planned
    days (existing 30-minute rule), 70%; weeks meeting that target in the last 4, 30%.
  - **Volume trend, 10%:** hard sets this week versus the 4-week average; 95% or more = full
    credit, scaled down below that.
  - **Deload weeks** skip Progression and Volume trend and reweight the rest. Lifts with too
    little history are left out, not scored as zero. Weeks before tracking began are not
    shown.
  - **Grade:** 90+ A, 80-89 B, 70-79 C, 60-69 D, under 60 `Rebuild week` (no F; non-negotiable
    4). The current week shows as `so far`.
  - **UI:** first card on Progress Overview. Big score and grade (`82 · B`), change versus the
    4-week average (`+6`), a 12-week ember line of weekly scores, then four component rows
    with a thin bar and a one-line reason (`9 of 13 lifts up`, `31 of 34 planned sets`,
    `4 of 4 training days`, `55 sets vs 49 avg`). Tapping a row lists what drove it (which
    lifts went up, held, or dropped). Add the score and components to the existing
    `Copy progress report for ChatGPT` text.
  *Done when:* domain tests cover the five fixtures and prove the weights, deload reweighting,
  and cap; the Overview capture shows the card with real seeded history; every number on
  the card can be traced to a one-line reason (non-negotiable 3).
- **R12 Readable trend charts** (Cory, 1 Oct). Applies to every sparkline and line chart on
  Progress: Trends, Recovery, Lifts rows, and Lift detail. Do not colour segments by up or
  down; noise is not a trend, and "up" is good for some metrics and bad for others.
  1. **Raw versus trend:** daily readings render as small dots (or a 1px line at 35% opacity)
     in the row's domain colour; a 2px 7-day rolling average line in the full domain colour
     (`-ink` token) sits on top. Lifts use best e1RM per session as the reading and a
     3-session average as the trend.
  2. **Latest value:** a 5px filled dot on the last reading.
  3. **Change text replaces the sample count:** `↓ 1.2 lb over 30 days`, `↑ 4 ms`. It compares
     the trend line's first and last values in the selected range. Colour it `--fuel-ink`
     only when the direction is good for that metric, otherwise `--text-2`:
     resting HR down is good; HRV, sleep, steps, and e1RM up are good; weight, respiratory
     rate, and blood oxygen are neutral (always `--text-2`) unless the user has a weight goal,
     in which case moving toward it is good.
  4. **Normal range band (Recovery rows only):** a soft band of the user's 30-day mean ± 1
     standard deviation, `--recovery` at 12%, behind the line. If the latest reading is
     outside the band, the change text says so: `Above your usual range`.
  5. **Sparse data:** with fewer than 7 readings in range, show dots only, no trend line, and
     the change text reads `Not enough data for a trend`.
  6. **Size:** charts are 48pt tall and at least 120pt wide, with 4pt vertical padding so
     dots are not clipped.
  7. Keep the domain colours from R10 item 5. Both themes.
  Put the maths (rolling average, change, mean ± SD band, good-direction table) in
  `src/domain/trend.js`, pure and test-first.
  *Done when:* domain tests cover the rolling average, the change calculation, the band, the
  sparse-data rule, and the good-direction table (including resting HR down = good); CI
  captures of Progress Overview and Lifts in both themes show dots, trend line, end dot, and
  change text, with bands on Recovery rows.
- **R11.1 Training score corrections** (Cory, 1 Oct: "I hit nearly all my trainings"). The
  first build scored his training far below reality. Fix in `src/domain/training-score.js`,
  test-first, then the card.
  1. **Partial week judged against the whole week.** On Thursday, Plan adherence compared
     Mon-Wed work against all five days' prescribed sets (44 of 93), and Volume trend compared
     a partial week with full-week averages. The headline score and grade now come from the
     **last completed week**. The current week is shown below it as progress, not a grade:
     `This week: 44 of 47 sets due so far · on track`, where "due" counts program days
     scheduled before today plus any leftovers, and today's day only once its sets are
     logged. Volume for the current week is compared with the average pro-rated by elapsed
     days. Never grade an unfinished week.
  2. **Training day definition excluded micro-set days.** A day counted only with 30+ session
     minutes, but between-call micro sets produce many short sessions (`4 min · 35 sets`), so
     real training days failed. A training day now qualifies with **6 or more working sets,
     or 30+ total minutes**, summing every session that date. Apply the same rule wherever the
     30-minute rule is used for streaks and Training rhythm, and say so in its explanation.
  3. **Away weeks.** Add `Mark week as away` (in the score detail and in Training rhythm),
     stored through the storage adapter. Away weeks render as a gap in the trend line, are
     excluded from the 4-week average, the weeks-met-target count, and Volume baselines, and
     their consistency is not scored. An away week can be unmarked. Rest is part of the plan
     (non-negotiables 4 and 9).
  4. **Sets matched only by exact program slot.** Count a working set toward a slot when it
     is that slot's exercise or its recorded substitute (`substitutedFor`) in that program
     week, whether logged through a full session, a single-movement session, or an ad-hoc
     add, capped at the slot's prescribed sets. Program edits mid-week use the revision in
     force on the day the set was logged.
  5. Recompute all historical weeks with these rules.
  6. **Score explanation (`i` button).** A 44pt `i` button beside the `Training score`
     title opens a bottom sheet with a short narrative for the headline week, 3 to 4 plain
     sentences built from the component data by a pure function in the domain (template
     text, no AI, no network). Order: the score and grade; the component that helped most,
     with its reason; the component that held it back most, with its reason and the specific
     movements or days involved; one concrete next step. Example: `Last week scored 84, a B.
     Progression carried it: 11 of 13 lifts went up. Plan adherence held it back: you
     finished 78 of 93 planned sets, mostly Delts + Arms. Finishing this week's leftovers is
     the quickest way up.` Mention deload and away weeks when they apply. Follow
     non-negotiable 9 wording (no "failed", "missed", "crushed"); say "left" or "still to do".
     A second short paragraph explains how the score works in one sentence per component,
     with its weight. Close with `Done`.
  *Done when:* domain tests prove: a Thursday with Mon-Wed fully done reads "on track" and is
  not graded; a day of 20 working sets across eight 3-minute sessions qualifies; an away week
  is excluded from averages and targets; a swapped exercise counts toward its slot; and each
  test fails on the R11 code first; a domain test proves the narrative names the top and
  bottom components and their reasons for a fixture week, and uses none of the avoided words.
  Cory confirms the score matches how his weeks felt.
