/**
 * Export and import documents.
 *
 * Pure: this module builds and validates the document. It never touches storage
 * and never writes anything — `src/adapters/storage/snapshot.js` does that, and
 * only with explicit confirmation.
 *
 * The order of validation matters and follows `docs/02-data-model.md`: `app` and
 * `schemaVersion` are checked FIRST, before anything looks at the payload, so a
 * foreign or future file is refused before it can be partially understood.
 */

import { CURRENT_SCHEMA_VERSION, canMigrate, migrate } from './migrations/index.js'

export const APP_ID = 'tempered'

/** Stores exported as a single record. */
export const SINGLETON_KEYS = Object.freeze(['profile', 'directive'])

/** Stores exported as a list. */
export const COLLECTION_KEYS = Object.freeze([
  'sessions', 'setLogs', 'dayLogs', 'attributeState',
  'records', 'titles', 'battles', 'exercises', 'routines',
])

/** Every store that travels in an export. */
export const DATA_KEYS = Object.freeze([...SINGLETON_KEYS, ...COLLECTION_KEYS])

/**
 * @param {Record<string, any>} data
 * @param {{exportedAt: string, schemaVersion?: number}} options
 * @returns {object}
 */
export function buildExportDocument(data, { exportedAt, schemaVersion = CURRENT_SCHEMA_VERSION }) {
  /** @type {Record<string, any>} */
  const payload = {}
  for (const key of SINGLETON_KEYS) payload[key] = data[key] ?? null
  for (const key of COLLECTION_KEYS) payload[key] = data[key] ?? []

  return { app: APP_ID, schemaVersion, exportedAt, data: payload }
}

/**
 * @param {Record<string, any>} data
 * @returns {Record<string, number>}
 */
export function summarise(data) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const key of SINGLETON_KEYS) counts[key] = data?.[key] ? 1 : 0
  for (const key of COLLECTION_KEYS) counts[key] = Array.isArray(data?.[key]) ? data[key].length : 0
  return counts
}

/**
 * @typedef {object} ImportRefusal
 * @property {false} ok
 * @property {string} reason   Machine-readable: 'unreadable' | 'not-tempered' | ...
 * @property {string} message  Shown to the user, plainly and without blame.
 *
 * @typedef {object} ImportPlan
 * @property {true} ok
 * @property {number} schemaVersion      Version after any migration.
 * @property {number|null} migratedFrom  Set when the file needed upgrading.
 * @property {Record<string, any>} data
 * @property {Record<string, number>} summary
 * @property {true} requiresConfirmation Always. Import never proceeds unasked.
 */

/** @param {string} reason @param {string} message @returns {ImportRefusal} */
const refuse = (reason, message) => ({ ok: false, reason, message })

/**
 * Validates a file and, if it is sound, returns a plan describing what importing
 * it would do. Nothing is applied here — a plan is a proposal, not an action.
 *
 * @param {string|object} raw
 * @param {{schemaVersion?: number, registry?: Record<number, (d: any) => any>}} [options]
 * @returns {ImportPlan|ImportRefusal}
 */
export function prepareImport(raw, options = {}) {
  const target = options.schemaVersion ?? CURRENT_SCHEMA_VERSION
  const registry = options.registry

  /** @type {any} */
  let backup = raw
  if (typeof raw === 'string') {
    try {
      backup = JSON.parse(raw)
    } catch {
      return refuse('unreadable', 'That file is not valid JSON, so it cannot be read as a Tempered backup.')
    }
  }

  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    return refuse('unreadable', 'That file is not a Tempered backup.')
  }

  // `app` first, exactly as docs/02 requires.
  if (backup.app !== APP_ID) {
    const found = typeof backup.app === 'string' ? `"${backup.app}"` : 'nothing'
    return refuse('not-tempered',
      `That file is not a Tempered backup — its app field says ${found}. Nothing has been changed.`)
  }

  const version = backup.schemaVersion
  if (!Number.isInteger(version)) {
    return refuse('no-version',
      'That backup has no schema version, so it cannot be read safely. Nothing has been changed.')
  }

  if (version > target) {
    return refuse('newer-schema',
      `That backup was made by a newer version of Tempered (schema ${version}); this build reads ` +
      `schema ${target}. Update the app and import again. Nothing has been changed.`)
  }

  if (version < target && !canMigrate(version, target, registry)) {
    return refuse('unmigratable',
      `That backup uses schema ${version} and this build cannot upgrade it to schema ${target}. ` +
      'Nothing has been changed.')
  }

  if (!backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    return refuse('no-data', 'That backup has no data in it. Nothing has been changed.')
  }

  let data = backup.data
  if (version < target) {
    try {
      data = migrate(data, version, target, registry)
    } catch (error) {
      return refuse('migration-failed',
        `That backup could not be upgraded from schema ${version}: ${/** @type {Error} */ (error).message} ` +
        'Nothing has been changed.')
    }
  }

  for (const key of COLLECTION_KEYS) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return refuse('malformed', `That backup's "${key}" is not a list, so it cannot be read. Nothing has been changed.`)
    }
  }

  return {
    ok: true,
    schemaVersion: target,
    migratedFrom: version < target ? version : null,
    data,
    summary: summarise(data),
    requiresConfirmation: true,
  }
}
