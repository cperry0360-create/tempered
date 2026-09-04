/**
 * IndexedDB storage adapter.
 *
 * A thin wrapper: promise-wrapping around the request/event API, the store
 * layout taken from `stores.js`, and nothing clever. This is the only file in
 * the project that mentions IndexedDB.
 */

import { STORES, STORE_NAMES, specFor, DATABASE_NAME, DATABASE_VERSION } from './stores.js'

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/**
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
function completed(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'))
  })
}

/**
 * @param {{name?: string, version?: number, indexedDB?: IDBFactory}} [options]
 * @returns {import('./storage-adapter.js').StorageAdapter}
 */
export function createIndexedDbStorage(options = {}) {
  const name = options.name ?? DATABASE_NAME
  const version = options.version ?? DATABASE_VERSION
  const factory = options.indexedDB ?? globalThis.indexedDB

  /** @type {IDBDatabase|null} */
  let db = null

  /** @param {string} store @param {IDBTransactionMode} mode */
  function tx(store, mode) {
    if (!db) throw new Error('Storage is not open. Call open() first.')
    specFor(store)
    const transaction = db.transaction(store, mode)
    return { transaction, objectStore: transaction.objectStore(store) }
  }

  return {
    kind: 'indexeddb',
    get isOpen() { return db !== null },

    async open() {
      if (db) return
      if (!factory) throw new Error('IndexedDB is not available in this environment')

      const request = factory.open(name, version)
      request.onupgradeneeded = () => {
        const upgrading = request.result
        for (const storeName of STORE_NAMES) {
          const spec = STORES[storeName]
          const store = upgrading.objectStoreNames.contains(storeName)
            ? request.transaction.objectStore(storeName)
            : upgrading.createObjectStore(storeName, { keyPath: spec.keyPath })

          for (const [indexName, field] of Object.entries(spec.indexes ?? {})) {
            if (!store.indexNames.contains(indexName)) store.createIndex(indexName, field)
          }
        }
      }
      db = await promisify(request)
      // A version change from another tab must not leave a broken handle behind.
      db.onversionchange = () => { db?.close(); db = null }
    },

    async close() {
      db?.close()
      db = null
    },

    async get(store, key) {
      const { objectStore } = tx(store, 'readonly')
      return promisify(objectStore.get(key))
    },

    async getAll(store) {
      const { objectStore } = tx(store, 'readonly')
      return promisify(objectStore.getAll())
    },

    async put(store, value) {
      const { transaction, objectStore } = tx(store, 'readwrite')
      objectStore.put(value)
      await completed(transaction)
    },

    async putAll(store, values) {
      if (values.length === 0) return
      // One transaction for the whole batch: an import must not leave a store
      // half-written if it fails partway.
      const { transaction, objectStore } = tx(store, 'readwrite')
      for (const value of values) objectStore.put(value)
      await completed(transaction)
    },

    async delete(store, key) {
      const { transaction, objectStore } = tx(store, 'readwrite')
      objectStore.delete(key)
      await completed(transaction)
    },

    async clear(store) {
      const { transaction, objectStore } = tx(store, 'readwrite')
      objectStore.clear()
      await completed(transaction)
    },

    async count(store) {
      const { objectStore } = tx(store, 'readonly')
      return promisify(objectStore.count())
    },

    async getAllByIndex(store, index, value) {
      const { objectStore } = tx(store, 'readonly')
      return promisify(objectStore.index(index).getAll(value))
    },
  }
}
