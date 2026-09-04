/**
 * Progression rules.
 *
 * The governing rule from `docs/05-workout-system.md`: **the app proposes, never
 * imposes.** Everything here returns a *proposal* — a prefilled value the user
 * can overwrite. Nothing in this module advances a weight on its own, and no
 * caller should treat a proposal as a decision.
 *
 * Every constant comes from `balance.progressionDefaults`.
 */

import { estimateOneRepMax } from './e1rm.js'

/**
 * @typedef {object} PerformedSet
 * @property {number|null} weight
 * @property {number|null} reps
 * @property {number|null} [timeSec]
 * @property {number|null} [distance]
 *
 * @typedef {object} LastPerformance
 * @property {string} date
 * @property {PerformedSet[]} sets
 *
 * @typedef {object} PrescribedSet
 * @property {number|null} weight
 * @property {number|null} reps
 * @property {number|null} [timeSec]
 * @property {number|null} [distance]
 * @property {boolean} [amrap]   Last set is "as many reps as possible".
 *
 * @typedef {object} Proposal
 * @property {PrescribedSet[]} sets
 * @property {boolean} isIncrease   True when this proposes more than last time.
 * @property {string} reason        One line, shown to the user.
 */

/** @param {number} value @param {number} step */
function roundTo(value, step) {
  if (!step || step <= 0) return value
  return Math.round(value / step) * step
}

/**
 * Smallest sensible jump for an exercise: lower body moves in bigger steps than
 * upper, because the lifts are bigger.
 *
 * @param {import('./types.js').Exercise & {group?: string}} exercise
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
export function incrementFor(exercise, balance) {
  const lower = exercise?.group === 'legs' || exercise?.group === 'posterior'
  return lower
    ? balance.progressionDefaults.linearIncrementLowerLbs
    : balance.progressionDefaults.linearIncrementUpperLbs
}

/**
 * Wendler's percentages for one week of a cycle, against a training max.
 *
 * @param {number} trainingMax
 * @param {number} weekIndex 0-based; wraps, so a cycle can run indefinitely.
 * @param {import('./types.js').Balance} balance
 * @returns {PrescribedSet[]}
 */
export function fiveThreeOneWeek(trainingMax, weekIndex, balance) {
  const config = balance.progressionDefaults.fiveThreeOne
  const week = config.weeks[((weekIndex % config.weeks.length) + config.weeks.length) % config.weeks.length]
  return week.percents.map((percent, index) => ({
    weight: roundTo(trainingMax * percent, config.roundToLbs),
    reps: week.reps[index],
    amrap: week.amrapLastSet === true && index === week.percents.length - 1,
  }))
}

/**
 * The training max a 5/3/1 cycle is built on: a percentage of the estimated 1RM,
 * so the prescribed work stays sub-maximal.
 *
 * @param {number} estimatedMax
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
export function trainingMaxFrom(estimatedMax, balance) {
  const config = balance.progressionDefaults.fiveThreeOne
  return roundTo(estimatedMax * config.trainingMaxPercentOfMax, config.roundToLbs)
}

/**
 * Did every working set reach the top of its prescribed rep range? That is the
 * condition for a linear increase.
 *
 * @param {PerformedSet[]} performed
 * @param {number} targetReps
 * @returns {boolean}
 */
export function hitAllReps(performed, targetReps) {
  const working = performed.filter((set) => typeof set.reps === 'number')
  if (working.length === 0) return false
  return working.every((set) => /** @type {number} */ (set.reps) >= targetReps)
}

/**
 * Proposes the next session's sets for one exercise.
 *
 * @param {object} input
 * @param {import('./types.js').Exercise & {progression?: string, group?: string}} input.exercise
 * @param {LastPerformance|null} input.last          Previous performance, if any.
 * @param {{sets: number, reps: number|null, weight: number|null, distance?: number|null}} input.prescribed
 *        The routine's prescription, used when there is no history.
 * @param {number} [input.cycleWeek]                 For 5/3/1.
 * @param {number} [input.trainingMax]               For 5/3/1.
 * @param {import('./types.js').Balance} balance
 * @returns {Proposal}
 */
export function proposeNext(input, balance) {
  const { exercise, last, prescribed } = input
  const rule = exercise?.progression ?? 'linear'
  const setCount = prescribed?.sets ?? last?.sets.length ?? 3

  /** @param {PrescribedSet[]} sets @param {boolean} isIncrease @param {string} reason */
  const proposal = (sets, isIncrease, reason) => ({ sets, isIncrease, reason })

  // No history: repeat what the routine prescribes. Nothing to progress from.
  if (!last || last.sets.length === 0) {
    if (rule === '531') {
      const base = prescribed?.weight
      if (typeof base === 'number' && base > 0) {
        const trainingMax = input.trainingMax ?? trainingMaxFrom(estimateOneRepMax(base, prescribed?.reps ?? 5), balance)
        return proposal(fiveThreeOneWeek(trainingMax, input.cycleWeek ?? 0, balance), false,
          'First cycle, from your working weight.')
      }
    }
    return proposal(
      Array.from({ length: setCount }, () => ({
        weight: prescribed?.weight ?? null,
        reps: prescribed?.reps ?? null,
        distance: prescribed?.distance ?? null,
      })),
      false,
      'As prescribed. No history for this exercise yet.',
    )
  }

  const heaviest = last.sets.reduce((best, set) =>
    (set.weight ?? 0) > (best?.weight ?? 0) ? set : best, last.sets[0])
  const lastWeight = heaviest?.weight ?? null
  const lastReps = heaviest?.reps ?? null

  switch (rule) {
    case '531': {
      const week = input.cycleWeek ?? 0
      const trainingMax = input.trainingMax
        ?? trainingMaxFrom(Math.max(...last.sets.map((s) => estimateOneRepMax(s.weight, s.reps))), balance)
      const sets = fiveThreeOneWeek(trainingMax, week, balance)
      const config = balance.progressionDefaults.fiveThreeOne
      const name = config.weeks[((week % config.weeks.length) + config.weeks.length) % config.weeks.length].name
      return proposal(sets, name !== 'deload',
        name === 'deload' ? 'Deload week. Lighter on purpose.' : `5/3/1 week ${name}, off a ${trainingMax} lb training max.`)
    }

    case 'reps': {
      // Bodyweight: add reps to a target, then add load and reset the reps.
      const target = balance.progressionDefaults.repsProgressionTarget
      const reps = lastReps ?? 0
      if (reps >= target) {
        const added = (lastWeight ?? 0) + incrementFor(exercise, balance)
        return proposal(
          Array.from({ length: setCount }, () => ({ weight: added, reps: Math.max(1, Math.round(target / 2)) })),
          true,
          `You hit ${target} reps. Try adding ${incrementFor(exercise, balance)} lbs and dropping the reps back.`,
        )
      }
      return proposal(
        Array.from({ length: setCount }, () => ({ weight: lastWeight, reps: reps + 1 })),
        true,
        `One more rep than last time.`,
      )
    }

    case 'time': {
      const step = balance.progressionDefaults.timeProgressionIncrementSec
      const lastTime = Math.max(0, ...last.sets.map((set) => set.timeSec ?? 0))
      return proposal(
        Array.from({ length: setCount }, () => ({ weight: null, reps: null, timeSec: lastTime + step })),
        true,
        `${step} seconds longer than last time.`,
      )
    }

    case 'load': {
      // Carries: load first, distance second.
      const step = balance.progressionDefaults.carryLoadIncrementLbs
      const lastDistance = Math.max(0, ...last.sets.map((set) => set.distance ?? 0))
      return proposal(
        Array.from({ length: setCount }, () => ({
          weight: (lastWeight ?? 0) + step, reps: null, distance: lastDistance || prescribed?.distance || null,
        })),
        true,
        `Carry ${step} lbs heavier over the same distance.`,
      )
    }

    case 'linear':
    default: {
      const targetReps = prescribed?.reps ?? lastReps ?? 0
      if (typeof lastWeight === 'number' && targetReps > 0 && hitAllReps(last.sets, targetReps)) {
        const step = incrementFor(exercise, balance)
        return proposal(
          Array.from({ length: setCount }, () => ({ weight: lastWeight + step, reps: targetReps })),
          true,
          `Every set hit ${targetReps}. Proposing ${lastWeight + step} lbs — change it if that is not today.`,
        )
      }
      return proposal(
        Array.from({ length: setCount }, () => ({ weight: lastWeight, reps: targetReps || lastReps })),
        false,
        'Same as last time. Repeat it before adding load.',
      )
    }
  }
}
