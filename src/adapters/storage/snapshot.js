/**
 * Reading and writing whole-database snapshots, for export and import.
 *
 * The confirmation rule from `docs/02-data-model.md` — "import never silently
 * overwrites; it asks first" — is enforced here structurally rather than by
 * convention: `applyImportPlan` takes a plan produced by the domain and refuses
 * to run without an explicit `confirm: 'replace'`. A caller cannot import by
 * forgetting to ask.
 */

import { SINGLETON_KEYS, COLLECTION_KEYS, DATA_KEYS, buildExportDocument } from '../../domain/transfer.js'

/**
 * Reads every store into a plain object shaped like an export payload.
 *
 * @param {import('./storage-adapter.js').StorageAdapter} storage
 * @returns {Promise<Record<string, any>>}
 */
export async function readSnapshot(storage) {
  /** @type {Record<string, any>} */
  const data = {}
  for (const key of SINGLETON_KEYS) {
    const rows = await storage.getAll(key)
    data[key] = rows[0] ?? null
  }
  for (const key of COLLECTION_KEYS) {
    data[key] = await storage.getAll(key)
  }
  return data
}

/**
 * Builds the full export document from live storage.
 *
 * @param {import('./storage-adapter.js').StorageAdapter} storage
 * @param {import('../clock/clock.js').Clock} clock
 * @returns {Promise<object>}
 */
export async function exportSnapshot(storage, clock) {
  return buildExportDocument(await readSnapshot(storage), { exportedAt: clock.nowIso() })
}

/**
 * Applies a validated import plan, replacing existing data.
 *
 * @param {import('./storage-adapter.js').StorageAdapter} storage
 * @param {import('../../domain/transfer.js').ImportPlan} plan
 * @param {{confirm?: string}} [options]
 * @returns {Promise<Record<string, number>>} what was written, per store.
 */
export async function applyImportPlan(storage, plan, options = {}) {
  if (!plan || plan.ok !== true) {
    throw new Error('Refusing to import: no valid plan was supplied.')
  }
  if (options.confirm !== 'replace') {
    throw new Error(
      'Refusing to import without confirmation. Importing replaces everything currently ' +
      'stored; ask the user to confirm, then call again with { confirm: "replace" }.',
    )
  }

  // Clear first so the result is the imported data exactly, not a silent merge.
  for (const key of DATA_KEYS) await storage.clear(key)

  /** @type {Record<string, number>} */
  const written = {}
  for (const key of SINGLETON_KEYS) {
    const record = plan.data[key]
    if (record) {
      await storage.put(key, record)
      written[key] = 1
    } else {
      written[key] = 0
    }
  }
  for (const key of COLLECTION_KEYS) {
    const rows = plan.data[key] ?? []
    await storage.putAll(key, rows)
    written[key] = rows.length
  }
  return written
}
