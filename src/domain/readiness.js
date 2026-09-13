/**
 * A transparent training-readiness estimate from recovery data already stored
 * by Tempered. This is intentionally small and explainable: sleep is scored
 * against the app's 7-9 hour target, while HRV and resting heart rate compare
 * with the user's own recent baseline. Missing signals are omitted.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sleepScore(hours) {
  if (hours < 7) return clamp(100 - ((7 - hours) * 15), 35, 100)
  if (hours > 9) return clamp(100 - ((hours - 9) * 10), 35, 100)
  return 100
}

/**
 * @param {any[]} dayLogs
 * @param {string} today calendar-local YYYY-MM-DD
 */
export function trainingReadiness(dayLogs, today) {
  const eligible = [...(dayLogs ?? [])]
    .filter((day) => day?.date && day.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  const current = eligible.find((day) => day.date === today) ?? null
  const previous = eligible.filter((day) => day.date < today).slice(0, 14)
  const signals = []

  const sleep = numeric(current?.sleepHours)
  if (sleep !== null && sleep > 0) {
    signals.push({ key: 'sleep', label: 'Sleep', value: sleep, score: sleepScore(sleep) })
  }

  const currentHrv = numeric(current?.healthMetrics?.hrvMs)
  const hrvBaselineValues = previous.map((day) => numeric(day?.healthMetrics?.hrvMs)).filter((value) => value !== null)
  if (currentHrv !== null && currentHrv > 0 && hrvBaselineValues.length >= 2) {
    const baseline = average(hrvBaselineValues)
    const score = clamp(70 + (((currentHrv / baseline) - 1) * 150), 35, 100)
    signals.push({ key: 'hrv', label: 'HRV', value: currentHrv, baseline, score })
  }

  const currentResting = numeric(current?.healthMetrics?.restingHr)
  const restingBaselineValues = previous.map((day) => numeric(day?.healthMetrics?.restingHr)).filter((value) => value !== null)
  if (currentResting !== null && currentResting > 0 && restingBaselineValues.length >= 2) {
    const baseline = average(restingBaselineValues)
    const score = clamp(70 + ((baseline - currentResting) * 6), 35, 100)
    signals.push({ key: 'restingHr', label: 'Resting HR', value: currentResting, baseline, score })
  }

  if (signals.length === 0) {
    return { score: null, label: 'Import recovery data', coverage: 'none', signals }
  }

  const score = Math.round(average(signals.map((signal) => signal.score)))
  const coverage = signals.length >= 2 ? 'good' : 'limited'
  const label = coverage === 'limited'
    ? (score >= 65 ? 'Steady' : 'Recover')
    : score >= 82 ? 'Ready' : score >= 65 ? 'Steady' : 'Recover'
  return { score, label, coverage, signals }
}
