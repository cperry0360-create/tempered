/**
 * The object stores, from `docs/02-data-model.md`.
 *
 * Declared once and shared by every storage implementation, so the in-memory
 * adapter used in tests and the IndexedDB adapter used in the app cannot drift
 * apart in shape.
 */

/**
 * @typedef {object} StoreSpec
 * @property {string} keyPath
 * @property {Record<string, string>} [indexes]
 */

/** @type {Readonly<Record<string, StoreSpec>>} */
export const STORES = Object.freeze({
  profile: { keyPath: 'id' },
  sessions: { keyPath: 'id' },
  setLogs: { keyPath: 'id', indexes: { sessionId: 'sessionId', exerciseId: 'exerciseId' } },
  dayLogs: { keyPath: 'date' },
  exercises: { keyPath: 'id' },
  routines: { keyPath: 'id' },
  attributeState: { keyPath: 'attribute' },
  records: { keyPath: 'exerciseId' },
  titles: { keyPath: 'id' },
  battles: { keyPath: 'date' },
  directive: { keyPath: 'id' },
})

/** @type {readonly string[]} */
export const STORE_NAMES = Object.freeze(Object.keys(STORES))

export const DATABASE_NAME = 'tempered'

/**
 * Bumped only when the store layout changes. Distinct from the export document's
 * `schemaVersion`, which describes the data rather than the database.
 */
export const DATABASE_VERSION = 1

/**
 * @param {string} store
 * @returns {StoreSpec}
 */
export function specFor(store) {
  const spec = STORES[store]
  if (!spec) throw new Error(`Unknown store: ${store}`)
  return spec
}
