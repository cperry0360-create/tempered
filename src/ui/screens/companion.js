/**
 * COMPANION — a tiny positive-reinforcement layer, not a game.
 *
 * Growth is derived from real activity already stored in Tempered. Nothing
 * decays, no streak can hurt the companion, and missing a day never moves it
 * backwards. The whole point is to make progress feel alive without creating a
 * second product that needs game balancing.
 */

import { el, replace } from '../dom.js'

const STAGES = [
  { min: 0, name: 'Seed', art: './art/tempered/companion-stage-1.svg', copy: 'A tiny beginning.' },
  { min: 35, name: 'Hatchling', art: './art/tempered/companion-stage-2.svg', copy: 'Curious and awake.' },
  { min: 110, name: 'Sprout', art: './art/tempered/companion-stage-3.svg', copy: 'Growing into its own.' },
  { min: 260, name: 'Bloom', art: './art/tempered/companion-stage-4.svg', copy: 'Steady progress made visible.' },
  { min: 600, name: 'Radiant', art: './art/tempered/companion-stage-5.svg', copy: 'A long run of care, accumulated.' },
]

const ROOM_UNLOCKS = [
  { min: 0, icon: '◌', name: 'Starter nest' },
  { min: 25, icon: '🪴', name: 'Plant' },
  { min: 70, icon: '💧', name: 'Water bottle' },
  { min: 130, icon: '📚', name: 'Book nook' },
  { min: 210, icon: '🏋️', name: 'Tiny dumbbell' },
  { min: 340, icon: '💡', name: 'Warm lamp' },
  { min: 500, icon: '✨', name: 'Glow garland' },
]

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function lifestyleSignals(day) {
  if (!day) return 0
  const values = [
    day.sleepHours,
    day.steps,
    day.waterOz,
    day.proteinGrams,
    day.calories,
    day.microCardioMinutes,
    day.mobilityMinutes,
    day.readingMinutes,
    day.meditationMinutes,
    day.bodyMetrics?.weight,
  ]
  let count = values.filter((value) => hasNumber(value) && value > 0).length
  for (const key of ['foodLogged', 'alcoholFree', 'sauna', 'restDay']) {
    if (day[key] === true) count += 1
  }
  return count
}

function stageFor(points) {
  let result = STAGES[0]
  for (const stage of STAGES) if (points >= stage.min) result = stage
  return result
}

function nextStage(points) {
  return STAGES.find((stage) => stage.min > points) ?? null
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function todayMoment({ trained, day }) {
  if (trained) return { icon: '🏋️', title: 'Post-workout stretch', copy: 'Your training gave the room some energy today.' }
  if ((day?.waterOz ?? 0) >= 80) return { icon: '💧', title: 'Hydration break', copy: 'Pip found the oversized water bottle.' }
  if ((day?.readingMinutes ?? 0) > 0) return { icon: '📖', title: 'Quiet reading', copy: 'A few pages became a tiny reading session.' }
  if ((day?.proteinGrams ?? 0) > 0 || (day?.calories ?? 0) > 0) return { icon: '🥣', title: 'Snack time', copy: 'Nutrition logging turned into a little meal moment.' }
  if ((day?.sleepHours ?? 0) > 0) return { icon: '😴', title: 'Well rested', copy: 'Sleep showed up as a calmer day in the habitat.' }
  return { icon: '🌿', title: 'Hanging out', copy: 'Nothing is due. Pip simply keeps what you have already built.' }
}

export function createCompanionScreen({ storage, clock }) {
  const root = el('div.screen.screen--companion')
  let model = null

  async function load() {
    const [profile, sessions, setLogs, days] = await Promise.all([
      storage.get('profile', 'profile'),
      storage.getAll('sessions'),
      storage.getAll('setLogs'),
      storage.getAll('dayLogs'),
    ])

    const finished = sessions.filter((session) => session.endedAt)
    const workingSets = setLogs.filter((set) => !set.isWarmup)
    const lifestyle = days.reduce((sum, day) => sum + lifestyleSignals(day), 0)
    const points = finished.length * 8 + workingSets.length * 2 + lifestyle * 2
    const stage = stageFor(points)
    const next = nextStage(points)
    const today = days.find((day) => day.date === clock.today()) ?? { date: clock.today() }
    const trained = finished.some((session) => session.date === clock.today())
    const previousMin = stage.min
    const growth = next
      ? clampPercent(((points - previousMin) / Math.max(1, next.min - previousMin)) * 100)
      : 100

    model = {
      name: profile?.companionName || 'Pip',
      points,
      stage,
      next,
      growth,
      unlocked: ROOM_UNLOCKS.filter((item) => points >= item.min),
      locked: ROOM_UNLOCKS.filter((item) => points < item.min),
      moment: todayMoment({ trained, day: today }),
      totals: { sessions: finished.length, sets: workingSets.length, lifestyle },
    }
  }

  async function rename(input) {
    const value = input.value.trim().slice(0, 24)
    if (!value) return
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    await storage.put('profile', { ...profile, companionName: value })
    await refresh()
  }

  function render() {
    const m = model
    if (!m) return
    replace(root, [
      el('header.companion-header', {}, [
        el('div', {}, [
          el('span.companion-header__eyebrow', { text: 'YOUR COMPANION' }),
          el('h1.screen__title', { text: m.name }),
          el('p.companion-header__copy', { text: 'Real-life progress grows this little world. Nothing ever decays.' }),
        ]),
      ]),

      el('section.companion-habitat', { dataset: { stage: m.stage.name.toLowerCase() } }, [
        el('div.companion-habitat__glow'),
        el('img.companion-habitat__pet', {
          src: m.stage.art, alt: `${m.name}, ${m.stage.name} growth stage`,
        }),
        el('div.companion-moment', {}, [
          el('span.companion-moment__icon', { text: m.moment.icon }),
          el('div', {}, [
            el('strong', { text: m.moment.title }),
            el('span', { text: m.moment.copy }),
          ]),
        ]),
      ]),

      el('section.companion-growth', {}, [
        el('div.companion-growth__head', {}, [
          el('div', {}, [
            el('span.companion-growth__label', { text: 'GROWTH' }),
            el('strong.companion-growth__stage', { text: m.stage.name }),
          ]),
          el('span.companion-growth__next', {
            text: m.next ? `${m.points} / ${m.next.min} care` : `${m.points} care · fully grown`,
          }),
        ]),
        el('div.companion-growth__bar', {
          role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(m.growth),
        }, [el('span', { style: `width:${m.growth}%` })]),
        el('p.companion-growth__copy', { text: m.next ? `${m.stage.copy} Next: ${m.next.name}.` : m.stage.copy }),
      ]),

      el('section.companion-room', {}, [
        el('div.companion-room__head', {}, [
          el('div', {}, [
            el('h2', { text: 'Little room' }),
            el('p', { text: 'Objects unlock from accumulated care, not streaks.' }),
          ]),
          el('span.companion-room__count', { text: `${m.unlocked.length}/${ROOM_UNLOCKS.length}` }),
        ]),
        el('div.companion-room__items', {}, [
          ...m.unlocked.map((item) => el('div.companion-room__item', { dataset: { unlocked: 'true' } }, [
            el('span', { text: item.icon }), el('small', { text: item.name }),
          ])),
          ...m.locked.slice(0, 2).map((item) => el('div.companion-room__item', { dataset: { unlocked: 'false' } }, [
            el('span', { text: '○' }), el('small', { text: `${item.min} care` }),
          ])),
        ]),
      ]),

      el('section.companion-foot', {}, [
        el('div.companion-foot__stats', {}, [
          el('span', { text: `${m.totals.sessions} training days` }),
          el('span', { text: `${m.totals.sets} working sets` }),
          el('span', { text: `${m.totals.lifestyle} lifestyle logs` }),
        ]),
        (() => {
          const input = el('input.companion-name__input', {
            type: 'text', value: m.name, maxlength: '24', 'aria-label': 'Companion name',
          })
          return el('div.companion-name', {}, [
            input,
            el('button.companion-name__save', { type: 'button', onclick: () => rename(input) }, ['RENAME']),
          ])
        })(),
      ]),
    ])
  }

  async function refresh() {
    await load()
    render()
  }

  return { root, refresh }
}
