const NS = 'http://www.w3.org/2000/svg'

const SHAPES = {
  // Matching source-vector navigation glyphs: shared 24px canvas and 1.8px
  // round stroke. They remain crisp at any screen scale; no bitmap artwork.
  // Custom LFMS rail family: four balanced 24x24 emblems, NOT stock icon names.
  // Every motif uses the same round 1.85px line and a consistent optical box.
  'nav-today': [['silhouette', 'M1.9 18 L1.8 20.4 L2.5 21 L13 21 L13.7 20.3 L13.5 18.2 L12.8 16.4 L11.4 15.1 L9.7 14.5 L4.3 14.9 L2.8 16.2Z M18.2 13 L18.1 14.3 L19.2 14.4 L19.4 13.1Z M15.1 13 L15 14.2 L16.3 14.3 L16.3 13Z M12 13 L12 14 L13.3 14.3 L13.3 13.1Z M18.2 10 L18.1 11.3 L19.3 11.3 L19.4 10.1Z M15.1 10 L15 11.2 L16.2 11.3 L16.3 10.1Z M12 10 L12 11.2 L13.3 11.3 L13.3 10.1Z M7.4 8.4 L5.6 9.4 L5 11.6 L5.9 13.2 L7.9 13.9 L9.8 12.8 L10.5 11.1 L9.4 8.9Z M9.8 4.7 L9.2 5.9 L9.2 7.5 L10.4 8.4 L21 8.5 L20.9 15.6 L20.3 16 L13.9 16 L14.3 16.9 L20.7 17 L21.5 16.5 L22.2 15.2 L22.2 6.1 L21.8 5 L20.9 4.3 L19.1 4.1 L18.7 2.9 L18 3.2 L17.9 4.1 L13.4 4.1 L13.3 3.1 L12.6 2.9 L12.1 4.1Z M10.2 6.1 L11.3 5.1 L12.1 5.1 L12.6 6.3 L13.3 6 L13.4 5.1 L17.8 5.1 L18 6.1 L18.6 6.3 L19.2 5.1 L20 5.1 L21 5.7 L21.1 7.1 L10.3 7.3Z']],
  'nav-train': [['silhouette', 'M9.8 14.4 L7.8 20.1 L7.8 20.8 L8.5 21.3 L9.5 21 L11.5 16.3 L12.1 15.9 L14.5 21 L15.1 21.3 L15.9 21.1 L16.2 20 L14.5 14.6 L13.8 14.2Z M21.3 10.7 L21 11 L21 14.3 L21.8 14.6 L22.2 14.3 L22.2 11Z M2.2 10.7 L1.8 11.2 L1.8 14.1 L2.6 14.6 L3 14.1 L3 11.1Z M3.4 10.1 L3.4 15.2 L4 15.7 L5.1 15.4 L5.2 13.3 L6.2 13.3 L6.8 13.9 L8.1 13.3 L16 13.3 L16.7 13.9 L18.8 13.3 L18.9 15.4 L20 15.7 L20.6 15.1 L20.5 10 L20.1 9.6 L19.2 9.7 L18.8 10.1 L18.8 12.4 L17.9 12.5 L16.3 8.7 L14.3 7.3 L11.6 7.5 L10.2 7.2 L8.8 7.7 L7.4 9.1 L6.1 12.5 L5.2 12.4 L5.2 10.1 L4.8 9.7 L3.9 9.6Z M8.1 12 L8.6 10.7 L9.4 9.9 L10.1 11.2 L11.2 11.8 L13.6 11.5 L14.6 9.9 L15.3 10.5 L16 12.2 L8.2 12.5Z M11.7 2.6 L10.4 3.4 L10 5 L10.8 6.4 L12.4 6.7 L13.7 6 L14.1 4.3 L13.3 3Z']],
  'nav-fuel': [['silhouette', 'M16.8 16.4 L15.2 17.8 L12.8 18.5 L13.3 21.3 L13.9 22 L15 22.1 L15.6 21.6Z M7.1 16.4 L8.2 21.3 L8.9 22.1 L10 22.1 L10.7 21.3 L11.2 18.5 L8.7 17.8Z M4.6 12.9 L4.8 14.9 L5.4 15.3 L6.2 15.2 L6.6 12 L8.3 10.1 L7.1 12.9 L7.4 15.2 L8.9 16.9 L11.4 17.7 L14.6 17.1 L16.5 15.4 L16.9 14.1 L16.8 12.7 L15.6 10.1 L16.9 11.3 L17.5 12.4 L17.5 15 L18.6 15.3 L19.3 14.5 L19.1 12 L18 9.8 L16.2 8.2 L14 7.4 L12.4 8 L9.9 7.4 L7.7 8.2 L5.5 10.5Z M11.7 1.8 L10.1 2.6 L9.4 4.4 L10.4 6.5 L12.3 7 L14 6 L14.6 4 L13.4 2.2Z']],
  'nav-progress': [['silhouette', 'M19.2 14.7 L17.9 15.5 L17.7 16.9 L18.4 17.8 L19.9 18.1 L20.9 17.4 L21.1 16 L20.3 15Z M4.4 14.7 L3.2 15.4 L2.9 16.8 L3.5 17.8 L5 18.1 L5.9 17.6 L6.3 16.2 L5.6 15.1Z M4.6 13 L4.6 14.1 L5.3 14.2 L5.5 13.2 L7.4 13.4 L9.7 14.2 L11.6 15.4 L11.5 21 L8.6 19.7 L5.5 19.2 L5.4 18.7 L4.6 18.8 L5.2 20 L8.3 20.5 L12.1 22.2 L14.5 20.9 L18.8 20 L19.3 19.5 L19.3 18.8 L18.6 18.7 L18.4 19.2 L15.4 19.7 L12.3 20.9 L12.6 15.1 L17 13.3 L18.5 13.2 L18.6 14.3 L19.3 14.1 L19.2 12.7 L16.2 10.6 L14.3 10.3 L11.8 10.9 L9.7 10.3 L8.5 10.4 L6.9 11Z M11.7 1.8 L10.1 2.2 L8.8 3.3 L8.2 4.5 L8 6.4 L8.5 7.8 L9.5 9 L10.9 9.7 L12.7 9.8 L14.9 8.6 L15.6 7.5 L16 5.7 L15.4 3.7 L14.3 2.5Z M8.2 5.7 L9 4.7 L11.1 4.7 L12.2 5.3 L12.9 4.7 L15 4.7 L15.7 6 L14.8 7.2 L12.8 7.1 L12.2 6 L11.7 6 L11.6 6.7 L10.9 7.2 L9.2 7.2Z M12.9 5.4 L13.1 6.5 L14.9 6.3 L14.7 5.2Z M9.1 5.4 L9.3 6.5 L11.1 6.3 L10.9 5.2Z']],
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
      if (kind === 'silhouette') {
        path.setAttribute('style', 'fill:currentColor;stroke:none')
        path.setAttribute('fill-rule', 'evenodd')
      }
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
