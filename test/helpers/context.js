import { loadExercises } from './balance.js'

/**
 * A SessionContext with sensible defaults for tests. Override any field.
 * @param {object} [over]
 */
export function makeContext(over = {}) {
  return {
    date: '2026-09-04',
    exercises: loadExercises(),
    records: new Map(),
    daysSinceLastSession: 2,
    sessionsThisWeekBefore: 0,
    planTargetSessionsPerWeek: 4,
    paceBaselineMinPerMile: null,
    ...over,
  }
}

/**
 * A record map that makes every PR comparison fail unless explicitly beaten,
 * so tests can isolate volume from PR bonuses.
 * @param {string[]} exerciseIds
 */
export function unbeatableRecords(exerciseIds) {
  return new Map(exerciseIds.map((id) => [id, {
    exerciseId: id,
    bestWeight: { weight: 1e9, reps: 1, date: '2020-01-01' },
    bestVolume: { volume: 1e9, date: '2020-01-01' },
    bestE1RM: { value: 1e9, date: '2020-01-01' },
    lastPerformance: null,
  }]))
}

/** @param {object} [over] */
export function makeSession(over = {}) {
  return { id: 's1', routineId: 'lower', durationMinutes: 60, sets: [], ...over }
}
