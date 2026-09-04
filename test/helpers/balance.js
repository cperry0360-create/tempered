import { readFileSync } from 'node:fs'

/**
 * Loads the real data/balance.json for tests.
 *
 * This lives in test/, not src/domain/, on purpose: the domain layer is pure and
 * never reads a file. Balance is always passed into domain functions as an argument.
 *
 * @returns {import('../../src/domain/types.js').Balance}
 */
export function loadBalance() {
  return JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url), 'utf8'))
}

/**
 * Loads the seed exercise library as a Map keyed by exercise id.
 * @returns {Map<string, import('../../src/domain/types.js').Exercise>}
 */
export function loadExercises() {
  const raw = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))
  return new Map(raw.exercises.map((exercise) => [exercise.id, exercise]))
}
