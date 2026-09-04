/**
 * Vitality — recovery, sleep, fuel, hydration. Mixed derived and marked.
 *
 * The hard rule from `docs/01-attributes-and-xp.md`: the body-weight value is
 * never scored. Not the number, not the direction, not the delta. Only the act
 * of measuring earns anything, and it earns a flat amount. This module never
 * reads `bodyMetrics` — only the `bodyMetricsLogged` boolean.
 *
 * Rest is a rewarded action here, not an absence.
 */

/**
 * Sleep peaks inside the band and tapers outside it in both directions: more is
 * not better. "Near" the band means within an hour of either edge.
 *
 * @param {number} hours
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
export function sleepXp(hours, balance) {
  const vitality = balance.vitality
  const [low, high] = vitality.sleepBandHours
  if (hours >= low && hours <= high) return vitality.sleepXpInBand
  if (hours >= low - 1 && hours <= high + 1) return vitality.sleepXpNearBand
  return vitality.sleepXpOutOfBand
}

/**
 * @param {import('./types.js').DayInput} day
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function vitalityAwards(day, balance) {
  const vitality = balance.vitality
  /** @type {import('./types.js').Award[]} */
  const awards = []

  /** @param {string} source @param {string} label @param {number} xp */
  const add = (source, label, xp) => {
    if (xp > 0) awards.push({ attribute: 'vitality', source, label, xp })
  }

  if (typeof day.sleepHours === 'number' && day.sleepHours > 0) {
    add('vitality.sleep', 'Sleep', sleepXp(day.sleepHours, balance))
  }

  if (typeof day.waterOz === 'number' && day.waterOz > 0) {
    add('vitality.water', 'Hydration',
      Math.min(day.waterOz, vitality.waterDailyCapOz) * vitality.xpPerOunceWater)
  }

  if (day.proteinTargetMet === true) add('vitality.protein', 'Protein target met', vitality.proteinTargetBonus)
  if (day.nutritionLogged === true) add('vitality.nutrition', 'Nutrition logged', vitality.nutritionLoggedXp)
  if (day.restDay === true) add('vitality.rest', 'Rest day taken', vitality.restDayXp)

  // Flat, for the habit. The recorded value is deliberately not consulted.
  if (day.bodyMetricsLogged === true) {
    add('vitality.bodyMetrics', 'Body metrics logged', vitality.bodyMetricsLoggedXp)
  }

  return awards
}
