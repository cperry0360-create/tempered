/**
 * Schema migrations.
 *
 * Every schema change bumps `CURRENT_SCHEMA_VERSION` and adds a pure function
 * here, keyed by the version it upgrades FROM. `migrate` composes them in order.
 *
 * There are no migrations yet — version 1 is the first schema. The machinery is
 * built and tested now because the alternative is writing it under pressure, in
 * the same change that first needs it, against real user data.
 */

/** The schema version this build reads and writes. */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * Upgrades keyed by source version: `MIGRATIONS[n]` takes version n data and
 * returns version n+1 data. Each must be pure — no I/O, no mutation of input.
 *
 * @type {Readonly<Record<number, (data: any) => any>>}
 */
export const MIGRATIONS = Object.freeze({})

/**
 * Walks data from one schema version up to another.
 *
 * @param {any} data
 * @param {number} from
 * @param {number} [to]
 * @param {Record<number, (data: any) => any>} [registry]
 * @returns {any}
 * @throws when the path is not walkable — a downgrade, or a missing step.
 */
export function migrate(data, from, to = CURRENT_SCHEMA_VERSION, registry = MIGRATIONS) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error('Schema versions must be integers')
  }
  if (from === to) return data
  if (from > to) {
    throw new Error(
      `This file was made by a newer version of Tempered (schema ${from}); ` +
      `this build reads schema ${to}. Update the app, then import again.`,
    )
  }

  let current = data
  for (let version = from; version < to; version++) {
    const step = registry[version]
    if (!step) {
      throw new Error(`No migration from schema version ${version} to ${version + 1}`)
    }
    current = step(current)
  }
  return current
}

/**
 * Whether a version can be brought up to the current one.
 * @param {number} from
 * @param {number} [to]
 * @param {Record<number, (data: any) => any>} [registry]
 */
export function canMigrate(from, to = CURRENT_SCHEMA_VERSION, registry = MIGRATIONS) {
  if (from === to) return true
  if (!Number.isInteger(from) || from > to) return false
  for (let version = from; version < to; version++) {
    if (!registry[version]) return false
  }
  return true
}
