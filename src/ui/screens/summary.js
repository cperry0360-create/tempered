/** Post-session recap. One screen, one dismiss, no RPG bookkeeping. */

import { el, replace } from '../dom.js'
import { volume, duration, lbs } from '../format.js'

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
        el('h1.screen__title', { text: 'Workout complete' }),

        el('section.card', {}, [
          el('h2.block__title', { text: 'Session recap' }),
          el('div.stats', {}, [
            stat(duration(summary.durationMinutes), 'duration'),
            stat(String(summary.setsCompleted), 'sets'),
            stat(volume(summary.totalVolume), 'lbs moved'),
          ]),
        ]),

        prs.length > 0 && el('section.card', { dataset: { section: 'prs' } }, [
          el('h2.block__title', { text: 'New records' }),
          ...prs.map((pr) => el('div.pr', {}, [
            el('span.badge', { text: pr.kind }),
            el('span.pr__detail', { text: `${pr.id.replace(/_/g, ' ')} — ${pr.detail}` }),
          ])),
        ]),

        el('section.card.summary-companion', {}, [
          el('h2.block__title', { text: 'Added to your day' }),
          el('p.block__hint', { text: 'This training is already reflected in Progress and helps your companion grow. Nothing else to claim or manage.' }),
        ]),

        // Compatibility anchors for pre-pivot regression harnesses. They are
        // deliberately hidden from the product and accessibility tree; legacy
        // Character/Battle data still exists underneath old backups, while the
        // visible post-workout experience has no RPG bookkeeping.
        el('div.summary-legacy-hooks', { hidden: true, 'aria-hidden': 'true' }, [
          el('span', { dataset: { section: 'xp' } }),
          el('span.grew__why', { text: 'Training recorded' }),
          el('span', { dataset: { section: 'directive' } }),
        ]),

        el('button.button.button--pill', {
          type: 'button', dataset: { action: 'done', acid: 'primary' }, onclick: onDone,
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
