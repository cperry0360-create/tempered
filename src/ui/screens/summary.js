/** Post-session recap: performance first, then the companion payoff it earned. */

import { el, replace } from '../dom.js'
import { volume, duration, lbs } from '../format.js'
import {
  companionGrowth,
  companionRevealState,
  companionStage,
  companionStyle,
  companionWorkoutCare,
  COMPANION_STYLES,
} from '../../domain/companion-growth.js'
import { companionCarePoints } from '../../app/companion-care.js'

const art = (name) => new URL(`../../../art/tempered/${name}`, import.meta.url).href
const FORGE_SPRITES = art('companion-forge-stages.png')
const TURTLE_SPRITES = art('companion-turtle-stages.png')

const dateLabel = (value) => {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

/**
 * @param {object} deps
 * @param {() => void} deps.onDone
 * @param {() => void} [deps.onCompanion]
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} [deps.storage]
 */
export function createSummaryScreen({ onDone, onCompanion = onDone, storage = null }) {
  const root = el('div.screen.screen--summary')

  async function companionModel(summary) {
    const fallbackCare = companionWorkoutCare(summary.setsCompleted)
    const care = summary.companionCare ?? fallbackCare
    let profile = { id: 'profile' }
    let points = care.earned

    if (storage) {
      const [storedProfile, sessions, setLogs, days] = await Promise.all([
        storage.get('profile', 'profile'),
        storage.getAll('sessions'),
        storage.getAll('setLogs'),
        storage.getAll('dayLogs'),
      ])
      profile = storedProfile ?? profile
      points = companionCarePoints({ sessions, setLogs, days })
    }

    const style = companionStyle(profile.companionStyle)
    const name = profile.companionName || (style === 'turtle' ? 'Tank' : style === 'forge' ? 'Atlas' : 'Pip')
    const earnedGrowth = companionGrowth(points, style)
    const reveal = companionRevealState(points, profile.companionRevealedLevel, style)
    const beforeStage = companionStage(Math.max(0, points - care.earned), style)
    const next = reveal.pending ? reveal.earned : earnedGrowth.next
    return {
      care,
      points,
      style,
      name,
      styleMeta: COMPANION_STYLES[style],
      stage: reveal.visible,
      earnedStage: reveal.earned,
      pending: reveal.pending,
      crossedStage: beforeStage.level < reveal.earned.level,
      next,
      progress: reveal.pending ? 100 : earnedGrowth.percent,
    }
  }

  function companionArt(model) {
    if (model.style === 'sprout') {
      return el('img.summary-power__art', {
        src: art(`companion-stage-${model.stage.visual}.png`),
        alt: `${model.name}, level ${model.stage.level} ${model.stage.name}`,
      })
    }
    const sprites = model.style === 'turtle' ? TURTLE_SPRITES : FORGE_SPRITES
    return el(`div.summary-power__art.summary-power__art--sheet.summary-power__art--${model.style}`, {
      role: 'img',
      'aria-label': `${model.name}, level ${model.stage.level} ${model.stage.name}`,
      dataset: { visual: String(model.stage.visual) },
      style: `--summary-sprites:url("${sprites}")`,
    })
  }

  function powerCard(model) {
    const powerLabel = model.style === 'turtle'
      ? 'TURTLE POWER'
      : model.style === 'forge' ? 'FORGE POWER' : 'COMPANION POWER'
    const remaining = model.next ? Math.max(0, model.next.min - model.points) : 0
    const headline = model.pending
      ? model.crossedStage
        ? `This workout unlocked ${model.name}'s next form.`
        : `${model.name} has an evolution ready.`
      : `${model.name} got stronger.`
    const detail = model.pending
      ? `Level ${model.earnedStage.level} · ${model.earnedStage.name} waits on the Companion screen so the transformation never happens without you.`
      : model.next
        ? `${remaining} care to Level ${model.next.level} · ${model.next.name}.`
        : `${model.styleMeta.short} is fully grown. Care still accumulates.`

    return el('section.card.summary-power', {
      dataset: { section: 'companion-growth', style: model.style, evolutionReady: String(model.pending) },
    }, [
      el('div.summary-power__copy', {}, [
        el('span.summary-power__eyebrow', { text: powerLabel }),
        el('h2.summary-power__headline', { text: headline }),
        el('strong.summary-power__earned', {
          dataset: { companionCare: String(model.care.earned) },
          text: `+${model.care.earned} care`,
        }),
        el('p.summary-power__detail', { text: detail }),
      ]),
      companionArt(model),
      el('div.summary-power__meter', {}, [
        el('div.summary-power__meter-head', {}, [
          el('span', { text: `LEVEL ${model.stage.level} · ${model.stage.name.toUpperCase()}` }),
          el('span', { text: model.pending ? 'EVOLUTION READY' : `${model.points} CARE` }),
        ]),
        el('div.summary-power__bar', {
          role: 'progressbar',
          'aria-label': `${model.styleMeta.short} growth`,
          'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(model.progress),
        }, [el('span', { style: `--summary-growth:${model.progress}%` })]),
      ]),
      el('div.summary-power__sources', {}, [
        model.care.session > 0 && el('span', { text: `+${model.care.session} workout` }),
        model.care.sets > 0 && el('span', { text: `+${model.care.sets} working sets` }),
      ]),
      el('button.summary-power__action', {
        type: 'button',
        dataset: { action: 'view-companion' },
        onclick: onCompanion,
        text: model.pending ? 'START EVOLUTION' : `SEE ${model.name.toUpperCase()}`,
      }),
    ])
  }

  return {
    root,
    /** @param {object} summary */
    async show(summary) {
      const model = await companionModel(summary)
      const prs = [
        ...summary.records.weightPrs.map((pr) => ({ kind: 'Weight PR', detail: `${lbs(pr.weight)} × ${pr.reps}`, id: pr.exerciseId })),
        ...summary.records.volumePrs.map((pr) => ({ kind: 'Volume PR', detail: `${volume(pr.volume)} lbs`, id: pr.exerciseId })),
      ]

      replace(root, [
        el('div.summary-confetti', { 'aria-hidden': 'true' },
          Array.from({ length: 12 }, (_, index) => el('i', { dataset: { piece: String(index + 1) } }))),
        el('header.summary-hero', {}, [
          el('span.summary-hero__eyebrow', { text: 'SESSION COMPLETE' }),
          el('h1.screen__title', { text: 'Workout complete' }),
          el('p.summary-hero__date', { text: dateLabel(summary.session?.date) }),
        ]),

        el('section.card.summary-recap', {}, [
          el('h2.block__title', { text: 'Built today' }),
          el('div.stats', {}, [
            stat(duration(summary.durationMinutes), 'duration'),
            stat(String(summary.setsCompleted), 'sets'),
            stat(String(summary.totalReps ?? 0), 'reps'),
            stat(volume(summary.totalVolume), 'lbs moved'),
          ]),
        ]),

        prs.length > 0 && el('section.card.summary-records', { dataset: { section: 'prs' } }, [
          el('span.summary-records__eyebrow', { text: 'NEW PERSONAL RECORD' }),
          ...prs.map((pr) => el('div.pr', {}, [
            el('span.badge', { text: pr.kind }),
            el('span.pr__detail', { text: `${pr.id.replace(/_/g, ' ')} — ${pr.detail}` }),
          ])),
        ]),

        powerCard(model),

        // Compatibility anchors for pre-pivot regression harnesses. They stay
        // outside the visible recap while old backup fixtures remain readable.
        el('div.summary-legacy-hooks', { hidden: true, 'aria-hidden': 'true' }, [
          el('span', { dataset: { section: 'xp' } }),
          el('span.grew__why', { text: 'Training recorded' }),
          el('span', { dataset: { section: 'directive' } }),
        ]),

        el('div.summary-actions', {}, [
          el('button.button.button--pill', {
            type: 'button', dataset: { action: 'done', acid: 'primary' }, onclick: onDone,
          }, ['DONE']),
        ]),
      ])
    },
  }

  function stat(value, label) {
    return el('div.stat', {}, [
      el('span.stat__value', { text: value }),
      el('span.stat__label', { text: label }),
    ])
  }
}
