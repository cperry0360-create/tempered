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

/** Plain-word status per signal. `low` marks what is pulling readiness down. */
function sleepStatus(hours) {
  if (hours < 7) return { text: 'Short', tone: 'low' }
  if (hours > 9) return { text: 'Long', tone: 'usual' }
  return { text: 'On target', tone: 'good' }
}

function hrvStatus(current, baseline) {
  const ratio = current / baseline
  if (ratio >= 1.05) return { text: 'Above normal', tone: 'good' }
  if (ratio >= 0.9) return { text: 'Normal', tone: 'usual' }
  return { text: 'Below normal', tone: 'low' }
}

function restingStatus(current, baseline) {
  const difference = current - baseline
  if (difference <= -2) return { text: 'Lower', tone: 'good' }
  if (difference >= 3) return { text: 'Elevated', tone: 'low' }
  return { text: 'Normal', tone: 'usual' }
}

/** What each signal is called mid-sentence, and how it reads on its own. */
const NAMES = { sleep: 'sleep', hrv: 'HRV', restingHr: 'resting HR' }
const PHRASES = {
  sleep: { 'On target': 'sleep is on target', Short: 'sleep was short', Long: 'sleep ran long' },
  hrv: { 'Above normal': 'HRV is above your normal', Normal: 'HRV is at your normal', 'Below normal': 'HRV is below your normal' },
  restingHr: { Lower: 'resting HR is lower than normal', Normal: 'resting HR is at your normal', Elevated: 'resting HR is elevated' },
}

const list = (items) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
const sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** One sentence: what is pulling readiness down, or that nothing is. */
function readinessReason(signals, label) {
  if (signals.length === 3) {
    const low = signals.filter((signal) => signal.status.tone === 'low')
    if (low.length === 0) {
      return label === 'Ready'
        ? 'Sleep, HRV and resting HR are all at or better than your normal.'
        : 'Sleep, HRV and resting HR are close to your normal.'
    }
    const fine = signals.filter((signal) => signal.status.tone !== 'low').map((signal) => NAMES[signal.key])
    const pulling = list(low.map((signal) => PHRASES[signal.key][signal.status.text]))
    return sentence(fine.length ? `${pulling}; ${list(fine)} ${fine.length === 1 ? 'looks' : 'look'} fine.` : `${pulling}.`)
  }
  const present = sentence(list(signals.map((signal) => PHRASES[signal.key][signal.status.text]))) + '.'
  const missing = ['sleep', 'hrv', 'restingHr'].filter((key) => !signals.some((signal) => signal.key === key))
  const pending = missing.filter((key) => key !== 'sleep')
  const notes = []
  if (pending.length) notes.push(`${sentence(list(pending.map((key) => NAMES[key])))} ${pending.length === 1 ? 'needs' : 'need'} a few days of history first.`)
  if (missing.includes('sleep')) notes.push('Import last night\'s sleep to include it.')
  return [present, ...notes].join(' ')
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
    signals.push({ key: 'sleep', label: 'Sleep', value: sleep, unit: 'h', detail: `${sleep.toFixed(1)} h last night`, score: sleepScore(sleep), status: sleepStatus(sleep) })
  }

  const currentHrv = numeric(current?.healthMetrics?.hrvMs)
  const hrvBaselineValues = previous.map((day) => numeric(day?.healthMetrics?.hrvMs)).filter((value) => value !== null)
  if (currentHrv !== null && currentHrv > 0 && hrvBaselineValues.length >= 2) {
    const baseline = average(hrvBaselineValues)
    const score = clamp(70 + (((currentHrv / baseline) - 1) * 150), 35, 100)
    signals.push({ key: 'hrv', label: 'HRV', value: currentHrv, baseline, unit: 'ms', detail: `${Math.round(currentHrv)} ms vs ${Math.round(baseline)} baseline`, score, status: hrvStatus(currentHrv, baseline) })
  }

  const currentResting = numeric(current?.healthMetrics?.restingHr)
  const restingBaselineValues = previous.map((day) => numeric(day?.healthMetrics?.restingHr)).filter((value) => value !== null)
  if (currentResting !== null && currentResting > 0 && restingBaselineValues.length >= 2) {
    const baseline = average(restingBaselineValues)
    const score = clamp(70 + ((baseline - currentResting) * 6), 35, 100)
    signals.push({ key: 'restingHr', label: 'Resting HR', value: currentResting, baseline, unit: 'bpm', detail: `${Math.round(currentResting)} bpm vs ${Math.round(baseline)} baseline`, score, status: restingStatus(currentResting, baseline) })
  }

  if (signals.length === 0) {
    return { score: null, label: 'Import recovery data', action: 'Log recovery data', coverage: 'none', signals,
      reason: 'HRV and resting HR need a few days of history before Tempered can compare them with your normal.' }
  }

  const score = Math.round(average(signals.map((signal) => signal.score)))
  const coverage = signals.length >= 2 ? 'good' : 'limited'
  const label = coverage === 'limited'
    ? (score >= 65 ? 'Steady' : 'Recover')
    : score >= 82 ? 'Ready' : score >= 65 ? 'Steady' : 'Recover'
  const action = label === 'Ready' ? 'Train as planned'
    : label === 'Steady' ? 'Train as planned; ease off if heavy'
      : 'Go lighter or make it a recovery day'
  return { score, label, action, coverage, signals, reason: readinessReason(signals, label) }
}
