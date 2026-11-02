const NS = 'http://www.w3.org/2000/svg'

const SHAPES = {
  // Matching source-vector navigation glyphs: shared 24px canvas and 1.8px
  // round stroke. They remain crisp at any screen scale; no bitmap artwork.
  // Custom LFMS rail family: four balanced 24x24 emblems, NOT stock icon names.
  // Every motif uses the same round 1.85px line and a consistent optical box.
  'nav-today': [
    ['p','M6.3 5.7h11.4c1.1 0 1.9.8 1.9 1.9v10.2c0 1.1-.8 1.9-1.9 1.9H6.3c-1.1 0-1.9-.8-1.9-1.9V7.6c0-1.1.8-1.9 1.9-1.9ZM8.4 3.5v4.1M15.6 3.5v4.1M4.4 10.1h15.2'],
    ['c',12,15.1,2.35],
    ['p','M12 11.9v.5M12 17.8v.5M8.8 15.1h.5M14.7 15.1h.5'],
  ],
  'nav-train': [
    ['p','M3.2 9.5v5M6.1 7.4v9.2M17.9 7.4v9.2M20.8 9.5v5M6.1 12h11.8'],
    ['p','M3.2 10.8H2M20.8 10.8H22'],
  ],
  'nav-fuel': [
    ['p','M4.8 3.4v6.5c0 2 1.2 3.3 3 3.3s3-1.3 3-3.3V3.4M7.8 3.4v17.2M17.6 3.4c-2.3 2.2-3.4 5.1-3.4 9.1h3.4v8.1'],
    ['p','M7.8 3.4v6.3'],
  ],
  'nav-progress': [
    // Rising connected journey with three intentional nodes, not the old bars.
    ['p','M4 18.4 9.4 12.6 13.1 14.7 20 6.5M15.9 6.5H20v4.1'],
    ['c',4,18.4,1.35],
    ['c',9.4,12.6,1.35],
    ['c',13.1,14.7,1.35],
  ],
  calculator: [['p', 'M5 3h14v18H5zM8 6h8M8 10h1M12 10h1M16 10h.1M8 14h1M12 14h1M16 14h.1M8 18h1M12 18h1M16 18h.1']],
  calendar: [['p', 'M5 4.5h14v15H5zM8 2.8v3.4M16 2.8v3.4M5 8.5h14']],
  search: [['c', 10.5, 10.5, 6.5], ['p', 'M15.5 15.5 21 21']],
  chart: [['p', 'M5 19V12M10 19V8M15 19V5M20 19V10']],
  check: [['p', 'M4.5 12.5 9.5 18 19.5 6.5']],
  plus: [['p', 'M12 5v14M5 12h14']],
  minus: [['p', 'M5 12h14']],
  up: [['p', 'M12 19V5M5.5 11.5 12 5l6.5 6.5']],
  down: [['p', 'M12 5v14M5.5 12.5 12 19l6.5-6.5']],
  play: [['fill', 'M8 5.2v13.6L19 12z']],
  bolt: [['fill', 'M13.4 2.5 5.8 13h5.1l-1 8.5L18.2 10h-5.3z']],
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
  gear: [
    ['c', 12, 12, 3.1],
    ['p', 'M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5'],
    ['c', 12, 12, 7.1],
  ],
  foe: [
    ['p', 'M12 3.4 20 8v8l-8 4.6L4 16V8Z'],
    ['p', 'M9.4 10.6h1.2M13.4 10.6h1.2'],
    ['p', 'M9.6 15.2h4.8'],
  ],
  item: [
    ['p', 'M12 3.5 19.5 8v8L12 20.5 4.5 16V8Z'],
    ['p', 'M4.5 8 12 12.2 19.5 8M12 12.2v8.3'],
  ],
  train: [['p', 'M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5M6 12h12']],
  sleep: [['p', 'M20 14.2A8.2 8.2 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2Z']],
  water: [['p', 'M12 3.2c3.4 3.6 5.6 6.4 5.6 9.2a5.6 5.6 0 0 1-11.2 0c0-2.8 2.2-5.6 5.6-9.2Z']],
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

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'icon')
  if (name.startsWith('nav-')) svg.setAttribute('data-custom-rail-glyph', name)
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
      if (kind === 'fill') path.setAttribute('style', 'fill:currentColor;stroke:none')
      svg.append(path)
    }
  }
  return svg
}

export function iconForActivity(activityId) {
  const named = {
    rest_day: 'rest',
    sauna: 'rest',
    sleep: 'sleep',
    water: 'water',
    nutrition_logged: 'food',
    calories_logged: 'food',
    alcohol_free: 'check',
    protein_target: 'protein',
    body_metrics: 'body',
    waist_measurement: 'body',
    steps: 'steps',
    micro_cardio: 'steps',
    mobility: 'mobility',
    read: 'read',
    study: 'study',
    meditate: 'meditate',
    journal: 'journal',
    instrument: 'instrument',
  }[activityId]
  return named && SHAPES[named] ? named : 'check'
}
