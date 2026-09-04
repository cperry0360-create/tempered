/**
 * Schema migrations.
 *
 * Every schema change bumps `CURRENT_SCHEMA_VERSION` and adds a pure function
 * here, keyed by the version it upgrades FROM. `migrate` composes them in order.
 *
 * Version 1 was the first schema; version 2 adds time-boxed programs. The
 * machinery was built before the first migration needed it, which is why this
 * change was a handful of lines rather than an emergency.
 */

/**
 * The schema version this build reads and writes.
 *
 * 2 — programs and programState added.
 * 3 — set logs may carry programDayId and slotIndex.
 */
export const CURRENT_SCHEMA_VERSION = 3

/**
 * Upgrades keyed by source version: `MIGRATIONS[n]` takes version n data and
 * returns version n+1 data. Each must be pure — no I/O, no mutation of input.
 *
 * @type {Readonly<Record<number, (data: any) => any>>}
 */
export const MIGRATIONS = Object.freeze({
  /**
   * 1 -> 2: time-boxed programs (docs/09).
   *
   * A version 1 backup predates programs entirely, so it carries none. The
   * upgrade adds the empty collections rather than leaving them undefined, so
   * downstream code never has to ask which schema a value came from. Nothing
   * existing is touched: no session, set log or attribute state changes shape.
   */
  1: (data) => ({ ...data, programs: data.programs ?? [], programState: data.programState ?? [] }),

  /**
   * 2 -> 3: slot attribution (docs/10).
   *
   * Set logs gained optional `programDayId` and `slotIndex`, so a logged set can
   * be attributed to the program slot it completes. Nothing needs rewriting: a
   * version 2 log simply carries no attribution, which reads as "not part of a
   * program slot" — exactly what it was. The version boundary is recorded here
   * so a future reader knows when the fields appeared.
   */
  2: (data) => data,
})

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
