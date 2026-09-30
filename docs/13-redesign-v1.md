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

### Companion

- The companion is reached only from the Today chip. Restore any companion elements that
  `slate.css` hid; the companion screen keeps its existing art and features.
- Companion art is the only illustration in the app and appears only on the Companion
  screen and the workout summary.

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
