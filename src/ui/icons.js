/**
 * One icon set, drawn as inline SVG at `currentColor`.
 *
 * `docs/04-design-system.md` asks for pill buttons carrying "a small icon and a
 * label", and a circular FAB whose whole content is an icon. There is no build
 * step and no sprite pipeline, so these are hand-written paths on a 24×24 grid:
 * no network request, no font, and they inherit colour from the control they sit
 * in, which is what makes the acid states work without a second copy of each
 * asset.
 *
 * Stroked line art, never emoji — CLAUDE.md's stack rules and the design
 * system's "a consistent icon set or nothing" both land in the same place.
 */

const NS = 'http://www.w3.org/2000/svg'

/** name -> [shape, ...args][]  — 'p' is a path, 'c' a circle. */
const SHAPES = {
  check: [['p', 'M4.5 12.5 9.5 18 19.5 6.5']],
  plus: [['p', 'M12 5v14M5 12h14']],
  minus: [['p', 'M5 12h14']],
  up: [['p', 'M12 19V5M5.5 11.5 12 5l6.5 6.5']],
  down: [['p', 'M12 5v14M5.5 12.5 12 19l6.5-6.5']],
  play: [['fill', 'M8 5.2v13.6L19 12z']],
  swap: [['p', 'M4 8.5h13M13.5 5 17 8.5 13.5 12M20 15.5H7M10.5 12 7 15.5 10.5 19']],
  history: [
    ['p', 'M4.2 12a7.8 7.8 0 1 0 2.4-5.6'],
    ['p', 'M3.5 4.5V9H8'],
    ['p', 'M12 8v4.3l2.8 1.7'],
  ],
  rest: [['c', 12, 12.8, 7.6], ['p', 'M12 8.6v4.4l2.8 1.7M9.6 3h4.8']],
  sets: [['p', 'M4 7h16M4 12h16M4 17h9']],
  equipment: [
    ['p', 'M4 8h3M11 8h9M4 16h9M17 16h3'],
    ['c', 9, 8, 2],
    ['c', 15, 16, 2],
  ],
}

/**
 * @param {keyof SHAPES|string} name
 * @returns {SVGElement}
 */
export function icon(name) {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  for (const [kind, ...args] of SHAPES[name] ?? []) {
    if (kind === 'c') {
      const circle = document.createElementNS(NS, 'circle')
      circle.setAttribute('cx', String(args[0]))
      circle.setAttribute('cy', String(args[1]))
      circle.setAttribute('r', String(args[2]))
      svg.append(circle)
    } else {
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', String(args[0]))
      // A solid glyph — the play triangle — is filled rather than stroked.
      if (kind === 'fill') path.setAttribute('style', 'fill:currentColor;stroke:none')
      svg.append(path)
    }
  }
  return svg
}
