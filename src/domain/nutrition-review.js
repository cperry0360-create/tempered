/**
 * Food diary review status is deliberately distinct from nutrition targets.
 * A day is closed ONLY after explicit confirmation. Neither calorie totals nor
 * elapsed time imply completion. Missing entries remain unknown.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function dayBefore(key) {
  if (!DATE.test(String(key))) return null
  let [year, month, day] = key.split('-').map(Number)
  if (day > 1) day -= 1
  else {
    if (month === 1) { year -= 1; month = 12 }
    else month -= 1
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = lengths[month - 1]
  }
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

export function nutritionHasEntry(day) {
  return !!day && (
    (Array.isArray(day.nutritionEntries) && day.nutritionEntries.length > 0)
    || day.nutritionLogged === true || day.caloriesLogged === true
    || typeof day.calories === 'number' || typeof day.proteinGrams === 'number'
  )
}

/** `closed`, `open`, `unlogged`, or `outside` the tracked period. */
export function nutritionDayStatus(day, date, trackingStart, today) {
  if (!DATE.test(String(date)) || date > today) return 'outside'
  if (day?.nutritionStatus === 'complete') return 'closed'
  if (day?.nutritionStatus === 'partial' || nutritionHasEntry(day)) return 'open'
  if (trackingStart && date >= trackingStart) return 'unlogged'
  return 'outside'
}

export function openNutritionDates(days, today, trackingStart) {
  const byDate = new Map((days ?? []).filter((row) => DATE.test(String(row.date)))
    .map((row) => [row.date, row]))
  const loggedDates = [...byDate.keys()].filter((date) =>
    date < today && nutritionHasEntry(byDate.get(date)))
  const earliest = [trackingStart, ...loggedDates].filter((date) => DATE.test(String(date))).sort()[0]
  if (!earliest || earliest >= today) return []
  const dates = []
  // Old logs can reach years back. Never drop or silently close a recorded
  // open day; all are individually reviewable in the backlog.
  for (let day = dayBefore(today); day && day >= earliest; day = dayBefore(day)) {
    const status = nutritionDayStatus(byDate.get(day), day,
      trackingStart && day >= trackingStart ? trackingStart : null, today)
    if (status === 'open' || status === 'unlogged') dates.push({ date: day, status })
  }
  return dates
}
