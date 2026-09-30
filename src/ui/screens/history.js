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
  let editingDurationId = null

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

  function summaryForDates(dates) {
    const dataStart = progressDataStart({ dayLogs, sessions, today: clock.today() })
    const trackedDates = observedProgressDates(dates, dataStart)
    const days = daysForDates(trackedDates)
    const dateSet = new Set(trackedDates)
    const periodSessions = sessions.filter((session) => dateSet.has(session.date))
    const sessionIds = new Set(periodSessions.map((session) => session.id))
    const workingSets = setLogs.filter((log) => !log.isWarmup && sessionIds.has(log.sessionId)).length
    const avgSteps = average(days.map((day) => day.steps))
    const avgSleep = average(days.map((day) => day.sleepHours))
    const weights = days
      .map((day) => ({ date: day.date, value: day.bodyMetrics?.weight }))
      .filter((entry) => typeof entry.value === 'number')
    const latestWeight = weights.at(-1)?.value ?? null
    const firstWeight = weights[0]?.value ?? null
    const weightChange = latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null
    return { days, periodSessions, workingSets, avgSteps, avgSleep, weights, latestWeight, weightChange }
  }

  function percentDelta(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
    return ((current - previous) / Math.abs(previous)) * 100
  }

  function signed(value, suffix = '') {
    if (!Number.isFinite(value)) return '—'
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10
    return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
  }

  function weekStart(key) {
    const date = parseDate(key)
    const offset = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offset)
    return dateKey(date)
  }

  function weeklySets() {
    const today = clock.today()
    const currentStart = weekStart(today)
    const starts = Array.from({ length: 8 }, (_, index) => addDays(currentStart, (index - 7) * 7))
    const counts = new Map(starts.map((key) => [key, 0]))
    const sessionDates = new Map(sessions.map((session) => [session.id, session.date]))
    for (const log of setLogs) {
      if (log.isWarmup) continue
      const date = sessionDates.get(log.sessionId)
      if (!date) continue
      const startKey = weekStart(date)
      if (counts.has(startKey)) counts.set(startKey, counts.get(startKey) + 1)
    }
    return starts.map((key, index) => ({ key, count: counts.get(key) ?? 0, current: index === starts.length - 1 }))
  }

  function weeklySetsCard() {
    const weeks = weeklySets()
    const max = Math.max(1, ...weeks.map((week) => week.count))
    const label = (key) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(key))
    return el('section.progress-r5__card.progress-r5__weekly', {}, [
      el('h2.progress-r5__card-title', { text: 'Weekly sets' }),
      el('div.progress-r5__bars', { 'aria-label': 'Working sets over the last eight weeks' }, weeks.map((week) =>
        el('div.progress-r5__bar-slot', { dataset: { current: String(week.current) } }, [
          week.current && el('strong.progress-r5__bar-value', { text: String(week.count) }),
          el('span.progress-r5__bar', { style: `height:${Math.max(4, Math.round((week.count / max) * 112))}px` }),
        ]))),
      el('div.progress-r5__axis', {}, [
        el('span', { text: label(weeks[0].key) }),
        el('span', { text: label(weeks.at(-1).key) }),
      ]),
    ])
  }

  function recentPrsCard() {
    const recent = records
      .filter((record) => record.bestE1RM?.date || record.bestWeight?.date)
      .sort((a, b) => String(b.bestE1RM?.date ?? b.bestWeight?.date ?? '').localeCompare(String(a.bestE1RM?.date ?? a.bestWeight?.date ?? '')))
      .slice(0, 3)
    return el('section.progress-r5__card', {}, [
      el('h2.progress-r5__card-title', { text: 'Recent PRs' }),
      recent.length
        ? el('div.progress-r5__rows', {}, recent.map((record) => {
            const best = record.bestE1RM
            const exercise = exercises.get(record.exerciseId)
            return el('div.progress-r5__row', {}, [
              el('div.progress-r5__row-copy', {}, [
                el('strong', { text: exercise?.name ?? record.exerciseId }),
                el('span', { text: shortDate(best?.date ?? record.bestWeight?.date) }),
              ]),
              el('strong.progress-r5__row-value', { text: best ? `${Math.round(best.value)} e1RM` : bestSetLabel(record.bestWeight) }),
            ])
          }))
        : el('p.progress-r5__empty', { text: 'No PRs in this range' }),
    ])
  }

  function trendRow(label, value, delta, values, direction = 'neutral') {
    const line = sparkline(values, 92, 28)
    if (line) line.classList.add('progress-r5__spark')
    return el('div.progress-r5__trend', { dataset: { direction } }, [
      el('div.progress-r5__row-copy', {}, [
        el('strong', { text: label }),
        el('span', { text: delta }),
      ]),
      el('strong.progress-r5__trend-value', { text: value }),
      line,
    ])
  }

  function trendsCard() {
    const current = summaryForDates(selectedDates())
    const previous = summaryForDates(previousDates())
    const weights = current.weights.map((entry) => entry.value)
    const steps = current.days.map((day) => day.steps).filter(Number.isFinite)
    const sleep = current.days.map((day) => day.sleepHours).filter(Number.isFinite)
    return el('section.progress-r5__card', {}, [
      el('h2.progress-r5__card-title', { text: 'Trends' }),
      el('div.progress-r5__rows', {}, [
        trendRow(
          'Weight',
          current.latestWeight === null ? '—' : `${current.latestWeight.toFixed(1)} lb`,
          current.weightChange === null ? 'No change yet' : `${signed(current.weightChange, ' lb')} in range`,
          weights,
        ),
        trendRow(
          'Steps',
          current.avgSteps === null ? '—' : compactNumber(Math.round(current.avgSteps)),
          signed(percentDelta(current.avgSteps, previous.avgSteps), '%'),
          steps,
          Number.isFinite(current.avgSteps) && Number.isFinite(previous.avgSteps) && current.avgSteps > previous.avgSteps ? 'good' : 'neutral',
        ),
        trendRow(
          'Sleep',
          current.avgSleep === null ? '—' : `${current.avgSleep.toFixed(1)} h`,
          signed(percentDelta(current.avgSleep, previous.avgSleep), '%'),
          sleep,
          Number.isFinite(current.avgSleep) && Number.isFinite(previous.avgSleep) && current.avgSleep > previous.avgSleep ? 'good' : 'neutral',
        ),
      ]),
    ])
  }

  function recoveryCard() {
    const today = dayLogs.find((day) => day.date === clock.today())
    const values = [
      ['Sleep', Number.isFinite(today?.sleepHours) ? `${today.sleepHours.toFixed(1)} h` : null],
      ['Resting HR', Number.isFinite(today?.healthMetrics?.restingHr) ? `${Math.round(today.healthMetrics.restingHr)} bpm` : null],
      ['Hrv', Number.isFinite(today?.healthMetrics?.hrvMs) ? `${Math.round(today.healthMetrics.hrvMs)} ms` : null],
      ['Respiration', Number.isFinite(today?.healthMetrics?.respRate) ? `${today.healthMetrics.respRate.toFixed(1)} / min` : null],
    ].filter(([, value]) => value !== null)
    if (!values.length) return null
    return el('section.progress-r5__card', {}, [
      el('h2.progress-r5__card-title', { text: 'Recovery' }),
      el('div.progress-r5__recovery', {}, values.map(([label, value]) => el('div', {}, [
        el('strong', { text: value }),
        el('span', { text: label }),
      ]))),
    ])
  }

  function copyProgressReport() {
    const current = summaryForDates(selectedDates())
    const text = [
      'Use this Tempered app data to give me a concise training progress report and practical coaching tips.',
      '',
      'TEMPERED_DATA',
      `DATE=${clock.today()}`,
      `RANGE_DAYS=${range}`,
      `SESSIONS=${current.periodSessions.length}`,
      `WORKING_SETS=${current.workingSets}`,
      `SLEEP_AVG=${current.avgSleep === null ? '' : current.avgSleep.toFixed(1)}`,
      `STEPS_AVG=${current.avgSteps === null ? '' : Math.round(current.avgSteps)}`,
      `WEIGHT_CHANGE_LB=${current.weightChange === null ? '' : current.weightChange.toFixed(1)}`,
    ].join('\\n')
    navigator.clipboard?.writeText?.(text).catch(() => {})
  }

  function overviewView() {
    return [
      weeklySetsCard(),
      recentPrsCard(),
      trendsCard(),
      recoveryCard(),
      el('button.progress-r5__report', { type: 'button', onclick: copyProgressReport }, ['Copy progress report for ChatGPT']),
    ].filter(Boolean)
  }

  function habitsView() {
    const days = selectedDays()
    const activities = dailyActivities()
    if (activities.length === 0) return [emptyState('No daily habits configured', 'Set activities in Settings to build consistency stats.')]
    if (days.length === 0) return [emptyState('No habit history yet', 'Consistency starts with your first logged day.')]
    return activities.map((activity) => {
      const values = days.map((day) => completedActivity(activity, day))
      const done = values.filter(Boolean).length
      const percent = Math.round((done / values.length) * 100)
      const streak = streaks(values)
      return el('article.progress-r5__habit', { dataset: { habit: activity.id } }, [
        el('div.progress-r5__habit-head', {}, [
          el('div.progress-r5__row-copy', {}, [
            el('strong', { text: activity.short ?? activity.name }),
            el('span', { text: `${done} of ${values.length} days · ${streak.current} current · ${streak.longest} best` }),
          ]),
          el('strong.progress-r5__habit-rate', { text: `${percent}%` }),
        ]),
        el('div.progress-r5__habit-track', {}, [el('span', { style: `width:${percent}%` })]),
      ])
    })
  }

  function liftTrend(record) {
    const values = weightHistory.get(record.exerciseId) ?? []
    const line = sparkline(values, 88, 28)
    if (line) line.classList.add('progress-r5__spark')
    const recent = values.slice(-2)
    const delta = recent.length > 1 ? recent.at(-1) - recent.at(-2) : null
    return { line, delta }
  }

  function liftsView() {
    const withRecords = records.filter((record) => record.bestE1RM)
    if (!withRecords.length) return [emptyState('No lifting progress yet', 'Working sets build lift trends automatically.')]
    return withRecords
      .sort((a, b) => (b.bestE1RM?.value ?? 0) - (a.bestE1RM?.value ?? 0))
      .map((record) => {
        const exercise = exercises.get(record.exerciseId)
        const trend = liftTrend(record)
        return el('button.progress-r5__lift', { type: 'button', dataset: { record: record.exerciseId } }, [
          el('div.progress-r5__row-copy', {}, [
            el('strong', { text: exercise?.name ?? record.exerciseId }),
            el('span', { text: trend.delta === null ? 'No 30D change yet' : `${signed(trend.delta, ' lb')} in 30D` }),
          ]),
          el('strong.progress-r5__lift-value', { text: `${Math.round(record.bestE1RM.value)} e1RM` }),
          trend.line,
        ])
      })
  }

  function durationEditor(session) {
    if (editingDurationId !== session.id) {
      return el('button.actionpill', {
        type: 'button',
        dataset: { adjustDuration: session.id },
        onclick: () => { editingDurationId = session.id; render() },
      }, ['Adjust minutes'])
    }
    const input = el('input.today-editor__input', {
      type: 'number', min: '1', max: '240', step: '1',
      value: String(Math.round(Number(session.durationMinutes) || 1)),
      'aria-label': 'Correct workout minutes',
    })
    return el('div.historyrow__duration-editor', {}, [
      input,
      el('button.today-editor__save', {
        type: 'button',
        onclick: async () => {
          const updated = await workout.adjustSessionDuration(session.id, input.value)
          sessions = sessions.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
          editingDurationId = null
          render()
        },
      }, ['Save']),
      el('button.actionpill', { type: 'button', onclick: () => { editingDurationId = null; render() } }, ['Cancel']),
    ])
  }

  function sessionsView() {
    const dates = new Set(selectedDates())
    const period = sessions.filter((session) => dates.has(session.date))
    if (!period.length) return [emptyState('No training in this range', 'Completed workouts appear here.')]
    return period.map((session) => {
      const stats = sessionStats.get(session.id) ?? { volume: 0 }
      const open = editingDurationId === session.id
      return el('article.card.historyrow', { dataset: { session: session.id } }, [
        el('button.historyrow__open', {
          type: 'button',
          'aria-expanded': String(open),
          onclick: () => { editingDurationId = open ? null : session.id; render() },
        }, [
          el('div', {}, [
            el('h3.historyrow__name', { text: session.routineName ?? session.routineId ?? 'Training day' }),
            el('p.historyrow__meta', { text: [
              session.durationMinutes ? duration(session.durationMinutes) : null,
              `${stats.sets ?? 0} sets`,
              shortDate(session.date),
            ].filter(Boolean).join(' · ') }),
          ]),
          el('span.historyrow__chevron', { text: open ? '⌄' : '›', 'aria-hidden': 'true' }),
        ]),
        open && el('div.historyrow__detail', {}, [
          el('span', { text: `${volume(stats.volume)} lbs moved` }),
          durationEditor(session),
        ]),
      ])
    })
  }

  function render() {
    const viewContent = view === 'overview' ? overviewView()
      : view === 'habits' ? habitsView()
        : view === 'lifts' ? liftsView()
          : sessionsView()

    replace(root, [
      el('header.progress-r5__header', {}, [
        el('h1.screen__title', { text: 'Progress' }),
        el('label.progress-r5__range', {}, [
          el('span.sr-only', { text: 'Time range' }),
          el('select', {
            value: String(range),
            'aria-label': 'Time range',
            onchange: (event) => { range = Number(event.target.value); render() },
          }, [7, 30, 90].map((days) => el('option', { value: String(days), selected: days === range }, [`${days}D`]))),
        ]),
      ]),
      el('div.segmented.progress-r5__segments', { role: 'group', 'aria-label': 'Progress view' }, [
        ['overview', 'Overview'], ['lifts', 'Lifts'], ['habits', 'Habits'], ['log', 'Log'],
      ].map(([name, label]) => el('button.segmented__option', {
        type: 'button',
        dataset: { view: name, active: String(view === name) },
        'aria-pressed': String(view === name),
        onclick: () => { view = name; render() },
      }, [label]))),
      el('div.progress-r5__content', {}, viewContent),
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
      records = records.map((record) => ({ ...record, bestE1RM: record.bestE1RM ?? record.bestE1rm ?? null }))

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
