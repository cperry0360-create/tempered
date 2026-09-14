/** Classify calorie logs so partial days never masquerade as complete days. */
export function calorieLogQuality(day, { today, goal } = {}) {
  const calories = Number(day?.calories)
  if (!Number.isFinite(calories) || calories <= 0) return { state: 'missing', include: false }
  if (day?.nutritionStatus === 'partial') return { state: 'partial', include: false }
  if (day?.nutritionStatus === 'complete') return { state: 'complete', include: true }
  if (day?.date === today) return { state: 'in-progress', include: false }
  const threshold = Number.isFinite(Number(goal)) && Number(goal) > 0 ? Number(goal) * 0.5 : 500
  if (calories < threshold) return { state: 'review', include: false }
  return { state: 'unreviewed', include: true }
}

export function calorieQualitySummary(days, options = {}) {
  const records = (days ?? []).map((day) => ({ day, ...calorieLogQuality(day, options) }))
  return {
    records,
    included: records.filter((record) => record.include),
    excluded: records.filter((record) => !record.include && record.state !== 'missing'),
  }
}
