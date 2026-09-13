/**
 * PROGRESS — trends, habit consistency, lifting progression and the raw log.
 */

import { el, replace } from '../dom.js'
import { emptyState } from '../states.js'
import { lbs, volume, duration, shortDate } from '../format.js'
import { ACTIVITY_FIELDS, isLogged } from '../../domain/activities.js'
import {
  observedProgressDates,
  progressDataStart,
  recordedSampleCount,
} from '../../domain/progress-coverage.js'

const progressIcon = new URL('../../../art/tempered/icon-progress.png', import.meta.url).href

function parseDate(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(key, amount) {
  const date = parseDate(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

function rangeDates(today, count) {
  const start = addDays(today, -(count - 1))
  const dates = []
  for (let key = start; key <= today; key = addDays(key, 1)) dates.push(key)
  return dates
}

function average(values) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1,
  }).format(value)
}

function sparkline(values, width = 160, height = 38) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (clean.length < 2) return null
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const points = clean.map((value, index) => {
    const x = (index / (clean.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('class', 'spark')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', points)
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '2')
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('stroke-linejoin', 'round')
  svg.append(line)
  return svg
}

function completedActivity(activity, day) {
  const spec = ACTIVITY_FIELDS[activity.id]
  if (!spec) return false
  if (activity.id === 'protein_target') return day?.proteinTargetMet === true
  if (activity.id === 'calories_logged') return day?.caloriesLogged === true
  if (Number.isFinite(activity.dailyCap) && activity.dailyCap > 0) {
    const value = day?.[spec.field]
    return typeof value === 'number' && value >= activity.dailyCap
  }
  return isLogged(activity, day)
}

function streaks(values) {
  let longest = 0
  let run = 0
  for (const value of values) {
    run = value ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  for (let index = values.length - 1; index >= 0 && values[index]; index -= 1) current += 1
  return { current, longest }
}

function deltaText(current, previous, { suffix = '', points = false } = {}) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'no prior comparison yet'
  const delta = current - previous
  if (Math.abs(delta) < 0.05) return 'about the same as prior period'
  const rounded = Math.abs(delta) >= 10 ? Math.round(Math.abs(delta)) : Math.round(Math.abs(delta) * 10) / 10
  return `${delta > 0 ? '+' : '−'}${rounded}${points ? ' pts' : suffix} vs prior period`
}

function bestSetLabel(best) {
  if (!best) return '—'
  if (Number.isInteger(best.cablePeg)) return `P${best.cablePeg} · ${lbs(best.weight)} × ${best.reps}`
  return `${lbs(best.weight)} × ${best.reps}`
}

export function createHistoryScreen({ storage, workout, daily, clock }) {
  const root = el('div.screen.screen--history.screen--progress')
  let view = 'overview'
  let range = 30
  let sessions = []
  let records = []
  let exercises = new Map()
  let sessionStats = new Map()
  let weightHistory = new Map()
  let dayLogs = []
  let setLogs = []
  let schedule = {}

  function selectedDates() {
    return rangeDates(clock.today(), range)
  }

  function previousDates() {
    const current = selectedDates()
    return rangeDates(addDays(current[0], -1), range)
  }

  function daysForDates(dates) {
    const map = new Map(dayLogs.map((row) => [row.date, row]))
    return dates.map((date) => map.get(date) ?? { date })
  }

  function selectedDays() {
    const dates = selectedDates()
    const dataStart = progressDataStart({ dayLogs, sessions, today: clock.today() })
    return daysForDates(observedProgressDates(dates, dataStart))
  }

  function dailyActivities() {
    return (daily.activities ?? []).filter((activity) => schedule[activity.id]?.cadence === 'daily')
  }

  function metric(value, label, detail = null) {
    return el('article.progress-metric', {}, [
      el('strong.progress-metric__value', { text: value }),
      el('span.progress-metric__label', { text: label }),
      detail && el('span.progress-metric__detail', { text: detail }),
    ])
  }

  function habitCompletionForDay(day) {
    const activities = dailyActivities()
    if (activities.length === 0) return { done: 0, total: 0, percent: 0 }
    const done = activities.filter((activity) => completedActivity(activity, day)).length
    return { done, total: activities.length, percent: Math.round((done / activities.length) * 100) }
  }

  function heatmap(days) {
    return el('div.progress-heatmap', { 'aria-label': 'Daily habit completion' }, days.map((day) => {
      const completion = habitCompletionForDay(day)
      return el('span.progress-heatmap__day', {
        title: `${shortDate(day.date)} · ${completion.percent}%`,
        dataset: { level: String(Math.min(4, Math.ceil(completion.percent / 25))) },
        'aria-label': `${shortDate(day.date)}, ${completion.percent}% habits complete`,
      })
    }))
  }

  function summaryForDates(dates) {
    const dataStart = progressDataStart({ dayLogs, sessions, today: clock.today() })
    const trackedDates = observedProgressDates(dates, dataStart)
    const days = daysForDates(trackedDates)
    const dateSet = new Set(trackedDates)
    const habits = dailyActivities()
    const opportunities = days.length * habits.length
    const habitDone = days.reduce((sum, day) => sum + habits.filter((activity) => completedActivity(activity, day)).length, 0)
    const habitRate = opportunities ? Math.round((habitDone / opportunities) * 100) : null
    const periodSessions = sessions.filter((session) => dateSet.has(session.date))
    const sessionIds = new Set(periodSessions.map((session) => session.id))
    const workingSets = setLogs.filter((log) => !log.isWarmup && sessionIds.has(log.sessionId)).length
    const trainingDays = new Set(periodSessions.map((session) => session.date)).size
    const avgSteps = average(days.map((day) => day.steps))
    const avgSleep = average(days.map((day) => day.sleepHours))
    const stepSamples = recordedSampleCount(days.map((day) => day.steps))
    const sleepSamples = recordedSampleCount(days.map((day) => day.sleepHours))
    const microMinutes = days.reduce((sum, day) => sum + (day.microCardioMinutes ?? 0), 0)

    const volumeByDate = new Map(days.map((day) => [day.date, 0]))
    for (const session of periodSessions) {
      const stats = sessionStats.get(session.id)
      volumeByDate.set(session.date, (volumeByDate.get(session.date) ?? 0) + (stats?.volume ?? 0))
    }
    const volumeValues = days.map((day) => volumeByDate.get(day.date) ?? 0)
    const totalVolume = volumeValues.reduce((sum, value) => sum + value, 0)

    const weights = days
      .map((day) => ({ date: day.date, value: day.bodyMetrics?.weight }))
      .filter((entry) => typeof entry.value === 'number')
    const latestWeight = weights.at(-1)?.value ?? null
    const firstWeight = weights[0]?.value ?? null
    const weightChange = latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null

    return {
      days, periodSessions, trainingDays, workingSets, habitRate, avgSteps, avgSleep,
      microMinutes, volumeValues, totalVolume, weights, latestWeight, weightChange,
      trackedDays: trackedDates.length,
      requestedDays: dates.length,
      fullCoverage: trackedDates.length === dates.length,
      stepSamples,
      sleepSamples,
    }
  }

  function overviewView() {
    const current = summaryForDates(selectedDates())
    const previous = summaryForDates(previousDates())
    const sleepText = current.avgSleep === null ? '—' : `${current.avgSleep.toFixed(1)}h`
    const stepsText = current.avgSteps === null ? '—' : compactNumber(Math.round(current.avgSteps))
    const bodyText = current.latestWeight === null ? '—' : `${current.latestWeight.toFixed(1)} lb`
    const hasData = current.trackedDays > 0
    const comparable = current.fullCoverage && previous.fullCoverage
    const recapLabel = current.fullCoverage
      ? `${range}-DAY RECAP`
      : `${range}-DAY VIEW · ${current.trackedDays} ${current.trackedDays === 1 ? 'DAY' : 'DAYS'} OF DATA`
    const comparisonTraining = comparable
      ? deltaText(current.trainingDays, previous.trainingDays, { suffix: ' days' })
      : 'no prior comparison yet'
    const comparisonHabits = comparable
      ? deltaText(current.habitRate, previous.habitRate, { points: true })
      : 'no prior comparison yet'

    return [
      el('section.progress-recap', { dataset: { recap: String(range) } }, [
        el('div.progress-recap__top', {}, [
          el('div', {}, [
            el('span.progress-recap__eyebrow', { text: recapLabel }),
            el('h2.progress-recap__headline', {
              text: hasData
                ? current.trainingDays === 1 ? '1 training day' : `${current.trainingDays} training days`
                : 'No recorded data yet',
            }),
            el('p.progress-recap__sub', {
              text: hasData
                ? `${current.workingSets} working sets · ${compactNumber(current.totalVolume)} lb nominal training volume`
                : 'Tempered will calculate this range from the first day you log.',
            }),
          ]),
          el('div.progress-recap__score', {}, [
            el('strong', { text: current.habitRate === null ? '—' : `${current.habitRate}%` }),
            el('span', { text: 'habits' }),
          ]),
        ]),
        el('div.progress-recap__compare', {}, [
          el('span', { text: comparisonTraining }),
          el('span', { text: comparisonHabits }),
        ]),
        el('div.progress-recap__stats', {}, [
          metric(hasData ? String(current.periodSessions.length) : '—', 'sessions', hasData ? `${current.workingSets} working sets` : null),
          metric(stepsText, 'avg steps', current.avgSteps === null ? null : `${current.stepSamples} logged ${current.stepSamples === 1 ? 'day' : 'days'}`),
          metric(sleepText, 'avg sleep', current.avgSleep === null ? null : `${current.sleepSamples} logged ${current.sleepSamples === 1 ? 'night' : 'nights'}`),
          metric(bodyText, 'latest weight', current.weightChange === null ? 'log more days for a trend' : `${current.weightChange >= 0 ? '+' : ''}${current.weightChange.toFixed(1)} lb in range`),
        ]),
      ]),

      el('section.progress-panel', {}, [
        el('div.progress-panel__head', {}, [
          el('div', {}, [
            el('h2.progress-panel__title', { text: 'Consistency' }),
            el('p.progress-panel__sub', { text: 'Each square is one day of configured daily habits.' }),
          ]),
          el('strong.progress-panel__hero', { text: current.habitRate === null ? '—' : `${current.habitRate}%` }),
        ]),
        heatmap(current.days),
      ]),

      el('section.progress-panel', {}, [
        el('div.progress-panel__head', {}, [
          el('div', {}, [
            el('h2.progress-panel__title', { text: 'Training load' }),
            el('p.progress-panel__sub', { text: `${compactNumber(current.totalVolume)} lb nominal volume across ${current.workingSets} working sets` }),
          ]),
          sparkline(current.volumeValues),
        ]),
        el('div.progress-panel__mini', {}, [
          metric(String(current.trainingDays), 'training days'),
          metric(String(current.workingSets), 'working sets'),
          metric(`${Math.round(current.microMinutes)}m`, 'micro cardio'),
        ]),
      ]),

      el('section.progress-panel', {}, [
        el('div.progress-panel__head', {}, [
          el('div', {}, [
            el('h2.progress-panel__title', { text: 'Body trend' }),
            el('p.progress-panel__sub', {
              text: current.latestWeight === null
                ? 'Log weight to build a trend.'
                : `${current.latestWeight.toFixed(1)} lb${current.weightChange === null ? '' : ` · ${current.weightChange >= 0 ? '+' : ''}${current.weightChange.toFixed(1)} lb across this range`}`,
            }),
          ]),
          sparkline(current.weights.map((entry) => entry.value)),
        ]),
      ]),
    ]
  }

  function habitsView() {
    const days = selectedDays()
    const activities = dailyActivities()
    if (activities.length === 0) {
      return [emptyState('No daily habits configured', 'Set activities to DAILY in Settings to build consistency stats.')]
    }
    if (days.length === 0) {
      return [emptyState('No habit history yet', 'Tempered will calculate consistency from the first day you log.')]
    }
    return activities.map((activity) => {
      const values = days.map((day) => completedActivity(activity, day))
      const done = values.filter(Boolean).length
      const percent = Math.round((done / values.length) * 100)
      const streak = streaks(values)
      return el('article.progress-habit', { dataset: { habit: activity.id } }, [
        el('div.progress-habit__head', {}, [
          el('div', {}, [
            el('h3.progress-habit__name', { text: activity.short ?? activity.name }),
            el('p.progress-habit__meta', { text: `${done} of ${values.length} days` }),
          ]),
          el('strong.progress-habit__rate', { text: `${percent}%` }),
        ]),
        el('div.progress-habit__bar', {}, [el('span', { style: `width:${percent}%` })]),
        el('div.progress-habit__stats', {}, [
          el('span', { text: `${streak.current} current streak` }),
          el('span', { text: `${streak.longest} best streak` }),
        ]),
      ])
    })
  }

  function liftsView() {
    const withRecords = records.filter((record) => record.bestWeight || record.bestVolume)
    if (withRecords.length === 0) {
      return [emptyState('No lifting progress yet', 'Records and trend lines build automatically from working sets.')]
    }
    return withRecords
      .sort((a, b) => (b.bestWeight?.weight ?? 0) - (a.bestWeight?.weight ?? 0))
      .map((record) => {
        const exercise = exercises.get(record.exerciseId)
        const line = sparkline(weightHistory.get(record.exerciseId) ?? [], 120, 30)
        return el('article.progress-lift', { dataset: { record: record.exerciseId } }, [
          el('div.progress-lift__head', {}, [
            el('div', {}, [
              el('h3.progress-lift__name', { text: exercise?.name ?? record.exerciseId }),
              el('p.progress-lift__meta', { text: `${(weightHistory.get(record.exerciseId) ?? []).length} logged training day${(weightHistory.get(record.exerciseId) ?? []).length === 1 ? '' : 's'}` }),
            ]),
            line,
          ]),
          el('div.progress-lift__stats', {}, [
            record.bestWeight && stat(bestSetLabel(record.bestWeight), 'best set'),
            record.bestVolume && stat(volume(record.bestVolume.volume), 'best volume'),
            record.bestE1RM && stat(lbs(record.bestE1RM.value), 'est. 1RM'),
          ].filter(Boolean)),
        ])
      })
  }

  function sessionsView() {
    const dates = new Set(selectedDates())
    const period = sessions.filter((session) => dates.has(session.date))
    if (period.length === 0) {
      return [emptyState('No training in this range', 'Completed workouts and micro-set training days will appear here.')]
    }
    return period.map((session) => {
      const stats = sessionStats.get(session.id) ?? { volume: 0 }
      return el('article.card.historyrow', { dataset: { session: session.id } }, [
        el('div.historyrow__head', {}, [
          el('h3.historyrow__name', { text: session.routineName ?? session.routineId ?? 'Training day' }),
          el('span.historyrow__date', { text: shortDate(session.date) }),
        ]),
        el('p.historyrow__meta', {
          text: [
            session.durationMinutes ? duration(session.durationMinutes) : null,
            `${volume(stats.volume)} lbs`,
            `${stats.sets ?? 0} sets`,
          ].filter(Boolean).join(' · '),
        }),
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
    const viewContent = view === 'overview' ? overviewView()
      : view === 'habits' ? habitsView()
        : view === 'lifts' ? liftsView()
          : sessionsView()

    replace(root, [
      el('header.progress-header', {}, [
        el('div.progress-header__copyblock', {}, [
          el('h1.screen__title', { text: 'Progress' }),
          el('p.progress-header__copy', { text: 'A useful recap first. Detail when you want it.' }),
        ]),
        el('img.progress-header__mark', { src: progressIcon, alt: '', 'aria-hidden': 'true' }),
      ]),
      el('div.segmented.progress-views', { role: 'group', 'aria-label': 'Progress view' }, [
        ['overview', 'Recap'], ['habits', 'Habits'], ['lifts', 'Lifts'], ['log', 'Log'],
      ].map(([name, label]) => el('button.segmented__option', {
        type: 'button', dataset: { view: name, active: String(view === name) },
        'aria-pressed': String(view === name), onclick: () => { view = name; render() },
      }, [label.toUpperCase()]))),
      el('div.progress-range', { role: 'group', 'aria-label': 'Time range' }, [7, 30, 90].map((days) => el('button.progress-range__button', {
        type: 'button', dataset: { active: String(range === days) },
        'aria-pressed': String(range === days), onclick: () => { range = days; render() },
      }, [`${days}D`]))),
      el('div.progress-content', {}, viewContent),
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

      ;[records, exercises, dayLogs, setLogs, schedule] = await Promise.all([
        storage.getAll('records'),
        workout.exerciseMap(),
        storage.getAll('dayLogs'),
        storage.getAll('setLogs'),
        daily.activitySchedule(),
      ])

      sessionStats = new Map()
      weightHistory = new Map()
      const byDate = new Map((await storage.getAll('sessions')).map((session) => [session.id, session.date]))
      const perExercisePerDay = new Map()

      for (const log of setLogs) {
        if (log.isWarmup) continue
        const stats = sessionStats.get(log.sessionId) ?? { volume: 0, sets: 0 }
        const exercise = exercises.get(log.exerciseId)
        const load = (typeof exercise?.notionalLoad === 'number' ? exercise.notionalLoad : 0) + (log.weight ?? 0)
        if (load > 0 && log.reps > 0) stats.volume += load * log.reps
        stats.sets += 1
        sessionStats.set(log.sessionId, stats)

        const date = byDate.get(log.sessionId)
        if (!date || !(load > 0)) continue
        if (!perExercisePerDay.has(log.exerciseId)) perExercisePerDay.set(log.exerciseId, new Map())
        const days = perExercisePerDay.get(log.exerciseId)
        days.set(date, Math.max(days.get(date) ?? 0, load))
      }

      for (const [exerciseId, days] of perExercisePerDay) {
        weightHistory.set(exerciseId, [...days.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, weight]) => weight))
      }

      render()
    },
  }
}
