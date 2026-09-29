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
3. **Next session card:** session name as Title (`Pull A`), meta line
   `Week 4 of 8 · 6 exercises · ~55 min`, full-width ember `Start session`. If today's
   training is done, the card reads `Pull A done · 52 min · 23 sets` with a secondary
   `View summary` button and no ember button.
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
    Notes, Rest timer, Cable/machine settings, Move up, Move down, Remove. Remove the
    horizontal chip row and the up/down arrow buttons.
  - Optional coaching line, one line, footnote: `Hit 10 reps at 115 before adding weight.`
  - Remove the exercise photo thumbnail, the `LAST` pill, and the `PR` pill from the block.
- **Set table:** column header row (footnote, `--text-3`): `Set`, `Previous`, `lbs`,
  `Reps`, check icon.
  - Row height 52px. Columns: Set 36px, Previous flex, lbs 76px, Reps 60px, Check 44px.
  - `Previous` shows `115 × 6` in `--text-3`; tapping it copies into the inputs.
  - Inputs are `--surface-2`, 10px radius, 17px semibold tabular. Empty inputs show the
    previous values as **placeholders in `--text-3`**, visibly dimmer than entered values.
    `inputmode="decimal"` for weight, `inputmode="numeric"` for reps.
  - Check is a 28px outline circle in a 44px target. Tapping it logs the set, using the
    placeholder values if inputs are empty. Completed rows get `--success-tint` background
    and a filled green check. No other markers on the row.
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

### Progress (`src/ui/screens/history.js`, `src/ui/progress-dashboard-runtime.js`)

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
  check using placeholder values.
- **R4 Train and Fuel.** Section 5 Train and Fuel. *Done when:* Fuel capture matches mockup
  screen 3 and the ring is empty with 0 kcal logged.
- **R5 Progress and sweep.** Section 5 Progress. Then a sweep of every other screen
  (Settings, Setup, Program Builder, Summary, sheets) for tokens, sentence case, and
  explanation copy longer than one sentence. *Done when:* Progress capture matches mockup
  screen 4 and every screen passes the section 1 and 2 rules.
