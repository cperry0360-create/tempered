/**
 * The storage contract.
 *
 * Non-negotiable 5 says persistence goes through an adapter so cloud sync can be
 * added later without touching domain logic. This file is that boundary: it
 * declares the shape, and nothing more. `memory-storage.js` and
 * `indexeddb-storage.js` both implement it, and a future sync adapter would too.
 *
 * @typedef {object} StorageAdapter
 * @property {string} kind
 * @property {boolean} isOpen
 * @property {() => Promise<void>} open
 * @property {() => Promise<void>} close
 * @property {(store: string, key: any) => Promise<any>} get
 * @property {(store: string) => Promise<any[]>} getAll
 * @property {(store: string, value: any) => Promise<void>} put
 * @property {(store: string, values: any[]) => Promise<void>} putAll
 * @property {(store: string, key: any) => Promise<void>} delete
 * @property {(store: string) => Promise<void>} clear
 * @property {(store: string) => Promise<number>} count
 * @property {(store: string, index: string, value: any) => Promise<any[]>} getAllByIndex
 */

export {}
