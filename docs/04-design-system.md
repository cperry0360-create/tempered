# 04 — Design system

**Superseded.** The previous version specified a muted, restrained, hairline-and-space
system. Built faithfully, it produced something too flat to read in a gym. The reference
Cory chose is the opposite: black ground, one loud acid accent, heavy type, generous
cards. This document is rewritten to that.

---

## The reference

Sampled directly from the chosen screenshot, not estimated.

| Role | Value |
|---|---|
| Page ground | `#1c1c1e` |
| Card surface | `#2f2f2f` |
| Deep well / active field | `#000000` |
| Raised surface | `#413f40` |
| Primary accent (acid) | `#edfe73` |
| Secondary accent (blue) | `#8db2dd` |
| Text primary | `#ffffff` |
| Text secondary | `#c7c7c5` |

## Colour rules

**One accent carries the app: `#edfe73`.** Acid lime. It is loud on purpose. It marks
exactly three things and nothing else:

1. The single primary action on screen (the FAB, the confirm)
2. The active state — the column being logged, the current set
3. A value worth noticing — a PR, a max, a live counter

If more than roughly 5% of a screen is acid, it has stopped meaning anything.

**`#8db2dd` is the only other accent**, for secondary numeric data that must be
distinguishable from primary values without competing — effort percentages, prescribed
versus actual.

**The five attribute colours from the old system survive**, but only on the Character
screen where attributes are the subject. They never appear in the tracker.

## Surfaces

Three levels, no more. `#1c1c1e` ground, `#2f2f2f` cards, `#000000` for input wells and
the active field. Cards are `--r-lg` (16px) or larger and generously padded. **No
hairline borders between rows** — separation comes from the surface step and from space.

## Type

Heavy, tight, large. The previous system's timidity was mostly a type failure.

- **Section headings are big, bold and uppercase** with tight tracking: `INCLINE DB`.
  Not a small grey label. 24–28px, weight 800, letter-spacing -0.01em.
- **Numbers are the largest thing in any row.** A weight is the content; `lb` is a
  footnote beside it at half the size and dimmed.
- Column labels are small, uppercase, `--text-3` — except the active column, which is
  acid.
- Tabular numerals everywhere a number can change.

Scale: `11 / 13 / 15 / 20 / 28 / 34`. Two more steps than before, because the old scale
had no room for a number to dominate.

## Components

**Set row.** Each field is its own rounded outlined cell, not a bare input. The active
row gets a filled olive tint plus a 4px acid bar down its left edge. Completed rows keep
full text brightness — dimming them is conventional and wrong here, because those
numbers are what you read to choose the next weight. The check control carries the state.

**Pill buttons.** Exercise actions — swap, history, edit sets, equipment — are full-round
grey pills with a small icon and a label, laid out in a horizontal scroller directly
under the exercise name. Not a menu. Not an overflow. Visible.

**The tab bar floats.** Inset from all three edges with a margin, over a blurred
translucent surface, safe-area respected. Never welded to the screen edge.

**Primary action is a circular acid FAB** at the bottom right of the floating bar, or a
full-width acid button where a bar would be wrong. One per screen.

**Exercise thumbnails** are rounded squares at the left of the name, roughly 3 lines
tall.

## Density

Cards breathe: `--s4` internal padding, `--s3` between rows. The old system's `--s1`
row rhythm produced mis-taps. Touch targets stay at 44px minimum.

## Motion

Unchanged: 120ms state, 220ms transitions, 400ms for the level-up moment only. Respect
`prefers-reduced-motion`.

## Acceptance

- Acid `#edfe73` appears on at most three distinct element roles per screen, and covers
  under 5% of the viewport. Assert it.
- Every set-row number meets WCAG AA against its cell.
- No hairline row separators anywhere in the tracker.
- The tab bar has a nonzero margin on left, right and bottom, plus the safe-area inset.
- Section headings compute to at least 24px and weight 700 or heavier.
- The largest text in a set row is a number, not a label.
