/**
 * HISTORY — the evidence.
 *
 * Phase 3 builds the two views the workout tracker owes: sessions, and records
 * per exercise with the PR list. The calendar grid and the working-weight
 * sparkline are Phase 3's remaining History surface in `docs/03-screens.md`;
 * the sparkline is included here because it is named there as the single most
 * motivating artefact the app can produce, and it costs one small SVG.
 */

import { el, replace } from '../dom.js'
import { lbs, volume, duration, shortDate } from '../format.js'

/**
 * A working-weight line for one exercise. Deliberately tiny and unlabelled: it
 * is a shape, read at a glance, not a chart to be studied.
 * @param {number[]} values
 */
function sparkline(values) {
  if (values.length < 2) return null
  const width = 96
  const height = 24
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('class', 'spark')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', points)
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '1.5')
  svg.append(line)
  return svg
}

/**
 * @param {object} deps
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 */
export function createHistoryScreen({ storage, workout }) {
  const root = el('div.screen.screen--history')
  let view = 'sessions'
  /** @type {any[]} */ let sessions = []
  /** @type {any[]} */ let records = []
  /** @type {Map<string, any>} */ let exercises = new Map()
  /** @type {Map<string, {volume: number, prs: number}>} */ let sessionStats = new Map()
  /** @type {Map<string, number[]>} */ let weightHistory = new Map()

  function sessionsView() {
    if (sessions.length === 0) {
      return [el('p.block__hint', { text: 'No sessions yet. The first one is the hardest to start and the easiest to log.' })]
    }
    return sessions.map((session) => {
      const stats = sessionStats.get(session.id) ?? { volume: 0, prs: 0 }
      return el('article.card.historyrow', { dataset: { session: session.id } }, [
        el('div.historyrow__head', {}, [
          el('h3.historyrow__name', { text: session.routineName ?? session.routineId ?? 'Single exercise' }),
          el('span.historyrow__date', { text: shortDate(session.date) }),
        ]),
        el('p.historyrow__meta', {
          text: [
            session.durationMinutes ? duration(session.durationMinutes) : null,
            `${volume(stats.volume)} lbs`,
            stats.prs > 0 ? `${stats.prs} PR${stats.prs > 1 ? 's' : ''}` : null,
          ].filter(Boolean).join(' · '),
        }),
      ])
    })
  }

  function recordsView() {
    const withRecords = records.filter((record) => record.bestWeight || record.bestVolume)
    if (withRecords.length === 0) {
      return [el('p.block__hint', { text: 'Records appear here once an exercise has been worked.' })]
    }
    return withRecords
      .sort((a, b) => (b.bestWeight?.weight ?? 0) - (a.bestWeight?.weight ?? 0))
      .map((record) => {
        const exercise = exercises.get(record.exerciseId)
        const line = sparkline(weightHistory.get(record.exerciseId) ?? [])
        return el('article.card.recordrow', { dataset: { record: record.exerciseId } }, [
          el('div.recordrow__head', {}, [
            el('h3.recordrow__name', { text: exercise?.name ?? record.exerciseId }),
            line,
          ]),
          el('div.recordrow__stats', {}, [
            record.bestWeight && stat(`${lbs(record.bestWeight.weight)} × ${record.bestWeight.reps}`, 'best set'),
            record.bestVolume && stat(volume(record.bestVolume.volume), 'best volume'),
            record.bestE1RM && stat(lbs(record.bestE1RM.value), 'est. 1RM'),
          ].filter(Boolean)),
        ])
      })
  }

  function stat(value, label) {
    return el('div.stat.stat--small', {}, [
      el('span.stat__value', { text: value }),
      el('span.stat__label', { text: label }),
    ])
  }

  function render() {
    replace(root, [
      el('h1.screen__title', { text: 'History' }),
      el('div.segmented', {}, ['sessions', 'records'].map((name) => el('button.segmented__option', {
        type: 'button', dataset: { view: name, active: String(view === name) },
        onclick: () => { view = name; render() },
      }, [name.toUpperCase()]))),
      el('div.block', {}, view === 'sessions' ? sessionsView() : recordsView()),
    ])
  }

  return {
    root,
    async refresh() {
      const routines = new Map((await storage.getAll('routines')).map((r) => [r.id, r]))
      sessions = (await storage.getAll('sessions'))
        .filter((session) => session.endedAt)
        .map((session) => ({ ...session, routineName: routines.get(session.routineId)?.name }))
        .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))

      records = await storage.getAll('records')
      exercises = await workout.exerciseMap()

      // Per-session volume, and working weight over time per exercise.
      sessionStats = new Map()
      weightHistory = new Map()
      const byDate = new Map(sessions.map((s) => [s.id, s.date]))
      /** @type {Map<string, Map<string, number>>} */
      const perExercisePerDay = new Map()

      for (const log of await storage.getAll('setLogs')) {
        if (log.isWarmup) continue
        const stats = sessionStats.get(log.sessionId) ?? { volume: 0, prs: 0 }
        const exercise = exercises.get(log.exerciseId)
        const load = (typeof exercise?.notionalLoad === 'number' ? exercise.notionalLoad : 0) + (log.weight ?? 0)
        if (load > 0 && log.reps > 0) stats.volume += load * log.reps
        sessionStats.set(log.sessionId, stats)

        const date = byDate.get(log.sessionId)
        if (!date || !(load > 0)) continue
        if (!perExercisePerDay.has(log.exerciseId)) perExercisePerDay.set(log.exerciseId, new Map())
        const days = perExercisePerDay.get(log.exerciseId)
        days.set(date, Math.max(days.get(date) ?? 0, load))
      }

      for (const [exerciseId, days] of perExercisePerDay) {
        weightHistory.set(exerciseId, [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, w]) => w))
      }

      render()
    },
  }
}
