/**
 * Per-exercise records and personal-best detection.
 *
 * A record can only be *beaten*, never merely set: the first time an exercise is
 * performed it establishes the baseline and earns no PR bonus. Otherwise a first
 * session would pay a weight PR for every movement in the routine at once, which
 * both distorts early balance and cheapens the moment.
 *
 * Warmup sets never score and never set records.
 */

import { estimateOneRepMax } from './e1rm.js'

/**
 * @param {import('./types.js').SetInput[]} sets
 * @returns {import('./types.js').SetInput[]}
 */
export function workingSets(sets) {
  return sets.filter((set) => set.isWarmup !== true)
}

/**
 * Load moved per exercise in one session: sum of weight x reps.
 *
 * Bodyweight sets (`weight: null`) contribute nothing. The engine never
 * substitutes the user's body weight — see `docs/01-attributes-and-xp.md`.
 *
 * @param {import('./types.js').SetInput[]} sets
 * @returns {Map<string, number>}
 */
export function volumeByExercise(sets) {
  /** @type {Map<string, number>} */
  const volumes = new Map()
  for (const set of workingSets(sets)) {
    if (typeof set.weight !== 'number' || typeof set.reps !== 'number') continue
    if (set.weight <= 0 || set.reps <= 0) continue
    volumes.set(set.exerciseId, (volumes.get(set.exerciseId) ?? 0) + set.weight * set.reps)
  }
  return volumes
}

/**
 * Heaviest single working set per exercise.
 *
 * @param {import('./types.js').SetInput[]} sets
 * @returns {Map<string, {weight: number, reps: number}>}
 */
export function heaviestByExercise(sets) {
  /** @type {Map<string, {weight: number, reps: number}>} */
  const heaviest = new Map()
  for (const set of workingSets(sets)) {
    if (typeof set.weight !== 'number' || typeof set.reps !== 'number') continue
    if (set.weight <= 0 || set.reps <= 0) continue
    const current = heaviest.get(set.exerciseId)
    if (!current || set.weight > current.weight) {
      heaviest.set(set.exerciseId, { weight: set.weight, reps: set.reps })
    }
  }
  return heaviest
}

/**
 * Best estimated 1RM per exercise in one session.
 *
 * @param {import('./types.js').SetInput[]} sets
 * @returns {Map<string, number>}
 */
export function bestE1rmByExercise(sets) {
  /** @type {Map<string, number>} */
  const best = new Map()
  for (const set of workingSets(sets)) {
    const estimate = estimateOneRepMax(set.weight, set.reps)
    if (estimate <= 0) continue
    if (estimate > (best.get(set.exerciseId) ?? 0)) best.set(set.exerciseId, estimate)
  }
  return best
}

/**
 * @typedef {object} DetectedRecords
 * @property {{exerciseId: string, weight: number, reps: number, previous: number}[]} weightPrs
 * @property {{exerciseId: string, volume: number, previous: number}[]} volumePrs
 * @property {{exerciseId: string, gainLbs: number, value: number}[]} e1rmGains
 */

/**
 * Compares a session against the standing records.
 *
 * @param {import('./types.js').SetInput[]} sets
 * @param {Map<string, import('./types.js').ExerciseRecord>} records
 * @returns {DetectedRecords}
 */
export function detectRecords(sets, records) {
  /** @type {DetectedRecords} */
  const detected = { weightPrs: [], volumePrs: [], e1rmGains: [] }

  for (const [exerciseId, heaviest] of heaviestByExercise(sets)) {
    const previous = records.get(exerciseId)?.bestWeight
    if (previous && heaviest.weight > previous.weight) {
      detected.weightPrs.push({ exerciseId, ...heaviest, previous: previous.weight })
    }
  }

  for (const [exerciseId, volume] of volumeByExercise(sets)) {
    const previous = records.get(exerciseId)?.bestVolume
    if (previous && volume > previous.volume) {
      detected.volumePrs.push({ exerciseId, volume, previous: previous.volume })
    }
  }

  for (const [exerciseId, value] of bestE1rmByExercise(sets)) {
    const previous = records.get(exerciseId)?.bestE1RM
    if (previous && value > previous.value) {
      detected.e1rmGains.push({ exerciseId, gainLbs: value - previous.value, value })
    }
  }

  return detected
}

/**
 * Returns a new records map with this session folded in. Pure: the input map is
 * not modified.
 *
 * @param {Map<string, import('./types.js').ExerciseRecord>} records
 * @param {import('./types.js').SetInput[]} sets
 * @param {string} date
 * @returns {Map<string, import('./types.js').ExerciseRecord>}
 */
export function applyRecords(records, sets, date) {
  const updated = new Map(records)
  const heaviest = heaviestByExercise(sets)
  const volumes = volumeByExercise(sets)
  const e1rms = bestE1rmByExercise(sets)

  const touched = new Set([...heaviest.keys(), ...volumes.keys(), ...e1rms.keys()])

  for (const exerciseId of touched) {
    const existing = updated.get(exerciseId)
    /** @type {import('./types.js').ExerciseRecord} */
    const record = {
      exerciseId,
      bestWeight: existing?.bestWeight ?? null,
      bestVolume: existing?.bestVolume ?? null,
      bestE1RM: existing?.bestE1RM ?? null,
      lastPerformance: existing?.lastPerformance ?? null,
    }

    const top = heaviest.get(exerciseId)
    if (top && (!record.bestWeight || top.weight > record.bestWeight.weight)) {
      record.bestWeight = { weight: top.weight, reps: top.reps, date }
    }

    const volume = volumes.get(exerciseId)
    if (volume !== undefined && (!record.bestVolume || volume > record.bestVolume.volume)) {
      record.bestVolume = { volume, date }
    }

    const e1rm = e1rms.get(exerciseId)
    if (e1rm !== undefined && (!record.bestE1RM || e1rm > record.bestE1RM.value)) {
      record.bestE1RM = { value: e1rm, date }
    }

    if (top) record.lastPerformance = { weight: top.weight, reps: top.reps, date }

    updated.set(exerciseId, record)
  }

  return updated
}
