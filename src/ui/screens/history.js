/**
 * Progress — weekly training volume, personal records, trends, habits, and log.
 */

import { el, replace } from '../dom.js'
import { emptyState } from '../states.js'
import { lbs, volume, duration, shortDate, performance } from '../format.js'
import { ACTIVITY_FIELDS, isLogged } from '../../domain/activities.js'
import { effectiveLoad } from '../../domain/records.js'
import { trainingScore, explainTrainingScore } from '../../domain/training-score.js'
import { estimateOneRepMax } from '../../domain/e1rm.js'
import {
  observedProgressDates,
  progressDataStart,
} from '../../domain/progress-coverage.js'

const RANGES = [7, 30, 90]
const RECOVERY_SIGNALS = [
  { key: 'restingHr', label: 'Resting heart rate', unit: ' bpm', digits: 0 },
  { key: 'hrvMs', label: 'Heart rate variability', unit: ' ms', digits: 1 },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: ' /min', digits: 1 },
  { key: 'spo2', label: 'Blood oxygen', unit: '%', digits: 0 },
]

function parseDate(key) {
  const parts = String(key).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2], 12)
}

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
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
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function numberText(value, digits = 0) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function monthDay(key) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(key))
}

function deltaValue(current, previous, unit, digits = 0) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  const delta = current - previous
  const magnitude = Math.abs(delta) < 0.05 ? 0 : delta
  const sign = magnitude > 0 ? '+' : magnitude < 0 ? '−' : ''
  return sign + numberText(Math.abs(magnitude), digits) + unit
}

function enoughComparisonSamples(currentCount, previousCount, comparable) {
  return comparable && currentCount >= 3 && previousCount >= 3
}

function sparkline(values, width = 112, height = 34) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (clean.length < 2) return null
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const points = clean.map((value, index) => {
    const x = index / (clean.length - 1) * width
    const y = height - ((value - min) / span) * (height - 4) - 2
    return x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
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

function weekStart(key) {
  const date = parseDate(key)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return dateKey(date)
}

function bestSetLabel(best) {
  if (!best) return '—'
  const load = Number.isFinite(best.weight) ? lbs(best.weight) : null
  const reps = Number.isFinite(best.reps) ? String(best.reps) + ' reps' : null
  return [load, reps].filter(Boolean).join(' × ')
}

export function createHistoryScreen({ storage, workout, daily, clock }) {
  const root = el('div.screen.screen--history.screen--progress')
  let view = 'overview'
  let range = 30
  let sessions = []
  let programs = []
  let programStates = []
  let revisions = []
  let selectedScoreComponent = null
  let scoreExplainOpen = false
  let awayPeriods = []
  let records = []
  let exercises = new Map()
  let sessionStats = new Map()
  let dayLogs = []
  let setLogs = []
  let schedule = {}
  let selectedLiftId = null
  let selectedSessionId = null
  let editingDurationId = null
  let reportStatus = ''

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

  function habitCompletionForDay(day) {
    const activities = dailyActivities()
    if (activities.length === 0) return { done: 0, total: 0, percent: 0 }
    const done = activities.filter((activity) => completedActivity(activity, day)).length
    return { done, total: activities.length, percent: Math.round(done / activities.length * 100) }
  }

  function heatmap(days) {
    return el('div.progress-heatmap', { 'aria-label': 'Daily habit completion' }, days.map((day) => {
      const completion = habitCompletionForDay(day)
      return el('span.progress-heatmap__day', {
        title: monthDay(day.date) + ' · ' + completion.percent + '%',
        dataset: { level: String(Math.min(4, Math.ceil(completion.percent / 25))) },
        'aria-label': monthDay(day.date) + ', ' + completion.percent + '% habits complete',
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
    const habitDone = days.reduce((sum, day) => (
      sum + habits.filter((activity) => completedActivity(activity, day)).length
    ), 0)
    const habitRate = opportunities ? Math.round(habitDone / opportunities * 100) : null
    const periodSessions = sessions.filter((session) => dateSet.has(session.date))
    const sessionIds = new Set(periodSessions.map((session) => session.id))
    const periodLogs = setLogs.filter((log) => !log.isWarmup && sessionIds.has(log.sessionId))
    const workingSets = periodLogs.length
    const trainingDays = new Set(periodSessions.map((session) => session.date)).size
    const steps = days.map((day) => day.steps)
    const sleep = days.map((day) => day.sleepHours)
    const avgSteps = average(steps)
    const avgSleep = average(sleep)
    const microMinutes = days.reduce((sum, day) => sum + (day.microCardioMinutes ?? 0), 0)

    const volumeByDate = new Map(days.map((day) => [day.date, 0]))
    for (const log of periodLogs) {
      const date = periodSessions.find((session) => session.id === log.sessionId)?.date
      if (!date) continue
      const load = effectiveLoad(log, exercises)
      if (!Number.isFinite(log.reps) || log.reps <= 0) continue
      volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + load * log.reps)
    }

    const weights = days
      .map((day) => ({ date: day.date, value: day.bodyMetrics?.weight }))
      .filter((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value))
    const latestWeight = weights.at(-1)?.value ?? null
    const recovery = RECOVERY_SIGNALS.map((signal) => ({
      ...signal,
      values: days
        .map((day) => ({ date: day.date, value: day.healthMetrics?.[signal.key] }))
        .filter((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value)),
    }))

    return {
      days,
      periodSessions,
      periodLogs,
      trainingDays,
      workingSets,
      habitRate,
      avgSteps,
      avgSleep,
      microMinutes,
      volumeByDate,
      totalVolume: [...volumeByDate.values()].reduce((sum, value) => sum + value, 0),
      weights,
      latestWeight,
      recovery,
      trackedDays: trackedDates.length,
      requestedDays: dates.length,
      fullCoverage: trackedDates.length === dates.length,
    }
  }

  function weeklySetCounts() {
    const today = clock.today()
    const currentStart = weekStart(today)
    const starts = Array.from({ length: 8 }, (_, index) => addDays(currentStart, (index - 7) * 7))
    const counts = new Map(starts.map((start) => [start, 0]))
    const dateBySession = new Map(sessions.map((session) => [session.id, session.date]))
    for (const log of setLogs) {
      if (log.isWarmup) continue
      const date = dateBySession.get(log.sessionId)
      if (!date) continue
      const start = weekStart(date)
      if (counts.has(start)) counts.set(start, counts.get(start) + 1)
    }
    return starts.map((start) => ({ start, sets: counts.get(start) ?? 0 }))
  }

  function weeklySetsCard() {
    const weeks = weeklySetCounts()
    const max = Math.max(1, ...weeks.map((week) => week.sets))
    const currentStart = weekStart(clock.today())
    return el('section.progress-panel.progress-weekly', {}, [
      el('h2.progress-panel__title', { text: 'Weekly sets' }),
      el('div.progress-weekly__bars', { role: 'img', 'aria-label': 'Working sets per week for the last eight weeks' },
        weeks.map((week) => {
          const active = week.start === currentStart
          const height = Math.round(82 * week.sets / max)
          return el('div.progress-weekly__column', {
            dataset: { sets: String(week.sets), current: String(active) },
            title: monthDay(week.start) + ': ' + week.sets + ' working sets',
            'aria-label': monthDay(week.start) + ': ' + week.sets + ' working sets',
          }, [
            active && el('strong.progress-weekly__value', {
              style: `--bar-height:${height}px`, text: String(week.sets),
            }),
            el('div.progress-weekly__track', {}, [
              el('span.progress-weekly__bar', {
                dataset: { current: String(active), sets: String(week.sets) },
                style: `--bar-height:${height}px`,
              }),
            ]),
          ])
        })),
      el('div.progress-weekly__axis', {}, [
        el('span', { text: monthDay(weeks[0].start) }),
        el('span', { text: monthDay(weeks[7].start) }),
      ]),
    ])
  }

  function prDate(key) {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(parseDate(key))
  }

  function recentPrs() {
    const start = selectedDates()[0]
    return records.map((record) => {
      const exercise = exercises.get(record.exerciseId)
      const name = exercise?.name ?? record.exerciseId
      const weight = record.bestWeight
      if (weight?.date >= start && weight.date <= clock.today()) {
        return {
          date: weight.date,
          text: name + ' · ' + lbs(weight.weight) + ' × ' + weight.reps + ' · ' + prDate(weight.date),
        }
      }
      const e1rm = record.bestE1RM
      if (e1rm?.date >= start && e1rm.date <= clock.today()) {
        return {
          date: e1rm.date,
          text: name + ' · estimated one rep max ' + lbs(e1rm.value) + ' · ' + prDate(e1rm.date),
        }
      }
      const bestVolume = record.bestVolume
      if (bestVolume?.date >= start && bestVolume.date <= clock.today()) {
        return {
          date: bestVolume.date,
          text: name + ' · ' + volume(bestVolume.volume) + ' lb volume · ' + prDate(bestVolume.date),
        }
      }
      return null
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  }

  function recentPrsCard() {
    const rows = recentPrs()
    return el('section.progress-panel', {}, [
      el('h2.progress-panel__title', { text: 'Recent PRs' }),
      rows.length
        ? el('div.progress-prs', {}, rows.map((row) => el('div.progress-prs__row', { text: row.text })))
        : el('p.progress-panel__empty', { text: 'No recent personal records in this range.' }),
    ])
  }

  function trendRow(label, value, delta, values, sampleCount, domain = 'recovery', good = false) {
    const samples = Number.isFinite(sampleCount) ? sampleCount : values.filter(Number.isFinite).length
    return el('div.progress-trend', { dataset: { domain } }, [
      el('div.progress-trend__copy', {}, [
        el('div.progress-trend__meta', {}, [
          el('span.progress-trend__label', { text: label }),
          el('span.progress-trend__samples', { text: samples + ' sample' + (samples === 1 ? '' : 's') }),
        ]),
        el('div.progress-trend__values', {}, [
          el('strong.progress-trend__value', { text: value }),
          delta && el('span.progress-trend__delta', { text: delta, dataset: { good: String(good) } }),
        ]),
      ]),
      sparkline(values, 112, 34),
    ])
  }

  function trendsCard(current, previous, comparable) {
    const latestWeight = current.latestWeight
    const previousWeight = previous.latestWeight
    const weightDelta = enoughComparisonSamples(current.weights.length, previous.weights.length, comparable)
      ? deltaValue(latestWeight, previousWeight, ' lb', 1)
      : null
    const weightTrend = trendRow(
      'Weight',
      latestWeight === null ? '—' : lbs(latestWeight),
      weightDelta,
      current.weights.map((item) => item.value),
      current.weights.length, 'fuel', false,
    )
    const currentStepSamples = current.days.filter((day) => Number.isFinite(day.steps)).length
    const previousStepSamples = previous.days.filter((day) => Number.isFinite(day.steps)).length
    const stepsDelta = enoughComparisonSamples(currentStepSamples, previousStepSamples, comparable)
      ? deltaValue(current.avgSteps, previous.avgSteps, '', 0)
      : null
    const stepsTrend = trendRow(
      'Steps',
      current.avgSteps === null ? '—' : numberText(Math.round(current.avgSteps)) + ' avg',
      stepsDelta,
      current.days.map((day) => day.steps),
      currentStepSamples, 'fuel', current.avgSteps > previous.avgSteps,
    )
    const currentSleepSamples = current.days.filter((day) => Number.isFinite(day.sleepHours)).length
    const previousSleepSamples = previous.days.filter((day) => Number.isFinite(day.sleepHours)).length
    const sleepDelta = enoughComparisonSamples(currentSleepSamples, previousSleepSamples, comparable)
      ? deltaValue(current.avgSleep, previous.avgSleep, ' h', 1)
      : null
    const sleepTrend = trendRow(
      'Sleep',
      current.avgSleep === null ? '—' : numberText(current.avgSleep, 1) + 'h avg',
      sleepDelta,
      current.days.map((day) => day.sleepHours),
      currentSleepSamples, 'recovery', current.avgSleep > previous.avgSleep,
    )
    return el('section.progress-panel', {}, [
      el('h2.progress-panel__title', { text: 'Trends' }),
      el('div.progress-trends', {}, [weightTrend, stepsTrend, sleepTrend]),
    ])
  }

  function recoveryCard(current, previous, comparable) {
    const rows = current.recovery.filter((signal) => signal.values.length > 0)
    if (rows.length === 0) return null
    return el('section.progress-panel', {}, [
      el('h2.progress-panel__title', { text: 'Recovery' }),
      el('div.progress-trends.progress-trends--recovery', {}, rows.map((signal) => {
        const currentValue = signal.values.at(-1)?.value
        const previousValues = previous.recovery.find((item) => item.key === signal.key)?.values ?? []
        const previousValue = previousValues.at(-1)?.value
        const delta = enoughComparisonSamples(signal.values.length, previousValues.length, comparable)
          ? deltaValue(currentValue, previousValue, signal.unit, signal.digits)
          : null
        return trendRow(
          signal.label,
          numberText(currentValue, signal.digits) + signal.unit,
          delta,
          signal.values.map((item) => item.value),
          signal.values.length, 'recovery', signal.key === 'restingHr' ? currentValue < previousValue : ['hrvMs', 'spo2'].includes(signal.key) && currentValue > previousValue,
        )
      })),
    ])
  }

  function coverageLine(current) {
    if (current.fullCoverage || current.trackedDays === 0) return null
    return el('p.progress-footnote', {
      text: 'Showing ' + current.trackedDays + ' of ' + current.requestedDays + ' days since tracking began.',
    })
  }

  function buildProgressReport(current, previous, comparable) {
    const lines = [
      'Tempered progress · last ' + range + ' days ending ' + shortDate(clock.today()),
      'Training: ' + current.periodSessions.length + ' sessions, ' + current.workingSets + ' working sets.',
      'Habits: ' + (current.habitRate === null ? 'no configured daily habits' : current.habitRate + '% complete.'),
      'Steps: ' + (current.avgSteps === null ? 'no samples' : numberText(Math.round(current.avgSteps)) + ' per day.')
        + ' Sleep: ' + (current.avgSleep === null ? 'no samples' : numberText(current.avgSleep, 1) + ' hours average.'),
      'Micro cardio: ' + numberText(current.microMinutes) + ' minutes.',
    ]
    if (current.latestWeight !== null) lines.push('Latest weight: ' + lbs(current.latestWeight) + '.')
    if (comparable && previous.periodSessions.length >= 0) {
      const sessionsDelta = deltaValue(current.periodSessions.length, previous.periodSessions.length, '')
      if (sessionsDelta) lines.push('Sessions versus the prior period: ' + sessionsDelta + '.')
    }
    const signals = current.recovery
      .filter((signal) => signal.values.length)
      .map((signal) => signal.label + ': ' + numberText(signal.values.at(-1).value, signal.digits) + signal.unit)
    if (signals.length) lines.push('Recovery: ' + signals.join(', ') + '.')
    const training = scoreData()
    const scored = training.current
    lines.push('Training score · week of ' + scored.week + ': ' + (scored.score === null ? 'building history' : scored.score + ' / 100 · ' + scored.grade) + (scored.deload ? ' · deload' : '') + '.')
    const week = training.thisWeek
    if (week) lines.push('This week so far: ' + (week.away ? 'away' : week.done + ' of ' + week.due + ' sets due · ' + week.status) + '.')
    lines.push('Score explanation: ' + explainTrainingScore(training).sentences.join(' '))
    if (training.change !== null) lines.push('Score versus prior 4-week average: ' + (training.change > 0 ? '+' : '') + training.change + ' (' + numberText(training.average, 1) + ' average).')
    for (const component of scored.components) lines.push(component.label + ': ' + (component.value === null ? 'not scored' : Math.round(component.value * 100) + '%; ' + numberText(component.weight * 100, 1) + '% weight') + ' · ' + component.reason + '.')
    return lines.join('\n')
  }

  async function copyProgressReport() {
    const current = summaryForDates(selectedDates())
    const previous = summaryForDates(previousDates())
    const comparable = current.fullCoverage && previous.fullCoverage
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await globalThis.navigator.clipboard.writeText(buildProgressReport(current, previous, comparable))
      reportStatus = 'Copied; paste it into ChatGPT when ready.'
    } catch {
      reportStatus = 'Clipboard access is unavailable.'
    }
    render()
  }

  function scoreData() {
    return trainingScore({ today: clock.today(), sessions, setLogs, programs, programStates,
      revisions, exercises, awayPeriods })
  }

  function scoreTrend(weeks) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 320 76')
    svg.setAttribute('class', 'progress-score__trend')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Weekly training scores: ' + weeks.map(w => w.week + ': ' + (w.score ?? 'building history')).join(', '))
    let points = []
    const flush = () => {
      if (!points.length) return
      const line = document.createElementNS(svg.namespaceURI, 'polyline')
      line.setAttribute('points', points.join(' '))
      line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'currentColor'); line.setAttribute('stroke-width', '2')
      svg.append(line); points = []
    }
    weeks.forEach((week, index) => {
      if (week.score === null) { flush(); return }
      const x = weeks.length === 1 ? 160 : 4 + index / (weeks.length - 1) * 312
      const y = 72 - week.score / 100 * 68
      points.push(x + ',' + y)
      const dot = document.createElementNS(svg.namespaceURI, 'circle')
      dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y)); dot.setAttribute('r', '3'); dot.setAttribute('fill', 'currentColor')
      const title = document.createElementNS(svg.namespaceURI, 'title')
      title.textContent = week.week + ': ' + week.score + ' · ' + week.grade + (week.soFar ? ' so far' : '')
      dot.append(title); svg.append(dot)
    })
    flush()
    return svg
  }

  function thisWeekLine(week) {
    if (!week) return null
    const text = week.away ? 'This week: away · not scored'
      : week.due === 0 && week.done === 0 ? 'This week: nothing due yet'
      : `This week: ${week.done} of ${week.due} sets due so far · ${week.status === 'still to do' ? week.remaining + ' still to do' : week.status}${week.ahead ? ' · ' + week.ahead + ' ahead' : ''}`
    return el('p.progress-score__week', { dataset: { status: week.away ? 'away' : week.status }, text })
  }

  function trainingScoreCard() {
    const result = scoreData(), current = result.headline
    const weeks = result.weeks
    return el('section.progress-panel.progress-score', {}, [
      el('div.progress-score__head', {}, [
        el('h2.progress-panel__title', { text: 'Training score' }),
        el('button.progress-score__info', {
          type: 'button', 'aria-label': 'What this score means', dataset: { scoreInfo: 'open' },
          onclick: () => { scoreExplainOpen = true; render() },
        }, ['i']),
      ]),
      el('span.progress-footnote', { text: current ? 'Week of ' + monthDay(current.week) : 'Your first full week will be scored' }),
      el('div.progress-score__summary', {}, [
        el('strong.progress-score__number', { text: current ? current.score + ' · ' + current.grade : 'Building history' }),
        result.change !== null && el('span.progress-score__change', { text: (result.change > 0 ? '+' : '') + result.change + ' vs ' + numberText(result.average, 0) + ' avg' }),
      ].filter(Boolean)),
      thisWeekLine(result.thisWeek),
      weeks.length > 0 && scoreTrend(weeks),
      weeks.length > 0 && el('div.progress-score__axis', {}, [
        el('span', { text: monthDay(weeks[0].week) }),
        el('span', { text: 'Last ' + weeks.length + ' full weeks · 0–100' }),
      ]),
      ...(current?.components ?? []).map(component => el('button.progress-score__component', {
        type: 'button', dataset: { scoreComponent: component.id },
        onclick: () => { selectedScoreComponent = component.id; render() },
      }, [
        el('div.progress-score__head', {}, [
          el('strong', { text: component.label }),
          el('span', { text: component.value === null ? 'Not scored ›' : Math.round(component.value * 100) + '% · ' + Math.round(component.weight * 100) + '% weight ›' }),
        ]),
        el('div.progress-score__bar', {}, [el('span', { style: 'width:' + Math.round((component.value ?? 0) * 100) + '%' })]),
        el('span.progress-score__reason', { text: component.id === 'adherence' && component.prescribed ? component.completed + ' of ' + component.prescribed + ' planned sets · ' + (component.repSets ? Math.round(component.reached / component.repSets * 100) + '% reached rep minimum' : 'no rep samples') : component.reason }),
      ])),
      el('button.progress-score__component.progress-score__weeks-link', {
        type: 'button', dataset: { scoreComponent: 'weeks' },
        onclick: () => { selectedScoreComponent = 'weeks'; render() },
      }, [el('div.progress-score__head', {}, [el('strong', { text: 'Weeks' }), el('span', { text: 'Mark travel or rest ›' })])]),
      scoreExplainOpen && scoreExplainSheet(result),
    ].filter(Boolean))
  }

  function scoreExplainSheet(result) {
    const explanation = explainTrainingScore(result)
    const close = () => { scoreExplainOpen = false; render() }
    return el('div.score-explain', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Training score explained',
      onclick: (event) => { if (event.target === event.currentTarget) close() } }, [
      el('div.score-explain__sheet', {}, [
        el('h2', { text: 'Your training score' }),
        el('p.score-explain__story', { text: explanation.sentences.join(' ') }),
        el('h3', { text: 'How it works' }),
        ...explanation.method.map(line => el('p.score-explain__method', { text: line })),
        el('button.today-button.today-button--primary.score-explain__done', { type: 'button', onclick: close }, ['Done']),
      ]),
    ])
  }

  function scoreWeeksView() {
    const result = scoreData(), sunday = (week) => addDays(week, 6)
    const exact = (week) => awayPeriods.find(p => p.start === week && p.end === sunday(week))
    const overlapping = (week) => awayPeriods.find(p => p.start <= sunday(week) && p.end >= week)
    const rows = [...result.weeks, { week: result.thisWeek?.week, away: result.thisWeek?.away, score: null, current: true }]
      .filter(w => w.week).reverse()
    return [el('button.progress-back', { type: 'button', onclick: () => { selectedScoreComponent = null; render() } }, ['‹ Overview']),
      el('section.progress-panel.progress-score-detail', {}, [
        el('h2.progress-panel__title', { text: 'Weeks' }),
        el('p.progress-footnote', { text: 'Away weeks are left out of the score, the trend, and every average. Rest is part of the plan.' }),
        ...rows.map(w => {
          const own = exact(w.week), other = !own && overlapping(w.week)
          return el('div.progress-score-detail__row.progress-score-week', { dataset: { scoreWeek: w.week } }, [
            el('span', { text: 'Week of ' + monthDay(w.week) + ' · ' + (w.away ? 'away' : w.current ? 'in progress' : w.score === null ? 'not scored' : w.score + ' · ' + w.grade) }),
            other ? el('small', { text: 'Away in Settings' }) : el('button.progress-score-week__toggle', {
              type: 'button', dataset: { awayToggle: w.week },
              onclick: async () => {
                if (own) await workout.removeAwayPeriod(own.id)
                else await workout.addAwayPeriod(w.week, sunday(w.week))
                awayPeriods = await workout.awayPeriods()
                render()
              },
            }, [own ? 'Not away' : 'Mark away']),
          ])
        }),
      ])]
  }

  function trainingScoreDetail() {
    if (selectedScoreComponent === 'weeks') return scoreWeeksView()
    const result = scoreData(), component = result.headline?.components.find(c => c.id === selectedScoreComponent)
    if (!component) { selectedScoreComponent = null; return overviewView() }
    return [el('button.progress-back', { type: 'button', onclick: () => { selectedScoreComponent = null; render() } }, ['‹ Overview']),
      el('section.progress-panel.progress-score-detail', {}, [
        el('h2.progress-panel__title', { text: component.label }),
        el('p.progress-footnote', { text: 'Week of ' + monthDay(result.headline.week) + ' · ' + component.reason }),
        el('p.progress-footnote', { text: component.value === null ? 'Not scored this week; the other parts share its weight.' : Math.round(component.value * 100) + '% · ' + numberText(component.weight * 100, 0) + '% of the score.' }),
        ...component.details.map(detail => el('p.progress-score-detail__row', { text: detail.reason })),
        component.id === 'consistency' && el('p.progress-footnote', { text: 'Days: 70% · weeks reaching the plan: 30%. A training day is 6+ working sets or 30+ minutes, micro sets included.' }),
        component.id === 'adherence' && el('p.progress-footnote', { text: 'Planned sets finished: 70% · sets reaching their rep minimum: 30%. Swaps, leftovers, and single-movement sessions count.' }),
        component.id === 'progression' && el('p.progress-footnote', { text: 'Last 2 weeks against the 4 before: up = 100%, within 1% = 60%, down = 0%.' }),
        component.id === 'volume' && el('p.progress-footnote', { text: 'At least 95% of your recent 4-week average earns full credit.' }),
      ].filter(Boolean))]
  }

  function overviewView() {
    if (selectedScoreComponent) return trainingScoreDetail()
    const current = summaryForDates(selectedDates())
    const previous = summaryForDates(previousDates())
    const comparable = current.fullCoverage && previous.fullCoverage
    const recovery = recoveryCard(current, previous, comparable)
    return [
      trainingScoreCard(),
      weeklySetsCard(),
      coverageLine(current),
      recentPrsCard(),
      trendsCard(current, previous, comparable),
      recovery,
      el('section.progress-report', {}, [
        el('button.progress-report__button', {
          type: 'button',
          onclick: () => { copyProgressReport() },
        }, ['Copy progress report for ChatGPT']),
        reportStatus && el('p.progress-report__status', { role: 'status', text: reportStatus }),
      ]),
    ].filter(Boolean)
  }

  function habitView() {
    const days = selectedDays()
    const activities = dailyActivities()
    if (activities.length === 0) {
      return [emptyState('No daily habits configured', 'Set activities to daily in Settings to build consistency stats.')]
    }
    if (days.length === 0) {
      return [emptyState('No habit history yet', 'Daily habit completion will appear here after you log.')]
    }
    const rows = activities.map((activity) => {
      const values = days.map((day) => completedActivity(activity, day))
      const done = values.filter(Boolean).length
      const percent = Math.round(done / values.length * 100)
      const streak = streaks(values)
      return el('article.progress-habit', { dataset: { habit: activity.id } }, [
        el('div.progress-habit__head', {}, [
          el('div', {}, [
            el('h3.progress-habit__name', { text: activity.short ?? activity.name }),
            el('p.progress-habit__meta', { text: done + ' of ' + values.length + ' days' }),
          ]),
          el('strong.progress-habit__rate', { text: percent + '%' }),
        ]),
        el('div.progress-habit__bar', {}, [
          el('span', { style: 'width:' + percent + '%' }),
        ]),
        el('p.progress-habit__streak', {
          text: (streak.current > 0 ? streak.current + ' day streak · ' : '') + 'Best ' + streak.longest + ' days',
        }),
      ])
    })
    const line = days.length < selectedDates().length
      ? el('p.progress-footnote', { text: 'Showing ' + days.length + ' days since tracking began.' })
      : null
    return [line, ...rows, el('section.progress-panel', {}, [el('h2.progress-panel__title', { text: 'Daily habit completion' }), el('p.progress-footnote', { text: 'One square per day; green means every daily habit is complete.' }), heatmap(days)])].filter(Boolean)
  }

  function liftHistory() {
    const byExercise = new Map()
    const dateBySession = new Map(sessions.map((session) => [session.id, session.date]))
    for (const log of setLogs) {
      if (log.isWarmup) continue
      const date = dateBySession.get(log.sessionId)
      if (!date || !Number.isFinite(log.reps) || log.reps <= 0) continue
      const load = effectiveLoad(log, exercises)
      const estimate = estimateOneRepMax(load, log.reps)
      if (estimate <= 0) continue
      const days = byExercise.get(log.exerciseId) ?? new Map()
      days.set(date, Math.max(days.get(date) ?? 0, estimate))
      byExercise.set(log.exerciseId, days)
    }
    return new Map([...byExercise.entries()].map(([exerciseId, days]) => [
      exerciseId,
      [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value })),
    ]))
  }

  function liftDelta(history) {
    const currentStart = rangeDates(clock.today(), 30)[0]
    const previousStart = addDays(currentStart, -30)
    const previousEnd = addDays(currentStart, -1)
    const currentPeak = Math.max(0, ...history
      .filter((point) => point.date >= currentStart && point.date <= clock.today())
      .map((point) => point.value))
    const previousPeak = Math.max(0, ...history
      .filter((point) => point.date >= previousStart && point.date <= previousEnd)
      .map((point) => point.value))
    if (!currentPeak || !previousPeak) return null
    return deltaValue(currentPeak, previousPeak, ' lb', 1)
  }

  function liftDetail(record, history) {
    const exercise = exercises.get(record.exerciseId)
    const name = exercise?.name ?? record.exerciseId
    const top = record.bestE1RM?.value ?? Math.max(0, ...history.map((point) => point.value))
    return [
      el('button.progress-back', {
        type: 'button',
        onclick: () => { selectedLiftId = null; render() },
      }, ['‹ Lifts']),
      el('section.progress-panel.progress-lift-detail', {}, [
        el('h2.progress-panel__title', { text: name }),
        el('div.progress-lift-detail__stats', {}, [
          record.bestWeight && el('div.progress-lift-detail__stat', {}, [
            el('span', { text: 'Best weight' }),
            el('strong', { text: bestSetLabel(record.bestWeight) }),
          ]),
          record.bestVolume && el('div.progress-lift-detail__stat', {}, [
            el('span', { text: 'Best volume' }),
            el('strong', { text: volume(record.bestVolume.volume) + ' lb' }),
          ]),
          top > 0 && el('div.progress-lift-detail__stat', {}, [
            el('span', { text: 'Estimated one rep max' }),
            el('strong', { text: lbs(top) }),
          ]),
        ].filter(Boolean)),
        el('p.progress-footnote', { text: 'Based on completed working sets.' }),
        el('div.progress-lift-detail__history', {}, history.slice().reverse().map((point) =>
          el('div.progress-lift-detail__row', {}, [
            el('span', { text: shortDate(point.date) }),
            el('span', { text: 'Estimated one rep max' }),
            el('strong', { text: lbs(point.value) }),
          ]))),
      ]),
    ]
  }

  function liftsView() {
    const historyByExercise = liftHistory()
    const liftRecords = records
      .filter((record) => record.bestWeight || record.bestVolume || record.bestE1RM)
      .sort((a, b) => (b.bestE1RM?.value ?? 0) - (a.bestE1RM?.value ?? 0))
    if (selectedLiftId) {
      const selected = liftRecords.find((record) => record.exerciseId === selectedLiftId)
      if (selected) return liftDetail(selected, historyByExercise.get(selectedLiftId) ?? [])
    }
    if (liftRecords.length === 0) {
      return [emptyState('No lifting progress yet', 'Records and trend lines build from working sets.')]
    }
    return liftRecords.map((record) => {
      const exercise = exercises.get(record.exerciseId)
      const name = exercise?.name ?? record.exerciseId
      const history = historyByExercise.get(record.exerciseId) ?? []
      const best = record.bestE1RM?.value ?? Math.max(0, ...history.map((point) => point.value))
      const line = sparkline(history.map((point) => point.value), 98, 30)
      const delta = liftDelta(history)
      return el('button.progress-lift', {
        type: 'button',
        dataset: { record: record.exerciseId },
        'aria-label': name + ', estimated one-rep max ' + lbs(best) + ', 30 day change ' + (delta ?? 'not available'),
        onclick: () => { selectedLiftId = record.exerciseId; render() },
      }, [
        el('div.progress-lift__copy', {}, [
          el('strong.progress-lift__name', { text: name }),
          el('span.progress-lift__e1rm', { text: 'e1RM ' + lbs(best) + ' lb' }),
          delta && el('span.progress-lift__delta', { text: delta, dataset: { good: String(delta.startsWith('+')) }, 'aria-label': '30D change ' + delta }),
        ]),
        line,
      ])
    })
  }

  function durationEditor(session) {
    if (editingDurationId !== session.id) {
      return el('button.progress-action', {
        type: 'button',
        onclick: () => { editingDurationId = session.id; render() },
      }, ['Adjust minutes'])
    }

    const input = el('input.progress-duration__input', {
      type: 'number',
      min: '1',
      max: '240',
      step: '1',
      value: String(Math.round(Number(session.durationMinutes) || 1)),
      'aria-label': 'Correct workout minutes',
    })
    return el('div.progress-duration', {}, [
      input,
      el('button.progress-action', {
        type: 'button',
        onclick: async () => {
          const updated = await workout.adjustSessionDuration(session.id, input.value)
          sessions = sessions.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
          editingDurationId = null
          render()
        },
      }, ['Save']),
      el('button.progress-action', {
        type: 'button',
        onclick: () => { editingDurationId = null; render() },
      }, ['Cancel']),
    ])
  }

  function daySessions(date) {
    return sessions.filter((session) => session.date === date)
  }

  function dayName(date) {
    const entries = daySessions(date)
    const names = [...new Set(entries.map((session) => {
      const programDay = programs.filter((program) => !session.programId || program.id === session.programId).flatMap((program) => program.days ?? []).find((day) => day.id === session.programDayId)
      return session.routineName ?? (session.programDayId ? session.title ?? programDay?.name : null) ?? null
    }).filter(Boolean))]
    if (names.length) return names.join(' · ')
    const ids = new Set(entries.map((session) => session.id))
    const movements = new Set(setLogs.filter((log) => ids.has(log.sessionId)).map((log) => log.exerciseId)).size
    return `Micro sets · ${movements} ${movements === 1 ? 'movement' : 'movements'}`
  }

  function dayStats(date) {
    return daySessions(date).reduce((total, session) => {
      const stats = sessionStats.get(session.id) ?? { sets: 0, volume: 0 }
      return { sets: total.sets + stats.sets, volume: total.volume + stats.volume,
        minutes: total.minutes + (Number(session.durationMinutes) || 0) }
    }, { sets: 0, volume: 0, minutes: 0 })
  }

  function sessionSetRows(date) {
    const ids = new Set(daySessions(date).map((session) => session.id))
    const groups = new Map()
    for (const log of setLogs.filter((row) => ids.has(row.sessionId)).sort((a, b) =>
      String(a.completedAt ?? '').localeCompare(String(b.completedAt ?? '')) || (a.setIndex ?? 0) - (b.setIndex ?? 0))) {
      // Keep method variants and warmups visible rather than mixing unlike loads.
      const key = `${log.exerciseId}:${log.method ?? ''}`
      const group = groups.get(key) ?? { exerciseId: log.exerciseId, method: log.method, values: [] }
      const load = effectiveLoad(log, exercises)
      const performed = performance({ ...log, weight: load > 0 ? load : null })
      group.values.push(performed + (log.isWarmup ? ' (warm-up)' : ''))
      groups.set(key, group)
    }
    return [...groups.values()].map((group) => el('div.progress-session-detail__set', {}, [
      el('span', { text: (exercises.get(group.exerciseId)?.name ?? group.exerciseId) + (group.method ? ` · ${group.method}` : '') }),
      el('strong', { text: group.values.join(', ') }),
    ]))
  }

  function sessionDetail(session) {
    const date = session.date
    const stats = dayStats(date)
    const entries = daySessions(date)
    return [
      el('button.progress-back', {
        type: 'button', onclick: () => { selectedSessionId = null; editingDurationId = null; render() },
      }, ['‹ Log']),
      el('section.progress-panel.progress-session-detail', {}, [
        el('h2.progress-panel__title', { text: dayName(date) }),
        el('p.progress-session-detail__date', { text: shortDate(date) }),
        el('p.progress-session-detail__summary', { text: [stats.minutes ? duration(stats.minutes) : null,
          `${stats.sets} sets`, volume(stats.volume) + ' lb'].filter(Boolean).join(' · ') }),
        el('div.progress-session-detail__sets', {}, sessionSetRows(date)),
        ...entries.map((entry) => el('div.progress-session-detail__duration', {}, [
          el('p.progress-footnote', { text: `${entry.routineName ?? 'Session'} · ${entry.startedAt ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.startedAt)) : entry.id} · ${entry.durationMinutes ?? 0} min` }),
          durationEditor(entry),
        ])),
      ]),
    ]
  }

  function logView() {
    if (selectedSessionId) {
      const selected = sessions.find((session) => session.id === selectedSessionId)
      if (selected) return sessionDetail(selected)
    }
    const dates = new Set(selectedDates())
    const period = sessions.filter((session) => dates.has(session.date))
    if (period.length === 0) return [emptyState('No training in this range', 'Completed workouts will appear here.')]
    return [...new Set(period.map((session) => session.date))].map((date) => {
      const session = period.find((entry) => entry.date === date)
      const stats = dayStats(date)
      return el('button.progress-log-row', {
        type: 'button', dataset: { session: session.id, date },
        onclick: () => { selectedSessionId = session.id; render() },
      }, [
        el('div.progress-log-row__head', {}, [
          el('strong.progress-log-row__name', { text: dayName(date) }),
          el('span.progress-log-row__date', { text: shortDate(date) }),
        ]),
        el('span.progress-log-row__meta', { text: [stats.minutes ? duration(stats.minutes) : null,
          `${stats.sets} sets`, volume(stats.volume) + ' lb'].filter(Boolean).join(' · ') }),
      ])
    })
  }

  function render() {
    const viewContent = view === 'overview' ? overviewView()
      : view === 'habits' ? habitView()
        : view === 'lifts' ? liftsView()
          : logView()

    replace(root, [
      el('header.progress-header', {}, [
        el('h1.screen__title', { text: 'Progress' }),
        el('label.progress-range', {}, [
          el('span.progress-range__label', { text: 'Range' }),
          el('select.progress-range__select', {
            'aria-label': 'Progress range',
            onchange: (event) => { range = Number(event.target.value); selectedLiftId = null; selectedSessionId = null; render() },
          }, RANGES.map((days) => el('option', { value: String(days), selected: days === range }, [days + 'D']))),
        ]),
      ]),
      el('div.segmented.progress-views', { role: 'group', 'aria-label': 'Progress sections' }, [
        ['overview', 'Overview'], ['lifts', 'Lifts'], ['habits', 'Habits'], ['log', 'Log'],
      ].map(([name, label]) => el('button.segmented__option', {
        type: 'button',
        dataset: { view: name, active: String(view === name) },
        'aria-pressed': String(view === name),
        onclick: () => { selectedScoreComponent = null; view = name; selectedLiftId = null; selectedSessionId = null; render() },
      }, [label]))),
      el('div.progress-content', {}, viewContent),
    ])
  }

  return {
    root,
    async refresh() {
      ;[programs, programStates, revisions] = await Promise.all([storage.getAll('programs'), storage.getAll('programState'), storage.getAll('programRevisions')])
      const routines = new Map((await storage.getAll('routines')).map((routine) => [routine.id, routine]))
      sessions = (await storage.getAll('sessions'))
        .filter((session) => session.endedAt)
        .map((session) => ({ ...session, routineName: session.routineName ?? routines.get(session.routineId)?.name }))
        .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))

      awayPeriods = workout.awayPeriods ? await workout.awayPeriods() : []
      ;[records, exercises, dayLogs, setLogs, schedule] = await Promise.all([
        storage.getAll('records'),
        workout.exerciseMap(),
        storage.getAll('dayLogs'),
        storage.getAll('setLogs'),
        daily.activitySchedule(),
      ])

      sessionStats = new Map()
      for (const log of setLogs) {
        if (log.isWarmup) continue
        const stats = sessionStats.get(log.sessionId) ?? { volume: 0, sets: 0 }
        const load = effectiveLoad(log, exercises)
        if (load > 0 && log.reps > 0) stats.volume += load * log.reps
        stats.sets += 1
        sessionStats.set(log.sessionId, stats)
      }
      render()
    },
  }
}
