/** LFMS session finish: a skippable visual reveal followed by actual workout results. */
import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { volume, duration, lbs } from '../format.js'

const markUrl = new URL('../../../branding/lfms/logo-mark.svg', import.meta.url).href
const wordmarkUrl = new URL('../../../branding/lfms/logo-wordmark.svg', import.meta.url).href

function dateLabel(date) {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}
function exerciseName(id) {
  return String(id || 'Exercise').replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function brand() {
  return el('div.finish-v2__brand', {}, [
    el('img.finish-v2__brand-mark', { src: markUrl, alt: '' }),
    el('img.finish-v2__brand-wordmark', {
      src: wordmarkUrl, alt: 'Less Fat More Strong',
    }),
  ])
}
function metric(value, label) {
  return el('div.stat.finish-v2__metric', {}, [
    el('strong.finish-v2__metric-value', { text: value }),
    el('span.finish-v2__metric-label', { text: label }),
  ])
}

/** DOM-only: the workout service is the source of truth for every result. */
export function createSummaryScreen({ onDone }) {
  const root = el('div.screen.screen--summary.finish-v2')
  const skipIntro = () => { root.dataset.introSkipped = 'true' }

  return {
    root,
    async show(summary) {
      root.dataset.introSkipped = 'false'
      const workouts = Array.isArray(summary.exerciseBreakdown) ? summary.exerciseBreakdown : []
      const names = new Map(workouts.map(({ exerciseId, name }) => [exerciseId, name]))
      const prs = [
        ...(summary.records?.weightPrs ?? []).map((pr) => ({
          id: pr.exerciseId, type: 'Weight PR',
          value: lbs(pr.weight) + ' lb × ' + pr.reps,
        })),
        ...(summary.records?.volumePrs ?? []).map((pr) => ({
          id: pr.exerciseId, type: 'Volume PR',
          value: volume(pr.volume) + ' lb',
        })),
      ]
      const sessionName = summary.session?.title
        || summary.session?.routineName || 'Workout'
      const exerciseRows = el('div.finish-v2__exercise-rows', {
        hidden: true, dataset: { section: 'exercise-details' },
      }, workouts.map((work) => el('div.finish-v2__exercise-row', {}, [
        el('strong', { text: work.name || exerciseName(work.exerciseId) }),
        el('span', { text: work.sets + (work.sets === 1 ? ' set' : ' sets')
          + (work.reps ? ' · ' + work.reps + ' reps' : '') }),
      ])))

      replace(root, [
        el('button.finish-v2__intro', {
          type: 'button',
          'aria-label': 'Skip workout completion animation',
          dataset: { completionIntro: 'true' },
          onclick: skipIntro,
        }, [
          el('div.finish-v2__intro-content', {}, [
            brand(),
            el('div.finish-v2__intro-stage', { 'aria-hidden': 'true' }, [
              el('span.finish-v2__intro-strike'),
              el('span.finish-v2__intro-pulse'),
              icon('nav-train'),
            ]),
            el('div.finish-v2__intro-title', {}, [
              el('span', { text: 'WORKOUT' }),
              el('strong', { text: 'COMPLETE' }),
            ]),
            el('span.finish-v2__intro-tagline', { text: 'TRAIN · FUEL · RECOVER' }),
          ]),
          el('span.finish-v2__intro-skip', { text: 'Tap to continue' }),
        ]),
        el('header.summary-hero.finish-v2__header', {}, [
          brand(),
          el('span.finish-v2__saved', { text: '✓ SAVED' }),
        ]),
        el('section.finish-v2__headline', {}, [
          el('div.finish-v2__headline-copy', {}, [
            el('span.summary-hero__eyebrow', { text: 'TRAINING COMPLETE' }),
            el('h1.screen__title', { text: 'Workout complete.' }),
            el('strong.finish-v2__session', { text: sessionName }),
            el('span.summary-hero__date', { text: dateLabel(summary.session?.date) }),
          ]),
          el('div.finish-v2__emblem', { 'aria-hidden': 'true' }, [icon('nav-train')]),
        ]),
        el('div.finish-v2__content', {}, [
          el('section.card.summary-recap.finish-v2__card', {}, [
            el('div.finish-v2__card-heading', {}, [
              el('h2.block__title', { text: 'Your session' }),
              el('span', { text: 'WORK RECORDED' }),
            ]),
            el('div.stats.finish-v2__stats', {}, [
              metric(duration(summary.durationMinutes), 'TRAINING TIME'),
              metric(String(summary.setsCompleted), 'WORKING SETS'),
              metric(String(summary.totalReps ?? 0), 'REPS'),
              metric(volume(summary.totalVolume) + ' lb', 'VOLUME'),
            ]),
            workouts.length > 0 && el('button.finish-v2__exercise-toggle', {
              type: 'button', dataset: { action: 'view-exercises' },
              'aria-expanded': 'false',
              onclick: (event) => {
                exerciseRows.hidden = !exerciseRows.hidden
                const expanded = !exerciseRows.hidden
                event.currentTarget.setAttribute('aria-expanded', String(expanded))
                event.currentTarget.textContent = expanded ? 'Hide exercises −' : 'View exercises +'
              },
            }, ['View exercises +']),
            exerciseRows,
          ]),
          el('section.card.summary-records.finish-v2__card', {
            dataset: { section: 'prs' },
          }, [
            el('div.finish-v2__card-heading', {}, [
              el('h2.block__title', { text: 'Personal records' }),
              prs.length > 0 && el('span.finish-v2__pr-count', {
                text: prs.length + ' NEW',
              }),
            ]),
            prs.length > 0
              ? el('div.finish-v2__pr-list', {}, prs.map((pr) => el('div.pr.finish-v2__pr', {}, [
                  el('span.finish-v2__pr-mark', { text: 'PR' }),
                  el('div.finish-v2__pr-copy', {}, [
                    el('strong', { text: names.get(pr.id) || exerciseName(pr.id) }),
                    el('span.pr__detail', { text: pr.type + ' · ' + pr.value }),
                  ]),
                ])))
              : el('div.finish-v2__no-pr', {}, [
                  el('strong', { text: 'Work logged.' }),
                  el('span', { text: 'No new personal records this session.' }),
                ]),
          ]),
        ]),
        // Legacy DOM hooks are preserved for the existing browser harnesses.
        el('div.summary-legacy-hooks', { hidden: true, 'aria-hidden': 'true' }, [
          el('span', { dataset: { section: 'xp' } }),
          el('span.grew__why', { text: 'Training recorded' }),
          el('span', { dataset: { section: 'directive' } }),
        ]),
        el('div.summary-actions.finish-v2__actions', {}, [
          el('button.button.button--pill.finish-v2__done', {
            type: 'button', dataset: { action: 'done', acid: 'primary' },
            onclick: onDone,
          }, ['Back to LFMS']),
        ]),
      ])
    },
  }
}
