/** Positive-only training rhythm derived from completed workout minutes. */

function asUtc(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false
  const date = asUtc(value)
  return Number.isFinite(date.getTime()) && iso(date) === value
}

export function mondayOf(isoDate) {
  const date = asUtc(isoDate)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  return iso(date)
}

function nextWeek(week) {
  const date = asUtc(week)
  date.setUTCDate(date.getUTCDate() + 7)
  return iso(date)
}

/**
 * Canonical away ranges stored on the profile. Reversed dates are accepted
 * because correcting travel after the fact should not be fussy.
 */
export function normalizeAwayPeriods(periods = []) {
  const seen = new Set()
  return (Array.isArray(periods) ? periods : []).flatMap((period) => {
    if (!validIsoDate(period?.start) || !validIsoDate(period?.end)) return []
    const start = period.start <= period.end ? period.start : period.end
    const end = period.start <= period.end ? period.end : period.start
    const id = typeof period.id === 'string' && period.id
      ? period.id
      : `away_${start}_${end}`
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, start, end }]
  }).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

function awayWeeksFor(periods, today) {
  const weeks = new Set()
  for (const period of normalizeAwayPeriods(periods)) {
    if (period.start > today) continue
    const last = period.end < today ? period.end : today
    for (let week = mondayOf(period.start); week <= mondayOf(last); week = nextWeek(week)) {
      weeks.add(week)
    }
  }
  return weeks
}

/**
 * A training day is 30+ minutes or 6+ working sets (micro sets between calls
 * count). Three training days keep the weekly rhythm active. Four days make a strong
 * week, and every five strong weeks bank a keeper. A keeper automatically
 * protects the next quiet completed week.
 * An away week protects an existing rhythm without spending a keeper, adding
 * workout days, or advancing keeper progress. The current week is never judged
 * before it is over.
 */
export function trainingRhythm(minutesByDate, today, options = {}) {
  const minimumMinutes = Math.max(1, Number(options.minimumMinutes) || 30)
  const minimumSets = Math.max(1, Number(options.minimumSets) || 6)
  const setsByDate = options.setsByDate ?? {}
  const weeklyDays = Math.max(1, Number(options.weeklyDays) || 3)
  const strongWeekDays = Math.max(weeklyDays, Number(options.strongWeekDays) || 4)
  const keeperEvery = Math.max(1, Number(options.keeperEvery) || 5)
  const awayPeriods = normalizeAwayPeriods(options.awayPeriods)
  const awayWeeks = awayWeeksFor(awayPeriods, today)
  const trainedDates = Object.entries(minutesByDate ?? {})
    .filter(([date, minutes]) => date <= today && Number(minutes) > 0)
    .map(([date]) => date)
    .sort()
  const qualifyingDates = [...new Set([...Object.keys(minutesByDate ?? {}), ...Object.keys(setsByDate)])]
    .filter((date) => date <= today
      && (Number(minutesByDate?.[date]) >= minimumMinutes || Number(setsByDate[date]) >= minimumSets))
    .sort()
  const currentWeek = mondayOf(today)
  const daysByWeek = new Map()
  for (const date of qualifyingDates) {
    const week = mondayOf(date)
    if (!daysByWeek.has(week)) daysByWeek.set(week, new Set())
    daysByWeek.get(week).add(date)
  }

  let streakWeeks = 0
  let keepers = 0
  let keeperProgress = 0
  const protectedWeeks = []
  const awayProtectedWeeks = []
  const firstWeek = qualifyingDates.length ? mondayOf(qualifyingDates[0]) : currentWeek

  for (let week = firstWeek; week <= currentWeek; week = nextWeek(week)) {
    const days = daysByWeek.get(week)?.size ?? 0
    if (days >= weeklyDays) {
      streakWeeks += 1
      if (days >= strongWeekDays) {
        keeperProgress += 1
        if (keeperProgress >= keeperEvery) {
          keepers += 1
          keeperProgress = 0
        }
      }
    } else if (week === currentWeek) {
      // A week in progress is opportunity, never a broken streak.
      break
    } else if (awayWeeks.has(week) && streakWeeks > 0) {
      streakWeeks += 1
      awayProtectedWeeks.push(week)
    } else if (streakWeeks > 0 && keepers > 0) {
      keepers -= 1
      streakWeeks += 1
      protectedWeeks.push(week)
    } else {
      streakWeeks = 0
      keeperProgress = 0
    }
  }

  return {
    minimumMinutes,
    minimumSets,
    weeklyDays,
    strongWeekDays,
    keeperEvery,
    trainedDates,
    qualifyingDates,
    currentWeek,
    currentWeekDays: daysByWeek.get(currentWeek)?.size ?? 0,
    currentWeekAway: awayWeeks.has(currentWeek),
    streakWeeks,
    keepers,
    keeperProgress,
    nextKeeperIn: keeperEvery - keeperProgress,
    protectedWeeks,
    awayProtectedWeeks,
    awayPeriods,
  }
}
