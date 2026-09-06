/**
 * Activity model: how non-workout trackers map into a calendar day's data.
 */

export const ACTIVITY_FIELDS = Object.freeze({
  rest_day: { field: 'restDay', entry: 'mark' },
  sleep: { field: 'sleepHours', entry: 'number', mode: 'replace' },
  water: { field: 'waterOz', entry: 'number', mode: 'add' },
  steps: { field: 'steps', entry: 'number', mode: 'replace' },
  micro_cardio: { field: 'microCardioMinutes', entry: 'number', mode: 'add' },
  nutrition_logged: { field: 'nutritionLogged', entry: 'mark' },
  calories_logged: { field: 'calories', entry: 'number', mode: 'add', trackedField: 'caloriesLogged' },
  protein_target: { field: 'proteinGrams', entry: 'number', mode: 'add', scoredField: 'proteinTargetMet' },
  alcohol_free: { field: 'alcoholFree', entry: 'mark' },
  sauna: { field: 'saunaLogged', entry: 'mark' },
  body_metrics: { field: 'bodyMetricsLogged', entry: 'number', mode: 'replace', stores: 'bodyMetrics' },
  mobility: { field: 'mobilityMinutes', entry: 'number', mode: 'add' },
  read: { field: 'readingMinutes', entry: 'number', mode: 'add' },
  study: { field: 'studyMinutes', entry: 'number', mode: 'add' },
  meditate: { field: 'meditationMinutes', entry: 'number', mode: 'add' },
  instrument: { field: 'instrumentMinutes', entry: 'number', mode: 'add' },
  journal: { field: 'journalLogged', entry: 'mark' },
})

const LIKELY_NEXT = [
  'sleep',
  'steps',
  'micro_cardio',
  'nutrition_logged',
  'calories_logged',
  'alcohol_free',
  'water',
  'protein_target',
  'rest_day',
  'sauna',
  'body_metrics',
  'mobility',
  'read',
  'study',
  'meditate',
  'instrument',
  'journal',
]

function positiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function activityValue(activity, day) {
  const spec = ACTIVITY_FIELDS[activity?.id]
  if (!spec || !day) return null
  const value = day[spec.field]
  return value === undefined ? null : value
}

export function isLogged(activity, day) {
  const spec = ACTIVITY_FIELDS[activity?.id]
  if (!spec || !day) return false
  if (spec.entry === 'mark') return day[spec.field] === true
  if (spec.stores === 'bodyMetrics') return day[spec.field] === true
  return typeof day[spec.field] === 'number'
}

export function applyActivity(day, activityId, value = null, options = {}) {
  const spec = ACTIVITY_FIELDS[activityId]
  if (!spec) return day

  if (spec.entry === 'mark') return { ...day, [spec.field]: true }

  const mode = options.mode ?? spec.mode
  const entered = positiveNumber(value)
  if (entered === null) return day

  if (spec.stores === 'bodyMetrics') {
    return {
      ...day,
      [spec.field]: true,
      bodyMetrics: { ...(day.bodyMetrics ?? {}), weight: entered },
    }
  }

  const existing = typeof day[spec.field] === 'number' ? day[spec.field] : 0
  const next = { ...day, [spec.field]: mode === 'add' ? existing + entered : entered }
  return spec.trackedField ? { ...next, [spec.trackedField]: true } : next
}

export function defaultDailyIds(activities) {
  return activities.filter((activity) => activity.daily === true).map((activity) => activity.id)
}

export function partitionByDaily(activities, dailyIds) {
  const wanted = new Set(dailyIds ?? [])
  const sorted = sortActivities(activities)
  return {
    daily: sorted.filter((activity) => wanted.has(activity.id)),
    other: sorted.filter((activity) => !wanted.has(activity.id)),
  }
}

export function sortActivities(activities) {
  const rank = (activity) => {
    const index = LIKELY_NEXT.indexOf(activity.id)
    return index === -1 ? LIKELY_NEXT.length : index
  }
  return [...activities].sort((a, b) => rank(a) - rank(b))
}

export function splitActivities(activities, day) {
  const sorted = sortActivities(activities)
  return {
    outstanding: sorted.filter((activity) => !isLogged(activity, day)),
    logged: sorted.filter((activity) => isLogged(activity, day)),
  }
}
