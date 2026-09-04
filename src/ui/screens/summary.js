/**
 * The post-session screen. ONE screen, one dismiss.
 *
 * `docs/05-workout-system.md` is explicit that this is the clearest thing to
 * improve on the competition: what you did, what broke, what grew, what
 * levelled, what is next — all scrollable, with a single Done. Nothing here is
 * behind a second dismiss.
 */

import { el, replace } from '../dom.js'
import { volume, xp, duration, lbs } from '../format.js'

const ATTRIBUTE_LABEL = {
  might: 'Might', wind: 'Wind', grit: 'Grit', vitality: 'Vitality', mind: 'Mind',
}

/** Turns the XP breakdown into the causal line docs/05 asks for. */
function causalLine(attribute, summary) {
  const parts = []
  const source = summary.xpBySource
  if (attribute === 'might') {
    if (summary.totalVolume > 0) parts.push(`${volume(summary.totalVolume)} lbs of volume`)
    const weightPrs = summary.records.weightPrs.length
    if (weightPrs) parts.push(`${weightPrs} weight PR${weightPrs > 1 ? 's' : ''}`)
    const volumePrs = summary.records.volumePrs.length
    if (volumePrs) parts.push(`${volumePrs} volume PR${volumePrs > 1 ? 's' : ''}`)
    if (source['might.carry']) parts.push('loaded carries')
  }
  if (attribute === 'grit') {
    parts.push('session completed')
    if (source['grit.hours']) parts.push(`${duration(summary.durationMinutes)} under load`)
    if (source['grit.return']) parts.push('back after time away')
    if (source['grit.weekPlan']) parts.push('week met plan')
  }
  return parts.join(', ')
}

/**
 * @param {object} deps
 * @param {() => void} deps.onDone
 */
export function createSummaryScreen({ onDone }) {
  const root = el('div.screen.screen--summary')

  return {
    root,
    /** @param {object} summary */
    show(summary) {
      const prs = [
        ...summary.records.weightPrs.map((pr) => ({ kind: 'Weight PR', detail: `${lbs(pr.weight)} × ${pr.reps}`, id: pr.exerciseId })),
        ...summary.records.volumePrs.map((pr) => ({ kind: 'Volume PR', detail: `${volume(pr.volume)} lbs`, id: pr.exerciseId })),
      ]

      replace(root, [
        el('h1.screen__title', { text: 'Session tempered' }),

        // 1. What you did
        el('section.card', {}, [
          el('h2.block__title', { text: 'What you did' }),
          el('div.stats', {}, [
            stat(duration(summary.durationMinutes), 'duration'),
            stat(String(summary.setsCompleted), 'sets'),
            stat(volume(summary.totalVolume), 'lbs moved'),
          ]),
        ]),

        // 2. What broke
        prs.length > 0 && el('section.card', { dataset: { section: 'prs' } }, [
          el('h2.block__title', { text: 'What broke' }),
          ...prs.map((pr) => el('div.pr', {}, [
            el('span.badge', { text: pr.kind }),
            el('span.pr__detail', { text: `${pr.id.replace(/_/g, ' ')} — ${pr.detail}` }),
          ])),
        ]),

        // 3. What grew
        el('section.card', { dataset: { section: 'xp' } }, [
          el('h2.block__title', { text: 'What grew' }),
          ...Object.entries(summary.xpByAttribute)
            .filter(([, amount]) => amount > 0)
            .map(([attribute, amount]) => el('div.grew', { dataset: { attribute } }, [
              el('span.grew__attr', { text: ATTRIBUTE_LABEL[attribute] }),
              el('span.grew__xp', { text: `+${xp(amount)}` }),
              el('span.grew__why', { text: causalLine(attribute, summary) }),
            ])),
        ]),

        // 4. What levelled
        summary.levelledUp.length > 0 && el('section.card', { dataset: { section: 'levels' } }, [
          el('h2.block__title', { text: 'What levelled' }),
          ...summary.levelledUp.map((up) => el('p.levelup', { dataset: { attribute: up.attribute } }, [
            el('strong', { text: `${ATTRIBUTE_LABEL[up.attribute]} reached ${up.tier}` }),
            el('span', { text: ` · level ${up.level}` }),
          ])),
        ]),

        // 5. What's next
        summary.directive && el('section.card', { dataset: { section: 'directive' } }, [
          el('h2.block__title', { text: "What's next" }),
          el('p.directive__headline', { text: summary.directive.headline }),
          el('p.directive__detail', { text: summary.directive.detail }),
        ]),

        el('button.button.button--primary.button--wide', {
          type: 'button', dataset: { action: 'done' }, onclick: onDone,
        }, ['DONE']),
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
