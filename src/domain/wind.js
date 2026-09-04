/**
 * Wind — cardiovascular work. Derived only.
 *
 * Pace improvement is what stops Wind becoming a step-count grind: beating your
 * own rolling baseline pays, so effort counts and not just accumulation.
 */

import { softCap } from './curves.js'

/**
 * Cardio logged with a distance is scored by distance; cardio logged only as
 * time is scored by time. A single run never earns both, which would double-pay
 * the same effort. Minutes on a distance activity are still used for pace.
 *
 * @param {import('./types.js').CardioInput[]} cardio
 * @param {number|null|undefined} steps
 * @param {number|null|undefined} mobilityMinutes
 * @param {number|null|undefined} paceBaselineMinPerMile
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function windAwards(cardio, steps, mobilityMinutes, paceBaselineMinPerMile, balance) {
  const wind = balance.wind
  /** @type {import('./types.js').Award[]} */
  const awards = []

  /** @param {string} source @param {string} label @param {number} xp */
  const add = (source, label, xp) => {
    if (xp > 0) awards.push({ attribute: 'wind', source, label, xp })
  }

  let miles = 0
  let timedMinutes = 0
  let pacedMinutes = 0

  for (const entry of cardio ?? []) {
    const distance = typeof entry.distanceMiles === 'number' ? entry.distanceMiles : 0
    const minutes = typeof entry.minutes === 'number' ? entry.minutes : 0
    if (distance > 0) {
      miles += distance
      if (minutes > 0) pacedMinutes += minutes
    } else if (minutes > 0) {
      timedMinutes += minutes
    }
  }

  add('wind.distance', 'Distance covered',
    softCap(miles, wind.mileSoftCapPerDay, wind.mileCurveBeyondCap) * wind.xpPerMile)

  // Mobility is time-based cardiovascular work and is scored at the same rate.
  const minutesAtRate = timedMinutes + (typeof mobilityMinutes === 'number' ? Math.max(0, mobilityMinutes) : 0)
  add('wind.minutes', 'Cardio minutes', minutesAtRate * wind.xpPerCardioMinute)

  if (typeof steps === 'number' && steps > 0) {
    const counted = Math.min(steps, wind.stepsDailyCap)
    add('wind.steps', 'Steps', (counted / 1000) * wind.xpPerThousandSteps)
  }

  // Beating your own 30-day baseline. Never punishes a slower day.
  if (typeof paceBaselineMinPerMile === 'number' && paceBaselineMinPerMile > 0 && miles > 0 && pacedMinutes > 0) {
    const pace = pacedMinutes / miles
    if (pace < paceBaselineMinPerMile) {
      add('wind.pace', 'Pace improvement', wind.paceImprovementBonus)
    }
  }

  return awards
}
