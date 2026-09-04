# 04 — Design system

**Superseded.** The previous version specified a muted, restrained, hairline-and-space
system. Built faithfully, it produced something too flat to read in a gym. The reference
Cory chose is the opposite: black ground, one loud acid accent, heavy type, generous
cards. This document is rewritten to that.

---

## The reference

> **Colour superseded by `docs/11-structure-and-feel.md` E (Phase 4.5).** The black
> ground and the five old attribute colours are gone: the scheme is now derived from
> `art/source/bg-night-forest.jpg`, Cory's own artwork. Everything else in this document
> — type, surfaces as a concept, the acid budget, the component rules — still stands.
> The table below is kept only so a reader can see what changed.

| Role | Was (Phase 3.7) | Now (Phase 4.5) |
|---|---|---|
| Page ground | `#1c1c1e` | a vertical gradient, `#0b1e31` to `#0f1b30`, lit to `#237494` at 55% |
| Card surface | `#2f2f2f` | `#16324a` |
| Raised surface | `#413f40` | `#1d4260` |
| Deep well / active field | `#000000` | `#0c1c2e` |
| Primary accent (acid) | `#edfe73` | `#edfe73` — unchanged |
| Secondary accent (blue) | `#8db2dd` | `#8db2dd` — unchanged |
| Text primary | `#ffffff` | `#ffffff` |
| Text secondary | `#c7c7c5` | `#c7c7c5` |

## Colour rules

**One accent carries the app: `#edfe73`.** Acid lime. It is loud on purpose. It marks
exactly three things and nothing else:

1. The single primary action on screen (the FAB, the confirm)
2. The active state — the column being logged, the current set
3. A value worth noticing — a PR, a max, a live counter

If more than roughly 5% of a screen is acid, it has stopped meaning anything. It reads
better on blue than it did on grey, and the budget is unchanged.

**`#8db2dd` is the only other accent**, for secondary numeric data that must be
distinguishable from primary values without competing — effort percentages, prescribed
versus actual.

**The five attribute colours identify attributes wherever an item belongs to one.**

`docs/11 A` lifted the old restriction confining them to Character and the post-session
readout. A coloured tile is what makes a list of a dozen daily items scannable: you find
sleep by its violet, not by reading six labels. The two colour systems do different jobs
and do not compete — attribute colour says *what this is*, acid says *what to do*.

They are re-derived from the artwork so the palette is one family:

| Attribute | Token | Source in the art | On `--surface` |
|---|---|---|---|
| Might | `#d2a44d` | lantern and window light | 5.76:1 |
| Wind | `#3ba4b5` | moon glow, drifting wisps | 4.51:1 |
| Grit | `#6f9db5` | the stone path | 4.51:1 |
| Vitality | `#4ba88a` | foliage | 4.57:1 |
| Mind | `#a190ba` | mushroom caps | 4.54:1 |

**Each is its sampled colour raised in HSL lightness — hue and saturation held — until it
clears 4.5:1 as text on a card and 3:1 for a `--canopy` glyph sitting on it as a tile
fill.** This is not optional polish. Unlifted, four of the five failed: foliage green read
at 2.15:1 and would have been unreadable as a number. `docs/11 E` names the raw sampled
values; these are those values made legible, and `test/browser/structure-and-feel.html`
asserts the ratios rather than trusting them.

## Surfaces

Three levels, no more. The gradient ground, `#16324a` cards, `#0c1c2e` for input wells and
the active field. Cards are `--r-lg` (16px) or larger and generously padded. **No hairline
borders between rows** — separation comes from the surface step and from space.

**The backdrop sits behind all of it**, fixed and anchored to the bottom, at 15% with a
2.5px blur. It is decoration and never a surface: the gradient underneath carries the
scheme on its own, so the app looks right if the image never loads. Content cards stay
opaque enough to hold text at AA against `--surface`, and the backdrop never rises to a
brightness that competes with a number on screen.

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
