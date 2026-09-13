/**
 * Progress ranges can reach farther back than Tempered has recorded data.
 * Keep those unknown days out of statistics instead of treating them as zero.
 */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function usableDate(value, today) {
  return typeof value === 'string'
    && DATE_KEY.test(value)
    && (!today || value <= today)
}

export function progressDataStart({ dayLogs = [], sessions = [], today = null } = {}) {
  const dates = [
    ...dayLogs.map((day) => day?.date),
    ...sessions.filter((session) => session?.endedAt).map((session) => session?.date),
  ].filter((date) => usableDate(date, today))
  return dates.sort()[0] ?? null
}

export function observedProgressDates(dates, dataStart) {
  if (!dataStart) return []
  return dates.filter((date) => date >= dataStart)
}

export function recordedSampleCount(values) {
  return values.filter((value) => typeof value === 'number' && Number.isFinite(value)).length
}
