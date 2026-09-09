/**
 * COMPANION — positive reinforcement for work already logged in Tempered.
 *
 * Care never decays. The selectable visual styles share the same ten-level
 * progression, so changing the art never changes or resets earned progress.
 */

import {
  companionGrowth,
  companionRevealState,
  companionStyle,
  COMPANION_STYLES,
} from '../../domain/companion-growth.js'
import { el, replace } from '../dom.js'

const art = (name) => new URL(`../../../art/tempered/${name}`, import.meta.url).href
const FORGE_SPRITES = art('companion-forge-stages.png')
const TURTLE_SPRITES = art('companion-turtle-stages.png')
const REVEAL_PRESENTATION_VERSION = 1

const TURTLE_UNLOCKS = [
  { key: 'nest', min: 0, icon: '◌', name: 'Reed nest' },
  { key: 'moss', min: 24, icon: '◆', name: 'Moss lining' },
  { key: 'roots', min: 50, icon: '⌁', name: 'Root shelter' },
  { key: 'pond', min: 85, icon: '◉', name: 'Turtle pond' },
  { key: 'steps', min: 130, icon: '●', name: 'Stepping stones' },
  { key: 'log', min: 185, icon: '━', name: 'Climbing log' },
  { key: 'sunning', min: 250, icon: '◇', name: 'Sunning shelf' },
  { key: 'boulders', min: 330, icon: '⬟', name: 'Training boulders' },
  { key: 'stream', min: 430, icon: '≈', name: 'Terraced stream' },
  { key: 'crest', min: 550, icon: '⬡', name: 'Trailback crest' },
]

const SPROUT_UNLOCKS = [
  { key: 'nest', min: 0, icon: '◌', scene: '◜', name: 'Starter nest' },
  { key: 'plant', min: 24, icon: '🪴', scene: '✿', name: 'Plant' },
  { key: 'water', min: 50, icon: '💧', scene: '◒', name: 'Water bottle' },
  { key: 'books', min: 85, icon: '📚', scene: '▤', name: 'Book nook' },
  { key: 'dumbbell', min: 130, icon: '🏋️', scene: '━', name: 'Tiny dumbbell' },
  { key: 'lamp', min: 185, icon: '💡', scene: '●', name: 'Warm lamp' },
  { key: 'garland', min: 250, icon: '✨', scene: '✦', name: 'Glow garland' },
  { key: 'rug', min: 330, icon: '◇', scene: '◇', name: 'Woven rug' },
  { key: 'shelf', min: 430, icon: '▦', scene: '▦', name: 'Display shelf' },
  { key: 'stars', min: 550, icon: '✦', scene: '✦', name: 'Room glow' },
]

const FORGE_UNLOCKS = [
  { key: 'foundation', min: 0, icon: '◇', name: 'Training floor' },
  { key: 'plates', min: 24, icon: '●', name: 'Plate storage' },
  { key: 'bench', min: 50, icon: '━', name: 'Recovery bench' },
  { key: 'dumbbells', min: 85, icon: '◆', name: 'Adjustable dumbbells' },
  { key: 'timer', min: 130, icon: '◷', name: 'Interval clock' },
  { key: 'rack', min: 185, icon: '╫', name: 'Power rack' },
  { key: 'kettlebells', min: 250, icon: '◒', name: 'Kettlebells' },
  { key: 'bike', min: 330, icon: '◉', name: 'Air bike' },
  { key: 'cable', min: 430, icon: '⌁', name: 'Cable station' },
  { key: 'lighting', min: 550, icon: '✦', name: 'Forge lighting' },
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
    day.studyMinutes,
    day.meditationMinutes,
    day.instrumentMinutes,
    day.bodyMetrics?.weight,
  ]
  let count = values.filter((value) => hasNumber(value) && value > 0).length
  for (const key of ['nutritionLogged', 'alcoholFree', 'saunaLogged', 'restDay', 'journalLogged']) {
    if (day[key] === true) count += 1
  }
  return count
}

function todayMoment({ trained, day, name, style }) {
  if (style === 'turtle') {
    if (trained) return { type: 'trained', icon: '⬡', title: 'Training registered', copy: 'Today’s work made the shell a little stronger.' }
    if ((day?.waterOz ?? 0) >= 80) return { type: 'water', icon: '≈', title: 'Pond replenished', copy: 'Hydration keeps the habitat moving.' }
    if ((day?.readingMinutes ?? 0) > 0) return { type: 'reading', icon: '▤', title: 'Quiet focus', copy: 'Time spent reading reinforced the day.' }
    if ((day?.proteinGrams ?? 0) > 0 || (day?.calories ?? 0) > 0) return { type: 'nutrition', icon: '◇', title: 'Fuel logged', copy: 'Nutrition supports the next stage of growth.' }
    if ((day?.sleepHours ?? 0) > 0) return { type: 'sleep', icon: '◒', title: 'Recovery logged', copy: 'Rest is part of getting stronger.' }
    return { type: 'idle', icon: '☀', title: 'Basking', copy: `Nothing is due. ${name} keeps everything you have earned.` }
  }
  if (style === 'forge') {
    if (trained) return { type: 'trained', icon: '◆', title: 'Training registered', copy: 'Today’s work added heat to the forge.' }
    if ((day?.waterOz ?? 0) >= 80) return { type: 'water', icon: '◉', title: 'Recovery supplied', copy: 'Hydration keeps the system ready.' }
    if ((day?.readingMinutes ?? 0) > 0) return { type: 'reading', icon: '▤', title: 'Focus sharpened', copy: 'Time spent reading reinforced the day.' }
    if ((day?.proteinGrams ?? 0) > 0 || (day?.calories ?? 0) > 0) return { type: 'nutrition', icon: '◇', title: 'Fuel logged', copy: 'Nutrition added another layer of care.' }
    if ((day?.sleepHours ?? 0) > 0) return { type: 'sleep', icon: '◒', title: 'Recovery logged', copy: 'Rest is part of the build.' }
    return { type: 'idle', icon: '○', title: 'Standing ready', copy: `Nothing is due. ${name} keeps everything you have earned.` }
  }
  if (trained) return { type: 'trained', icon: '🏋️', title: 'Post-workout stretch', copy: 'Your training gave the room some energy today.' }
  if ((day?.waterOz ?? 0) >= 80) return { type: 'water', icon: '💧', title: 'Hydration break', copy: `${name} found the oversized water bottle.` }
  if ((day?.readingMinutes ?? 0) > 0) return { type: 'reading', icon: '📖', title: 'Quiet reading', copy: 'A few pages became a tiny reading session.' }
  if ((day?.proteinGrams ?? 0) > 0 || (day?.calories ?? 0) > 0) return { type: 'nutrition', icon: '🥣', title: 'Snack time', copy: 'Nutrition logging turned into a little meal moment.' }
  if ((day?.sleepHours ?? 0) > 0) return { type: 'sleep', icon: '😴', title: 'Well rested', copy: 'Sleep showed up as a calmer day in the habitat.' }
  return { type: 'idle', icon: '🌿', title: 'Hanging out', copy: `Nothing is due. ${name} simply keeps what you have already built.` }
}

function roomState(level) {
  if (level >= 8) return 'full'
  if (level >= 4) return 'mid'
  return 'starter'
}

export function createCompanionScreen({ storage, clock }) {
  const root = el('div.screen.screen--companion')
  let model = null
  let revealPhase = null
  let revealTimer = null

  async function load() {
    const [storedProfile, sessions, setLogs, days] = await Promise.all([
      storage.get('profile', 'profile'),
      storage.getAll('sessions'),
      storage.getAll('setLogs'),
      storage.getAll('dayLogs'),
    ])
    const profile = storedProfile ?? { id: 'profile' }
    const finished = sessions.filter((session) => session.endedAt)
    const workingSets = setLogs.filter((set) => !set.isWarmup)
    const lifestyle = days.reduce((sum, day) => sum + lifestyleSignals(day), 0)
    const points = finished.length * 8 + workingSets.length * 2 + lifestyle * 2
    const style = companionStyle(profile.companionStyle)
    const earnedGrowth = companionGrowth(points, style)
    // A stored level proves only which sprite an older build rendered. The
    // presentation receipt proves the user actually received the reveal. This
    // one-time repair intentionally replays 0.18.2-era checkpoints from Level 1.
    const needsPresentationRepair = earnedGrowth.stage.level > 1
      && profile.companionRevealPresentationVersion !== REVEAL_PRESENTATION_VERSION
    const revealedLevel = needsPresentationRepair ? 1 : profile.companionRevealedLevel
    const reveal = companionRevealState(points, revealedLevel, style)
    const stage = reveal.visible
    const next = reveal.pending ? reveal.earned : earnedGrowth.next
    const growth = reveal.pending ? 100 : earnedGrowth.percent
    const unlocks = style === 'turtle' ? TURTLE_UNLOCKS : style === 'forge' ? FORGE_UNLOCKS : SPROUT_UNLOCKS
    const today = days.find((day) => day.date === clock.today()) ?? { date: clock.today() }
    const trained = finished.some((session) => session.date === clock.today())
    const name = profile.companionName || (style === 'turtle' ? 'Tank' : style === 'forge' ? 'Atlas' : 'Pip')

    // Earned care and the visible form are deliberately separate. Activity can
    // unlock a form anywhere in the app, but only Companion may reveal it.
    // The numeric field is new: old silent name checkpoints are not trusted.
    if (reveal.pending && revealPhase !== 'complete') revealPhase = 'ready'
    else if (!reveal.pending && revealPhase !== 'complete') revealPhase = null
    if (profile.companionStyle !== style || profile.companionRevealedLevel !== reveal.revealedLevel) {
      await storage.put('profile', {
        ...profile,
        companionStyle: style,
        companionRevealedLevel: reveal.revealedLevel,
        companionStageSeen: stage.name,
        companionStageSeenStyle: style,
      })
    }

    const visualPoints = reveal.pending ? stage.min : points

    model = {
      name,
      points,
      style,
      styleMeta: COMPANION_STYLES[style],
      stage,
      earnedStage: reveal.earned,
      next,
      growth,
      pendingEvolution: reveal.pending,
      evolved: revealPhase === 'complete',
      unlocked: unlocks.filter((item) => visualPoints >= item.min),
      locked: unlocks.filter((item) => visualPoints < item.min),
      unlocks,
      roomState: roomState(stage.level),
      moment: todayMoment({ trained, day: today, name, style }),
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

  async function selectStyle(style) {
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const selected = companionStyle(style)
    const reveal = companionRevealState(model?.points ?? 0, profile.companionRevealedLevel, selected)
    revealPhase = null
    await storage.put('profile', {
      ...profile,
      companionStyle: selected,
      companionName: profile.companionName ?? model?.name,
      companionRevealedLevel: reveal.revealedLevel,
      companionStageSeen: reveal.visible.name,
      companionStageSeenStyle: selected,
    })
    await refresh()
  }

  async function revealEvolution() {
    if (!model?.pendingEvolution || revealPhase !== 'ready') return
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = null
    revealPhase = 'revealing'
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const target = model.earnedStage
    await storage.put('profile', {
      ...profile,
      companionStyle: model.style,
      companionRevealedLevel: target.level,
      companionRevealPresentationVersion: REVEAL_PRESENTATION_VERSION,
      companionStageSeen: target.name,
      companionStageSeenStyle: model.style,
    })
    revealPhase = 'complete'
    await load()
    model.evolved = true
    render()
  }

  function dismissEvolution() {
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = null
    revealPhase = null
    if (model) model.evolved = false
    render()
  }

  async function replayEvolution() {
    if (!model || model.earnedStage.level <= 1) return
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = null
    revealPhase = null
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const { companionRevealPresentationVersion: _receipt, ...rest } = profile
    await storage.put('profile', {
      ...rest,
      companionRevealedLevel: 1,
      companionStageSeen: companionRevealState(model.points, 1, model.style).visible.name,
      companionStageSeenStyle: model.style,
    })
    await refresh()
  }

  function habitatProps(m) {
    if (m.style !== 'sprout') return null
    return el('div.companion-habitat__props', { 'aria-hidden': 'true' }, m.unlocked.map((item) =>
      el('span.companion-habitat__prop', {
        dataset: { prop: item.key }, text: item.scene,
      })))
  }

  function companionArt(m, className = 'companion-habitat__pet') {
    if (m.style !== 'sprout') {
      const sprites = m.style === 'turtle' ? TURTLE_SPRITES : FORGE_SPRITES
      return el(`div.${className}.${className}--sheet.${className}--${m.style}`, {
        role: 'img',
        'aria-label': `${m.name}, level ${m.stage.level} ${m.stage.name}`,
        dataset: { visual: String(m.stage.visual) },
        style: `--companion-sprites:url("${sprites}")`,
      })
    }
    return el(`img.${className}`, {
      src: art(`companion-stage-${m.stage.visual}.png`),
      alt: `${m.name}, level ${m.stage.level} ${m.stage.name}`,
    })
  }

  function evolutionSparkles(m) {
    if (!m.evolved) return null
    return el('div.companion-evolve', { role: 'status', 'aria-label': `${m.name} reached level ${m.stage.level}, ${m.stage.name}` }, [
      ...Array.from({ length: 8 }, (_, index) => el('i', { dataset: { sparkle: String(index + 1) }, 'aria-hidden': 'true' })),
      el('strong', { text: `Level ${m.stage.level} · ${m.stage.name}` }),
    ])
  }

  function evolutionOverlay(m) {
    if (!revealPhase) return null
    const complete = revealPhase === 'complete'
    const target = m.earnedStage
    return el('div.companion-reveal', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'companion-reveal-title',
      dataset: { phase: revealPhase, style: m.style },
    }, [
      el('div.companion-reveal__wash', { 'aria-hidden': 'true' }),
      el('section.companion-reveal__card', {}, [
        el('span.companion-reveal__eyebrow', { text: complete ? 'EVOLUTION COMPLETE' : 'EVOLUTION READY' }),
        complete
          ? companionArt(m, 'companion-reveal__pet')
          : el('div.companion-reveal__signal', { 'aria-hidden': 'true' }, [
              companionArt(m, 'companion-reveal__current'),
              el('span', { text: '✦' }),
            ]),
        el('h2', { id: 'companion-reveal-title', text: complete ? `${m.name} evolved!` : 'Something changed.' }),
        el('strong.companion-reveal__stage', {
          text: complete
            ? `Level ${m.stage.level} · ${m.stage.name}`
            : `Level ${target.level} · ${target.name} is ready`,
        }),
        el('p', {
          text: complete
            ? target.copy
            : `Your real-world work carried ${m.name} beyond ${m.stage.name}. The new form waits for you here.`,
        }),
        el('button.companion-reveal__action', {
          type: 'button',
          onclick: complete ? dismissEvolution : revealEvolution,
          text: complete ? 'KEEP GOING' : 'REVEAL NEW FORM',
        }),
      ]),
    ])
  }

  function styleOption(id) {
    const selected = model.style === id
    const meta = COMPANION_STYLES[id]
    return el('button.companion-style__option', {
      type: 'button',
      dataset: { selected: String(selected), style: id },
      'aria-pressed': String(selected),
      onclick: () => selectStyle(id),
    }, [
      el('span.companion-style__preview', { 'aria-hidden': 'true' }),
      el('span', {}, [
        el('strong', { text: meta.label }),
        el('small', { text: id === 'turtle'
          ? 'Egg · hatchling · strong · shredded'
          : id === 'forge' ? 'Steel · bronze · teal' : 'Warm · playful · leafy' }),
      ]),
      el('i', { text: selected ? '✓' : '' }),
    ])
  }

  function render() {
    const m = model
    if (!m) return
    replace(root, [
      el('header.companion-header', {}, [
        el('div', {}, [
          el('span.companion-header__eyebrow', { text: m.style === 'turtle' ? 'YOUR TRAILBACK' : m.style === 'forge' ? 'YOUR GUARDIAN' : 'YOUR COMPANION' }),
          el('h1.screen__title', { text: m.name }),
          el('p.companion-header__copy', { text: 'Real-life progress shapes this space. Nothing ever decays.' }),
        ]),
        companionArt(m, 'companion-header__mark'),
      ]),

      el('section.companion-habitat', {
        dataset: {
          style: m.style,
          stage: m.stage.name.toLowerCase(),
          level: String(m.stage.level),
          moment: m.moment.type,
          evolved: String(m.evolved),
          room: String(m.unlocked.length),
          roomState: m.roomState,
        },
      }, [
        el('div.companion-habitat__glow'),
        habitatProps(m),
        companionArt(m),
        evolutionSparkles(m),
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
            el('strong.companion-growth__stage', { text: `Level ${m.stage.level} · ${m.stage.name}` }),
          ]),
          el('span.companion-growth__next', {
            text: m.pendingEvolution
              ? `${m.points} care · evolution ready`
              : m.next ? `${m.points} / ${m.next.min} care` : `${m.points} care · fully grown`,
          }),
        ]),
        el('div.companion-growth__bar', {
          role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(m.growth),
        }, [el('span', { style: `width:${m.growth}%` })]),
        el('p.companion-growth__copy', {
          text: m.pendingEvolution
            ? `${m.stage.copy} Reveal Level ${m.earnedStage.level} on this screen to transform.`
            : m.next ? `${m.stage.copy} Next: Level ${m.next.level} · ${m.next.name}.` : m.stage.copy,
        }),
        !m.pendingEvolution && m.stage.level > 1
          ? el('button.companion-growth__replay', {
              type: 'button',
              onclick: replayEvolution,
              text: 'REPLAY EVOLUTION',
            })
          : null,
      ]),

      el('section.companion-room', {}, [
        el('div.companion-room__head', {}, [
          el('div', {}, [
            el('h2', { text: m.style === 'turtle' ? 'Lakeside habitat' : m.style === 'forge' ? 'Training den' : 'Little room' }),
            el('p', { text: 'The space upgrades from accumulated care, never streaks.' }),
          ]),
          el('span.companion-room__count', { text: `${m.unlocked.length}/${m.unlocks.length}` }),
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

      el('section.companion-style', {}, [
        el('div.companion-style__head', {}, [
          el('h2', { text: 'Companion type' }),
          el('p', { text: 'Choose anytime. Your name, care, and level stay put.' }),
        ]),
        el('div.companion-style__options', {}, [styleOption('turtle'), styleOption('sprout'), styleOption('forge')]),
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
      evolutionOverlay(m),
    ])
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = revealPhase === 'ready'
      ? setTimeout(() => {
          revealTimer = null
          if (root.isConnected && revealPhase === 'ready') void revealEvolution()
        }, 1100)
      : null
  }

  async function refresh() {
    await load()
    render()
  }

  return { root, refresh }
}
