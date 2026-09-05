/**
 * Programs — time-boxed plans with a week index, rep ranges and a deload.
 *
 * `docs/09-tracker-v2.md`: a program is a superset of a routine, not a fork. A
 * routine is a program of one week with fixed reps, so both funnel into the same
 * session logic. Nothing here touches scoring: Might is still weight x reps of
 * what was actually performed, and a range changes the prescription only.
 */

/**
 * @typedef {object} ProgramSlot
 * @property {string} exerciseId
 * @property {string} name
 * @property {number} sets
 * @property {number} repMin
 * @property {number} repMax
 * @property {number} [weight]  Optional first-session working weight from setup.
 * @property {boolean} [perSide]
 * @property {[number, number]} [restSec]
 * @property {string} [setup]
 * @property {string} [cue]
 */

/**
 * The week a program is on, given when it started. Weeks roll over on the
 * calendar, not per session: missing a week does not pause the program, and
 * doing two sessions in a day does not advance it.
 *
 * @param {number} daysElapsed
 * @param {number} totalWeeks
 * @returns {number} 1-based, clamped to the program's length.
 */
export function weekFromStart(daysElapsed, totalWeeks) {
  const week = Math.floor(Math.max(0, daysElapsed) / 7) + 1
  return Math.min(week, Math.max(1, totalWeeks))
}

/**
 * The final week of a program is a deload: hold weight, do not add.
 * @param {number} week
 * @param {{weeks: number}} program
 */
export function isDeloadWeek(week, program) {
  return week >= program.weeks
}

/**
 * Turns one program slot into the sets a session should show.
 *
 * The prescription is the range. Weight comes from last performance where there
 * is any. On a first session, Phase 7 may provide a configured working weight;
 * if not, the field stays blank and the user finds the load in the gym.
 *
 * @param {object} input
 * @param {ProgramSlot} input.slot
 * @param {number} input.week
 * @param {{weeks: number}} input.program
 * @param {import('./progression.js').LastPerformance|null} input.last
 * @param {import('./types.js').Exercise} [input.exercise]
 * @param {import('./types.js').Balance} balance
 * @returns {{sets: object[], reason: string, isIncrease: boolean, deload: boolean}}
 */
export function prescribeFromProgram(input, balance) {
  const { slot, week, program, last, exercise } = input
  const deload = isDeloadWeek(week, program)
  const count = slot.sets

  const performed = last?.sets?.filter((set) => typeof set.reps === 'number') ?? []
  const lastWeight = performed.length
    ? performed.reduce((best, set) => ((set.weight ?? 0) > (best.weight ?? 0) ? set : best), performed[0]).weight
    : null
  const startingWeight = typeof slot.weight === 'number' && slot.weight > 0 ? slot.weight : null
  const baseWeight = lastWeight ?? startingWeight

  const build = (weight, reps) => Array.from({ length: count }, () => ({
    weight: weight ?? null,
    reps,
    perSide: slot.perSide === true,
  }))

  if (deload) {
    return {
      sets: build(baseWeight, slot.repMin),
      reason: 'Deload week. Hold the weight and keep the reps at the bottom of the range.',
      isIncrease: false,
      deload: true,
    }
  }

  if (performed.length === 0) {
    return {
      sets: build(startingWeight, slot.repMin),
      reason: startingWeight
        ? `Start at ${startingWeight} and aim for ${slot.repMin}–${slot.repMax}${slot.perSide ? ' per side' : ''}. Change it if that is not today.`
        : `Aim for ${slot.repMin}–${slot.repMax}${slot.perSide ? ' per side' : ''}. Find a weight you can hold that range with.`,
      isIncrease: false,
      deload: false,
    }
  }

  // Double progression: earn the range, then earn the load.
  const everySetAtTop = performed.length >= count
    && performed.every((set) => /** @type {number} */ (set.reps) >= slot.repMax)

  if (everySetAtTop && typeof lastWeight === 'number') {
    const step = incrementFor(exercise, balance)
    return {
      sets: build(lastWeight + step, slot.repMin),
      reason: `Every set hit ${slot.repMax}. Proposing ${lastWeight + step} lb and back to ${slot.repMin} — change it if that is not today.`,
      isIncrease: true,
      deload: false,
    }
  }

  const target = Math.min(slot.repMax, Math.max(slot.repMin,
    Math.max(...performed.map((set) => /** @type {number} */ (set.reps))) + 1))
  return {
    sets: build(lastWeight, target),
    reason: `Same weight. Work toward ${slot.repMax}${slot.perSide ? ' per side' : ''} before adding load.`,
    isIncrease: false,
    deload: false,
  }
}

/** Local copy of the increment rule, so this module stays inside the domain. */
function incrementFor(exercise, balance) {
  const lower = exercise?.group === 'legs' || exercise?.group === 'posterior'
  return lower
    ? balance.progressionDefaults.linearIncrementLowerLbs
    : balance.progressionDefaults.linearIncrementUpperLbs
}

/**
 * Weekly hard-set targets per muscle group, computed from the program itself
 * rather than transcribed. `docs/09` section E asks for a guide; deriving it
 * means it cannot drift from the program it describes.
 *
 * A "hard set" is a working set taken near the top of its range, which is every
 * prescribed set in a hypertrophy program — so this counts prescribed sets,
 * weighted by how strongly each movement loads the group.
 *
 * @param {{days: {exercises: ProgramSlot[]}[]}} program
 * @param {Map<string, import('./types.js').Exercise & {activation?: Record<string, number>}>} exercises
 * @returns {{group: string, sets: number}[]} descending by volume.
 */
export function weeklyHardSets(program, exercises) {
  /** @type {Map<string, number>} */
  const totals = new Map()
  for (const day of program.days) {
    for (const slot of day.exercises) {
      const activation = exercises.get(slot.exerciseId)?.activation ?? {}
      for (const [group, weight] of Object.entries(activation)) {
        // Only count a group when the movement meaningfully loads it.
        if (weight < 1) continue
        totals.set(group, (totals.get(group) ?? 0) + slot.sets)
      }
    }
  }
  return [...totals.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}
