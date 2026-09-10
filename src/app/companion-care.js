/** Stored-log adapter for the positive-only companion care formula. */

import { COMPANION_CARE } from '../domain/companion-growth.js'

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Count the independently logged lifestyle signals that feed companion care. */
export function companionLifestyleSignals(day) {
  if (!day) return 0
  const values = [
    day.sleepHours,
    day.steps,
    day.waterOz,
    day.proteinGrams,
    day.calories,
    day.microCardioMinutes,
    day.mobilityMinutes,
    day.readingMinutes,
    day.studyMinutes,
    day.meditationMinutes,
    day.instrumentMinutes,
    day.bodyMetrics?.weight,
  ]
  let count = values.filter((value) => hasNumber(value) && value > 0).length
  for (const key of ['nutritionLogged', 'alcoholFree', 'saunaLogged', 'restDay', 'journalLogged']) {
    if (day[key] === true) count += 1
  }
  return count
}

/** The same canonical care total used by Companion and the workout recap. */
export function companionCarePoints({ sessions = [], setLogs = [], days = [] } = {}) {
  const finished = sessions.filter((session) => session?.endedAt).length
  const workingSets = setLogs.filter((set) => set?.isWarmup !== true).length
  const lifestyle = days.reduce((sum, day) => sum + companionLifestyleSignals(day), 0)
  return finished * COMPANION_CARE.trainingSession
    + workingSets * COMPANION_CARE.workingSet
    + lifestyle * COMPANION_CARE.lifestyleSignal
}
