/**
 * In-memory storage adapter.
 *
 * Implements exactly the same contract as the IndexedDB adapter, so domain and
 * app code can be exercised under `node --test` with no browser. It is a real
 * implementation of the interface, not a stub: the tests that prove import
 * semantics run against this.
 */

import { STORE_NAMES, specFor } from './stores.js'

/**
 * Structured-clone-ish copy, so callers cannot mutate stored records by holding
 * a reference to what they put in — matching IndexedDB, which stores a copy.
 * @template T @param {T} value @returns {T}
 */
function copy(value) {
  return value === undefined ? value : structuredClone(value)
}

/**
 * @returns {import('./storage-adapter.js').StorageAdapter}
 */
export function createMemoryStorage() {
  /** @type {Map<string, Map<any, any>>} */
  const data = new Map(STORE_NAMES.map((name) => [name, new Map()]))
  let open = false

  /** @param {string} store */
  function tableFor(store) {
    specFor(store)
    const table = data.get(store)
    if (!table) throw new Error(`Unknown store: ${store}`)
    return table
  }

  return {
    kind: 'memory',

    async open() { open = true },
    async close() { open = false },
    get isOpen() { return open },

    async get(store, key) {
      return copy(tableFor(store).get(key))
    },

    async getAll(store) {
      return [...tableFor(store).values()].map(copy)
    },

    async put(store, value) {
      const { keyPath } = specFor(store)
      const key = value?.[keyPath]
      if (key === undefined || key === null) {
        throw new Error(`Cannot store a record in "${store}" with no ${keyPath}`)
      }
      tableFor(store).set(key, copy(value))
    },

    async putAll(store, values) {
      for (const value of values) await this.put(store, value)
    },

    async replaceAll(replacement) {
      // Build and validate the entire replacement before touching live data,
      // mirroring IndexedDB's all-or-nothing multi-store transaction.
      const prepared = new Map()
      for (const [store, values] of Object.entries(replacement)) {
        const { keyPath } = specFor(store)
        const table = new Map()
        for (const value of values ?? []) {
          const key = value?.[keyPath]
          if (key === undefined || key === null) {
            throw new Error(`Cannot store a record in "${store}" with no ${keyPath}`)
          }
          table.set(key, copy(value))
        }
        prepared.set(store, table)
      }
      for (const [store, table] of prepared) data.set(store, table)
    },

    async delete(store, key) {
      tableFor(store).delete(key)
    },

    async clear(store) {
      tableFor(store).clear()
    },

    async count(store) {
      return tableFor(store).size
    },

    async getAllByIndex(store, index, value) {
      const { indexes } = specFor(store)
      const field = indexes?.[index]
      if (!field) throw new Error(`Store "${store}" has no index "${index}"`)
      return [...tableFor(store).values()].filter((row) => row[field] === value).map(copy)
    },
  }
}
