/**
 * Might — heavy resistance training. Derived only: it responds to load, never to
 * attendance. Checking "I lifted" earns nothing here; the Grit module handles
 * showing up.
 *
 * Exercise classification (compound vs isolation) comes from
 * `data/exercises.json`, never from a list in code.
 */

import { volumeByExercise, detectRecords, workingSets } from './records.js'
import { softCap } from './curves.js'

/**
 * The rate an exercise's contribution counts at. Compound counts fully,
 * isolation at the reduced rate in balance.json. Applied consistently to every
 * Might source, so the mapping stays legible: an isolation lift is worth less
 * than a compound one, whichever way it earns.
 *
 * @param {string} exerciseId
 * @param {import('./types.js').SessionContext} context
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
function classMultiplier(exerciseId, context, balance) {
  const exercise = context.exercises.get(exerciseId)
  return exercise?.class === 'isolation' ? balance.might.isolationMultiplier : 1
}

/**
 * @param {import('./types.js').SessionInput} session
 * @param {import('./types.js').SessionContext} context
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function mightAwards(session, context, balance) {
  const might = balance.might
  /** @type {import('./types.js').Award[]} */
  const awards = []

  /** @param {string} source @param {string} label @param {number} xp */
  const add = (source, label, xp) => {
    if (xp > 0) awards.push({ attribute: 'might', source, label, xp })
  }

  // Working volume, class-weighted, then softly capped so junk volume cannot
  // outscore hard work.
  let effectiveVolume = 0
  for (const [exerciseId, volume] of volumeByExercise(session.sets)) {
    effectiveVolume += volume * classMultiplier(exerciseId, context, balance)
  }
  const scoredVolume = softCap(effectiveVolume, might.volumeSoftCapLbs, might.volumeCurveBeyondCap)
  add('might.volume', 'Working volume', (scoredVolume / 1000) * might.xpPerThousandLbsVolume)

  // Loaded carries are scored as load over distance, not as reps.
  let carryUnits = 0
  for (const set of workingSets(session.sets)) {
    if (context.exercises.get(set.exerciseId)?.metric !== 'distance') continue
    if (typeof set.weight !== 'number' || typeof set.distance !== 'number') continue
    if (set.weight <= 0 || set.distance <= 0) continue
    carryUnits += set.weight * (set.distance / 100) * classMultiplier(set.exerciseId, context, balance)
  }
  add('might.carry', 'Loaded carries', carryUnits * might.carryXpPerLbPerHundredFeet)

  const detected = detectRecords(session.sets, context.records)

  let weightPrXp = 0
  for (const pr of detected.weightPrs) {
    weightPrXp += might.weightPrBonus * classMultiplier(pr.exerciseId, context, balance)
  }
  add('might.weightPr', detected.weightPrs.length === 1 ? 'Weight PR' : 'Weight PRs', weightPrXp)

  let volumePrXp = 0
  for (const pr of detected.volumePrs) {
    volumePrXp += might.volumePrBonus * classMultiplier(pr.exerciseId, context, balance)
  }
  add('might.volumePr', detected.volumePrs.length === 1 ? 'Volume PR' : 'Volume PRs', volumePrXp)

  let e1rmXp = 0
  for (const gain of detected.e1rmGains) {
    e1rmXp += gain.gainLbs * might.e1rmGainXpPerLb * classMultiplier(gain.exerciseId, context, balance)
  }
  add('might.e1rm', 'Estimated 1RM gain', e1rmXp)

  return awards
}
