/**
 * Balance projection harness.
 *
 * Simulates a year of realistic training against the real engine and the real
 * `data/balance.json`, so the levelling curve can be checked rather than guessed.
 * `balance.projection.test.js` asserts the checks; `docs/BALANCE-PROJECTION.md`
 * is regenerated from this same simulation, so the table and the test can never
 * disagree.
 *
 * Pure: balance and the exercise library are passed in, and all randomness comes
 * from a seeded generator, so the same seed always produces the same year.
 */

import { awardsForSession, awardsForDay, applyAwards, createInitialState, levelsOf } from './xp-engine.js'
import { applyRecords } from './records.js'
import { rankFromLevels, totalLevels } from './rank.js'
import { ATTRIBUTE_IDS } from './tiers.js'

/**
 * mulberry32 — small, fast, deterministic. The simulation must be reproducible
 * or the projection table is not evidence of anything.
 * @param {number} seed
 */
function makeRandom(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Working weights for routine entries the seed library leaves blank for the user
 * to fill in. Simulation input only — not product data.
 */
const SIMULATED_START_WEIGHTS = {
  rdl: 115, split_squat: 40, seated_row_close: 120,
  lateral_raise: 20, tricep_push: 45, farmers_carry: 100,
}

/** The checkpoints the projection table reports. */
export const CHECKPOINTS = Object.freeze([30, 60, 90, 180, 365])

/** Cory's week: Upper/Lower twice each, three runs, Sunday rest. */
const WEEK = [
  { lift: 'lower', run: false },
  { lift: null, run: true },
  { lift: 'upper', run: false },
  { lift: null, run: true },
  { lift: 'lower', run: false },
  { lift: 'upper', run: true },
  { lift: null, run: false },
]

/**
 * @param {import('./types.js').Balance} balance
 * @param {{routines: any[], exercises: any[]}} library
 * @param {{seed?: number, days?: number, consistency?: number, planTarget?: number}} [options]
 */
export function simulateYear(balance, library, options = {}) {
  const {
    seed = 20260904, days = 365, consistency = 0.75, planTarget = 4,
    checkpoints = CHECKPOINTS,
  } = options
  const random = makeRandom(seed)

  const exercises = new Map(library.exercises.map((e) => [e.id, e]))
  const routines = new Map(library.routines.map((r) => [r.id, r]))

  /** @param {number} lo @param {number} hi */
  const between = (lo, hi) => lo + random() * (hi - lo)
  const happens = (p = consistency) => random() < p

  // Current working weight per exercise, and progression bookkeeping.
  /** @type {Map<string, number>} */
  const weights = new Map()
  /** @type {Map<string, {since: number, promotions: number}>} */
  const progress = new Map()

  for (const routine of library.routines) {
    for (const entry of routine.exercises ?? []) {
      const start = entry.weight ?? SIMULATED_START_WEIGHTS[entry.id] ?? null
      if (start !== null) weights.set(entry.id, start)
      progress.set(entry.id, { since: 0, promotions: 0 })
    }
  }

  /** Linear progression that stalls, as real training does: each successive
   *  increment takes longer to earn than the one before. */
  function advance(exerciseId) {
    const state = progress.get(exerciseId)
    const current = weights.get(exerciseId)
    if (!state || current === undefined) return
    state.since += 1
    if (state.since < 4 + state.promotions) return
    const exercise = exercises.get(exerciseId)
    const lower = exercise?.group === 'legs' || exercise?.group === 'posterior'
    const increment = lower
      ? balance.progressionDefaults.linearIncrementLowerLbs
      : balance.progressionDefaults.linearIncrementUpperLbs
    weights.set(exerciseId, current + increment)
    state.since = 0
    state.promotions += 1
  }

  /** Days on which a session was logged, for the weekly-plan bonus. */
  const sessionDays = new Set()

  let state = createInitialState()
  let records = new Map()
  let lastSessionDay = -Infinity
  /** @type {number[]} */
  const recentPaces = []
  /** @type {Record<number, {levels: Record<string, number>, xp: Record<string, number>}>} */
  const milestones = {}

  let runPace = 10.0 // min/mile, improves slowly across the year

  for (let day = 1; day <= days; day++) {
    const weekday = (day - 1) % 7
    const plan = WEEK[weekday]
    const weekStart = day - weekday
    let sessionsThisWeekBefore = 0
    for (let d = weekStart; d < day; d++) {
      if (sessionDays.has(d)) sessionsThisWeekBefore += 1
    }

    /** @type {import('./types.js').DayInput} */
    const dayLog = { date: `d${day}`, cardio: [] }

    // --- training session -------------------------------------------------
    if (plan.lift && happens()) {
      const routine = routines.get(plan.lift)
      /** @type {import('./types.js').SetInput[]} */
      const sets = []
      for (const entry of routine.exercises) {
        const weight = weights.get(entry.id) ?? null
        for (let s = 0; s < entry.sets; s++) {
          sets.push({
            exerciseId: entry.id,
            weight,
            reps: entry.reps ?? null,
            distance: entry.distance ?? null,
          })
        }
        advance(entry.id)
      }

      const session = {
        id: `s${day}`, routineId: plan.lift,
        durationMinutes: Math.round(between(55, 80)), sets,
      }
      const context = {
        date: `d${day}`,
        exercises,
        records,
        daysSinceLastSession: day - lastSessionDay,
        sessionsThisWeekBefore,
        planTargetSessionsPerWeek: planTarget,
      }
      state = applyAwards(state, awardsForSession(session, context, balance), balance)
      records = applyRecords(records, sets, `d${day}`)
      lastSessionDay = day
      sessionDays.add(day)
    }

    // --- cardio -----------------------------------------------------------
    if (plan.run && happens()) {
      const miles = between(2, 5)
      // Fitness improves; pace drifts down about 1:20/mile across the year.
      runPace = Math.max(8.2, 10.0 - (day / days) * 1.3 + between(-0.35, 0.35))
      dayLog.cardio.push({ activityId: 'run', distanceMiles: miles, minutes: miles * runPace })
      recentPaces.push(runPace)
      if (recentPaces.length > 12) recentPaces.shift()

      const context = { date: `d${day}`, exercises, records, daysSinceLastSession: day - lastSessionDay,
        sessionsThisWeekBefore, planTargetSessionsPerWeek: planTarget }
      state = applyAwards(state, awardsForSession(
        { id: `c${day}`, routineId: 'cardio', durationMinutes: Math.round(miles * runPace), sets: [] },
        context, balance), balance)
      lastSessionDay = day
      sessionDays.add(day)
    }

    // --- daily logging ----------------------------------------------------
    dayLog.sleepHours = between(6.2, 8.6)
    dayLog.steps = Math.round(between(5000, 12000))
    if (happens(0.80)) dayLog.waterOz = Math.round(between(55, 105))
    if (happens(0.70)) dayLog.nutritionLogged = true
    if (happens(0.50)) dayLog.proteinTargetMet = true
    if (happens(0.70)) dayLog.readingMinutes = Math.round(between(15, 40))
    if (happens(0.60)) dayLog.meditationMinutes = Math.round(between(8, 15))
    if (happens(0.40)) dayLog.journalLogged = true
    if (happens(0.30)) dayLog.mobilityMinutes = Math.round(between(8, 15))
    if (weekday === 0 && happens(0.70)) dayLog.bodyMetricsLogged = true
    if (weekday === 6 && !sessionDays.has(day)) dayLog.restDay = true

    const baseline = recentPaces.length >= 3
      ? recentPaces.reduce((a, b) => a + b, 0) / recentPaces.length
      : null
    state = applyAwards(state, awardsForDay(dayLog, { paceBaselineMinPerMile: baseline }, balance), balance)

    if (checkpoints.includes(day)) {
      milestones[day] = {
        levels: levelsOf(state),
        xp: Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].xp])),
      }
    }
  }

  const finalLevels = levelsOf(state)
  return {
    milestones,
    finalLevels,
    finalXp: Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].xp])),
    rank: rankFromLevels(finalLevels, balance),
    totalLevels: totalLevels(finalLevels),
  }
}
