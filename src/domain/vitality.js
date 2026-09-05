/**
 * Vitality — recovery, sleep, fuel, hydration and deliberate recovery habits.
 * Body-weight values are never scored; only the act of logging body metrics is.
 */

export function sleepXp(hours, balance) {
  const vitality = balance.vitality
  const [low, high] = vitality.sleepBandHours
  if (hours >= low && hours <= high) return vitality.sleepXpInBand
  if (hours >= low - 1 && hours <= high + 1) return vitality.sleepXpNearBand
  return vitality.sleepXpOutOfBand
}

export function vitalityAwards(day, balance) {
  const vitality = balance.vitality
  /** @type {import('./types.js').Award[]} */
  const awards = []

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
  if (day.caloriesLogged === true) add('vitality.calories', 'Calories tracked', vitality.caloriesLoggedXp ?? vitality.nutritionLoggedXp)
  if (day.alcoholFree === true) add('vitality.alcoholFree', 'Alcohol-free day', vitality.alcoholFreeXp ?? 60)
  if (day.restDay === true) add('vitality.rest', 'Rest day taken', vitality.restDayXp)
  if (day.saunaLogged === true) add('vitality.sauna', 'Sauna', vitality.saunaXp ?? 60)

  if (day.bodyMetricsLogged === true) {
    add('vitality.bodyMetrics', 'Body metrics logged', vitality.bodyMetricsLoggedXp)
  }

  return awards
}
