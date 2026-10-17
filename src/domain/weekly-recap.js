/** Completed calendar-week recap. No I/O, wall clock, or inferred measurements. */
import { trainingScore, explainTrainingScore } from './training-score.js'
import { effectiveLoad } from './records.js'

const monthDays = (year, month) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
const shift = (date, days) => {
  let [year, month, day] = date.split('-').map(Number)
  day += days
  while (day < 1) {
    month -= 1
    if (month < 1) { month = 12; year -= 1 }
    day += monthDays(year, month)
  }
  while (day > monthDays(year, month)) {
    day -= monthDays(year, month); month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function previousWeek(today) {
  const mondayIndex = ((Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000) + 3) % 7 + 7) % 7
  const reset = shift(today, -mondayIndex)
  return { start: shift(reset, -7), end: shift(reset, -1), reset }
}

export function weeklyRecap(input) {
  const { today, sessions = [], setLogs = [], dayLogs = [], exercises = new Map(), trackingStartedOn = null, lastSeenWeek = null } = input
  const range = previousWeek(today)
  const within = date => date >= range.start && date <= range.end
  const finished = sessions.filter(session => session.endedAt && within(session.date))
  const ids = new Set(finished.map(session => session.id))
  const logs = setLogs.filter(log => ids.has(log.sessionId) && !log.isWarmup && log.setType !== 'warmup')
  const days = dayLogs.filter(day => within(day.date)).sort((a, b) => a.date.localeCompare(b.date))
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  const signals = {}
  const keys = ['sleepHours', 'steps', 'waterOz', 'calories', 'proteinGrams', 'mobilityMinutes', 'readingMinutes', 'meditationMinutes', 'studyMinutes', 'instrumentMinutes', 'microCardioMinutes']
  for (const key of [...keys, 'restingHr', 'hrvMs']) {
    const values = days.filter(day => !['calories', 'proteinGrams'].includes(key) || day[key] > 0
      || day.nutritionLogged || day.caloriesLogged || ['partial', 'complete'].includes(day.nutritionStatus) || day.nutritionEntries?.length)
      .map(day => keys.includes(key) ? day[key] : day.healthMetrics?.[key]).filter(valid)
    if (values.length) {
      const total = values.reduce((sum, value) => sum + value, 0)
      signals[key] = { total, average: total / values.length, days: values.length }
    }
  }
  for (const [key, field] of [['cardioMinutes', 'minutes'], ['cardioMiles', 'distanceMiles']]) {
    const samples = days.map(day => (day.cardio ?? []).map(entry => entry[field]).filter(valid)).filter(values => values.length)
    if (samples.length) {
      const total = samples.flat().reduce((sum, value) => sum + value, 0)
      signals[key] = { total, average: total / samples.length, days: samples.length }
    }
  }
  // Match Progress's inputs exactly; profile creation only controls popup eligibility.
  const scores = trainingScore({ ...input, trackingStartedOn: null })
  const score = scores.weeks.find(week => week.week === range.start) ?? { week: range.start, score: null, grade: null, away: false, components: [] }
  const explanation = score.away ? ['Last week was marked away, so it has no training grade. Rest is part of the process.']
    : score.score === null ? ['There is not enough planned training history to grade last week. Your recorded work is shown below.']
      : explainTrainingScore({ ...scores, headline: score, skipped: [] }).sentences
  const starts = [trackingStartedOn, ...sessions.filter(session => session.endedAt).map(session => session.date), ...dayLogs.map(day => day.date), ...(input.programStates ?? []).map(state => state.startedOn)].filter(Boolean)
  return {
    ...range, eligible: starts.some(date => date <= range.end) && (!lastSeenWeek || lastSeenWeek < range.start),
    score, explanation,
    durationSamples: finished.filter(session => valid(session.durationMinutes)).length,
    change: scores.headline?.week === range.start ? scores.change : null,
    training: {
      sessions: finished.length, days: new Set(finished.map(session => session.date)).size, sets: logs.length,
      minutes: finished.reduce((sum, session) => sum + (valid(session.durationMinutes) ? session.durationMinutes : 0), 0),
      volume: logs.reduce((sum, log) => sum + (valid(log.reps) ? effectiveLoad(log, exercises) * log.reps : 0), 0),
    },
    signals, restDays: days.filter(day => day.restDay === true).length,
  }
}
