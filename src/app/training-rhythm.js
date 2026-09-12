/** Positive-only training rhythm derived from completed workout minutes. */

function asUtc(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function iso(date) {
  return date.toISOString().slice(0, 10)
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
 * Four 30-minute days make one strong week. Every five strong weeks banks a
 * keeper; a keeper automatically protects the next quiet completed week.
 * The current week never spends a keeper before it is over.
 */
export function trainingRhythm(minutesByDate, today, options = {}) {
  const minimumMinutes = Math.max(1, Number(options.minimumMinutes) || 30)
  const weeklyDays = Math.max(1, Number(options.weeklyDays) || 4)
  const keeperEvery = Math.max(1, Number(options.keeperEvery) || 5)
  const qualifyingDates = Object.entries(minutesByDate ?? {})
    .filter(([date, minutes]) => date <= today && Number(minutes) >= minimumMinutes)
    .map(([date]) => date)
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
  const firstWeek = qualifyingDates.length ? mondayOf(qualifyingDates[0]) : currentWeek

  for (let week = firstWeek; week <= currentWeek; week = nextWeek(week)) {
    const days = daysByWeek.get(week)?.size ?? 0
    if (days >= weeklyDays) {
      streakWeeks += 1
      keeperProgress += 1
      if (keeperProgress >= keeperEvery) {
        keepers += 1
        keeperProgress = 0
      }
    } else if (week === currentWeek) {
      // A week in progress is opportunity, never a broken streak.
      break
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
    weeklyDays,
    keeperEvery,
    qualifyingDates,
    currentWeek,
    currentWeekDays: daysByWeek.get(currentWeek)?.size ?? 0,
    streakWeeks,
    keepers,
    keeperProgress,
    nextKeeperIn: keeperEvery - keeperProgress,
    protectedWeeks,
  }
}
