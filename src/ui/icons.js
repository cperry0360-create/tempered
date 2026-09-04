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

  // --- one glyph per trackable thing, for the row tiles in docs/11 A -------
  //
  // Drawn here in the Phosphor idiom — even 1.75px strokes on a 24 grid, round
  // caps and joins, geometry over illustration — rather than pulled from the
  // Phosphor package. docs/11 A names that set, but the stack forbids a
  // dependency and there is no build step to subset one, so these are matched
  // to its proportions by hand. Recorded in DECISIONS.md.
  train: [
    ['p', 'M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5M6 12h12'],
  ],
  sleep: [
    ['p', 'M20 14.2A8.2 8.2 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2Z'],
  ],
  water: [
    ['p', 'M12 3.2c3.4 3.6 5.6 6.4 5.6 9.2a5.6 5.6 0 0 1-11.2 0c0-2.8 2.2-5.6 5.6-9.2Z'],
  ],
  food: [
    ['p', 'M6 3v7.5a2.2 2.2 0 0 0 4.4 0V3M8.2 12.7V21'],
    ['p', 'M17.2 3c-1.7 1.4-2.4 3.6-2.4 6.2 0 1.6.8 2.6 2.4 2.8V21'],
  ],
  protein: [
    ['c', 12, 12, 3.2],
    ['p', 'M12 4.2v2.6M12 17.2v2.6M4.2 12h2.6M17.2 12h2.6'],
  ],
  body: [
    ['p', 'M4.5 9.5h15l1.2 10.2a1.4 1.4 0 0 1-1.4 1.5H4.7a1.4 1.4 0 0 1-1.4-1.5Z'],
    ['p', 'M9 6.2a3 3 0 0 1 6 0'],
    ['p', 'M9.6 13.6h4.8'],
  ],
  steps: [
    ['p', 'M8.6 3.4c1.5 0 2.3 1.4 2.3 3.4 0 1.7-.5 2.8-.5 4.1 0 1.4-.7 2.1-1.9 2.1s-2-.7-2-2.1c0-1.3-.4-2.4-.4-4.1 0-2 .9-3.4 2.5-3.4Z'],
    ['p', 'M6.6 15.6c0 1.9.6 2.9 2 2.9s2-1 2-2.9'],
    ['p', 'M16.4 8.4c1.5 0 2.4 1.4 2.4 3.4 0 1.7-.5 2.8-.5 4.1 0 1.4-.7 2.1-1.9 2.1s-1.9-.7-1.9-2.1c0-1.3-.5-2.4-.5-4.1 0-2 .9-3.4 2.4-3.4Z'],
  ],
  mobility: [
    ['c', 12, 4.6, 1.9],
    ['p', 'M12 8v5.4M12 13.4 8.4 20M12 13.4 15.6 20M7.4 10.2 12 11.4l4.6-1.2'],
  ],
  read: [
    ['p', 'M12 7.2C10.4 5.6 8.2 5 4.8 5.2v12.4c3.4-.2 5.6.4 7.2 2 1.6-1.6 3.8-2.2 7.2-2V5.2c-3.4-.2-5.6.4-7.2 2Z'],
    ['p', 'M12 7.2v12.4'],
  ],
  study: [
    ['p', 'M12 4 2.8 8.4 12 12.8l9.2-4.4Z'],
    ['p', 'M6.4 10.4v5.2c0 1.5 2.5 2.8 5.6 2.8s5.6-1.3 5.6-2.8v-5.2'],
  ],
  meditate: [
    ['c', 12, 5, 2],
    ['p', 'M12 9.2v4.4M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6'],
    ['p', 'M4.4 16.4h2.2M17.4 16.4h2.2'],
  ],
  journal: [
    ['p', 'M4.8 4.6h9.4l5 5v9.8H4.8Z'],
    ['p', 'M14.2 4.6v5h5'],
    ['p', 'M8 13h8M8 16.2h5.4'],
  ],
  instrument: [
    ['p', 'M9.2 17.4V6.2l9.4-2v11.2'],
    ['c', 7, 17.6, 2.3],
    ['c', 16.4, 15.4, 2.3],
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

/**
 * Which glyph stands for which trackable thing.
 *
 * Kept here beside the shapes rather than in `data/activities.json`: an icon is
 * a presentation choice, and the seed data should not have to be re-released to
 * change one. An unknown id falls back to the check, which is honest — it still
 * says "this is a thing you log" without pretending to a meaning it lacks.
 *
 * @param {string} activityId
 */
export function iconForActivity(activityId) {
  const named = {
    rest_day: 'rest',
    sleep: 'sleep',
    water: 'water',
    nutrition_logged: 'food',
    protein_target: 'protein',
    body_metrics: 'body',
    steps: 'steps',
    mobility: 'mobility',
    read: 'read',
    study: 'study',
    meditate: 'meditate',
    journal: 'journal',
    instrument: 'instrument',
  }[activityId]
  return named && SHAPES[named] ? named : 'check'
}
