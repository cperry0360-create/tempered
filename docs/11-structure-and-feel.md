# 11 — Structure and feel

Written after real use. The tracker works and reads clearly; it does not feel like an
app you want to come back to. Everything on Today has equal visual weight, so it reads
as a spreadsheet: rows of text with checkboxes, no sections, no hierarchy, nothing
distinguishing a heavy compound lift from a glass of water.

Six changes. Four are structural, one is a background, one is a set of bugs.

---

## A. Rows must differentiate themselves

Every item on Today is currently the same object: a label, maybe a field, a check. The
reference Cory chose solves this with **a coloured icon tile at the left of every row**,
a value pill, and a progress ring. The colour is what makes a list scannable — you find
sleep by its purple, not by reading six labels.

Every trackable item gets a **32px rounded icon tile** with:

- **A colour that identifies its attribute**, using the five attribute colours from
  `docs/04`. Might orange for lifts, Wind green for cardio and steps, Vitality red for
  sleep, water and food, Mind violet for reading and meditation, Grit amber for rest and
  consistency.
- **An icon** from the Phosphor set.

This is where the attribute colours earn their keep and it corrects the rule in `04`
that confined them to Character. **Revised: attribute colours identify attributes
wherever an item belongs to one.** The acid accent is still reserved for action, active
state, and values worth noticing — the two systems do different jobs and do not compete.

## B. Named sections — superseded by the cadence model

The original Phase 4.5 grouping was:

- **TRAIN** — today's program slots
- **RECOVER** — sleep, water, food, rest, body
- **SHARPEN** — reading, study, meditation, music

That grouping was later superseded when Today was rebuilt around **when work is due** rather
than which attribute family it belongs to. The shipped sections are now **DAILY** and
**THIS WEEK**, each with a completion count. OFF activities live behind LOG SOMETHING ELSE.
Attribute-coloured tiles from section A still carry the RPG meaning, so changing the
section architecture does not flatten the rows back into identical objects.

Sections C, D, E and F below are **not** superseded. Completion animation, the XP float,
summary strip, forest palette and incremental/correctable entry remain requirements.

## C. Something has to happen when you log

Nothing acknowledges a completion. That is the single biggest reason this does not feel
like an app worth opening.

On every logged item:

- The row's ring completes with a short spring
- The XP earned floats up briefly in the attribute's colour
- A haptic tick, if the device supports it

On section completion, the section heading gets a brief acid flash. On the day being
fully worked, one modest full-screen moment — not a modal to dismiss, just a beat.

Keep all of it under 400ms and respect `prefers-reduced-motion`. This is the one place
in the tracker where delight is the point.

## D. Progress must be visible before the list

The top of Today should answer "how is today going" before you read a single row. A
single summary strip: the day's XP so far, and five small attribute bars showing what
has moved today. It is the thing the Journal app puts a large ring at the top for.

---

## E. Background and colour scheme

Jet black is austere and joyless. The scheme is now derived from the night-forest
artwork, sampled directly from the file rather than estimated.

### Tokens

```css
/* ground — a vertical gradient, deep at both ends, lit through the middle */
--bg-0:        #0b1e31;   /* top of screen, night sky            */
--bg-1:        #133249;
--bg-2:        #1e5376;
--bg-3:        #237494;   /* the lit horizon, roughly 55% down   */
--bg-4:        #20394d;
--bg-5:        #0f1b30;   /* foot of screen                      */
--canopy:      #071524;   /* darkest frame — nav bar, scrims     */

/* surfaces */
--surface:     #16324a;   /* cards                               */
--surface-2:   #1d4260;   /* raised                              */
--well:        #0c1c2e;   /* input fields, deep wells            */
--stone:       #274257;   /* the path — dividers, inactive fills */

/* accents drawn from the art itself */
--lantern:     #d2a44d;   /* lantern and window light — warm     */
--wisp:        #3798a8;   /* moon glow and drifting wisps — cyan */
--moss:        #306c59;   /* foliage — green                     */
--cap:         #755e98;   /* mushroom caps — violet              */

/* the action accent survives unchanged */
--acid:        #edfe73;
```

### How they map

The five attribute colours are **re-derived from the art** so the palette is one
family rather than two systems bolted together:

| Attribute | Token | Source in the art |
|---|---|---|
| Might | `--lantern` `#d2a44d` | lantern and window light |
| Wind | `--wisp` `#3798a8` | moon glow, drifting wisps |
| Grit | `--stone` lifted to `#4a7890` | the stone path |
| Vitality | `--moss` `#306c59` | foliage |
| Mind | `--cap` `#755e98` | mushroom caps |

This replaces the orange/green/amber/red/violet set in `docs/04`. Same roles, colours
that belong to the world.

**Acid `#edfe73` stays the action accent** — the primary button, the active field, a
value worth noticing. It reads better on blue than it did on grey. Its budget rule is
unchanged.

### Using the image

The artwork is a **fixed backdrop**, not a scrolling one.

- Anchored to the bottom, `background-attachment: fixed`, covering the viewport
- **Dimmed to 12–18%** and blurred 2–3px, over the gradient ground
- Content cards stay opaque enough to hold text at WCAG AA against `--surface`
- Never at full brightness behind live content — it will fight every number on screen

The path and lanterns sit low, so they land under the tab bar, which is where the art
is busiest and the content is not.

The artwork's provenance is established as Cory's original work. The runtime copy in
`art/dist/bg-night-forest.jpg` is the canonical shipped asset; no provenance flag is
needed.

## F. Bugs and corrections

1. **Session duration is wrong.** A five-minute session reported 2h 30m. Under the
   micro-set model a session spans the day, so elapsed wall-clock is meaningless.
   **Report time under load** — the sum of logged set durations plus rest between sets
   within the same sitting — not the gap between first and last log. A session with two
   sittings hours apart is two sittings, not a two-hour session.

2. **Changing the first set should cascade.** Editing set 1's weight or reps fills the
   remaining unlogged sets of that exercise with the same values. Already-logged sets
   are never touched. This is the single biggest tap saving available.

3. **Water needs incremental entry.** Nobody knows their daily ounces; they drink a
   glass. Give quick-add buttons — `+8` `+12` `+16` — that accumulate, with the running
   total shown and a manual field that **sets/corrects the total**. Apply the same pattern
   to any activity that arrives in pieces.
