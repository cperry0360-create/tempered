# 04 — Design system

Dark tactical. No illustration is required to ship. The look comes from typography,
restraint and one accent colour per attribute.

## Why this direction

A tracker is read at a glance, in a gym, one-handed, often mid-set. Density and
legibility beat atmosphere. It also needs no commissioned art, which removes the
project's largest risk.

Flavour lives in **language**, not decoration: attribute names, tier titles, directives,
the battle log. "Might reached Formidable" carries the fantasy without a single drawing.

## Type

Two faces. No others.

- **Display** — a condensed geometric sans for numbers, levels, headings.
  Suggested: Chakra Petch, Rajdhani, or Barlow Condensed. Pick one and never mix.
- **UI** — Inter, or the system stack.

Scale, five steps only: `11 / 13 / 15 / 20 / 32`.
Numbers are always tabular. A weight that shifts as it changes is unreadable.

## Spacing

A 4px rhythm: `4 / 8 / 12 / 20 / 32 / 52`. No other values.

## Colour

```
--bg          #0a0c10   near black, slightly cool
--surface     #12151c   cards
--surface-2   #1a1f28   raised
--line        rgba(255,255,255,.08)
--text        #e6eaf2
--text-2      rgba(230,234,242,.60)
--text-3      rgba(230,234,242,.34)
```

One accent per attribute, used only for that attribute:

```
--might       #f0803c   orange
--wind        #4fc9a0   green
--grit        #d8b23c   amber
--vitality    #e05a6a   red
--mind        #7b7bf0   violet
```

Plus `--good #4fc9a0`, `--warn #e0a94a`, `--bad #e05a6a` for state.

**Rules.** Accent colour is used for exactly one thing on a screen at a time. Never two
accents competing. Backgrounds stay neutral; colour identifies attributes only.

## Components

- **Cards** are flat surfaces with a hairline, never bevels or gradients.
- **Progress bars** are 4px, square, full width, with the value as text beside them.
- **Numbers lead.** The number is the largest thing in any stat block, the label is the
  smallest.
- **One primary action per screen**, full width at the bottom.
- **No emoji anywhere.** Use a consistent icon set or nothing.

## Motion

Fast and functional. 120ms for state, 220ms for screen transitions, 400ms maximum for
the level-up moment which is the only place celebration is warranted.

Respect `prefers-reduced-motion` everywhere.

## The battle is the exception

The daily battle may be more theatrical than the rest of the app: pixel sprites,
floating numbers, a victory flourish. It is thirty seconds a day and it is where the
game lives. Do not let that treatment leak into the tracker.

## Art required to ship

Almost none.

- An app icon
- A small set of interface icons
- Enemy and hero sprites for the battle only

Everything else is type, colour and space. **Do not generate decorative art.** If a
screen looks empty, the fix is spacing and hierarchy, not illustration.
