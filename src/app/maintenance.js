/**
 * Maintenance — the two things you cannot currently do from inside the app.
 *
 * Installed to a home screen, a PWA has no address bar, no reload button and no
 * DevTools. That makes two ordinary operations impossible: starting over, and
 * finding out whether the build you are looking at is the build that was
 * deployed. Today the only way to reset is to delete the app through iOS
 * Settings, which nobody discovers and which also throws away the backup you
 * would have wanted.
 *
 * Both are developer conveniences now and safety features later, so both are
 * built to be safe rather than quick:
 *
 *   - **Reset refuses to run without a typed phrase.** A tap is something a
 *     pocket can do. Typing RESET is not.
 *   - **A backup is offered first**, from the same snapshot the export format
 *     already defines, so starting over is recoverable.
 *   - **Checking for updates reports the version on both sides of the reload.**
 *     An update check that says nothing leaves you exactly where you started:
 *     unable to tell a build that failed to deploy from one that deployed and
 *     did not fix the problem.
 *
 * Everything the platform provides — service workers, caches, the database, the
 * location bar — arrives through `platform` so this is testable in node against
 * fakes, and so the one place that touches those APIs is this file.
 */

import { exportSnapshot } from '../adapters/storage/snapshot.js'
import { DATABASE_NAME } from '../adapters/storage/stores.js'
import { VERSION } from '../version.js'

/** What must be typed before a reset will run. Deliberately not "yes". */
export const RESET_PHRASE = 'RESET'

/** Where the pre-reload version is parked so the reload can report on it. */
const PENDING_KEY = 'tempered:update-check'

/**
 * The browser, as this module needs it.
 *
 * Every method is allowed to be missing: an older browser without caches, a
 * page served without a service worker, a private window that refuses session
 * storage. None of that is a reason for a reset to fail — the point of the
 * button is to get out of a bad state, so it must not need a good one.
 */
function browserPlatform() {
  return {
    async serviceWorkers() {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return []
      try { return await navigator.serviceWorker.getRegistrations() } catch { return [] }
    },
    async cacheKeys() {
      if (typeof caches === 'undefined') return []
      try { return await caches.keys() } catch { return [] }
    },
    async deleteCache(key) {
      if (typeof caches === 'undefined') return false
      try { return await caches.delete(key) } catch { return false }
    },
    async deleteDatabase(name) {
      if (typeof indexedDB === 'undefined') return
      await new Promise((resolve) => {
        let settled = false
        const done = () => { if (!settled) { settled = true; resolve(undefined) } }
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = done
        request.onerror = done
        // Another tab holding the database open would block this forever.
        // Resolving anyway is right: the reload that follows closes this tab's
        // connection, and the next open finds either a deleted or an empty one.
        request.onblocked = done
      })
    },
    session: (() => {
      try {
        if (typeof sessionStorage === 'undefined') return null
        return sessionStorage
      } catch { return null }
    })(),
    reload() {
      if (typeof location !== 'undefined') location.reload()
    },
  }
}

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {object} [deps.platform]
 * @param {string} [deps.version]
 */
export function createMaintenanceService({ storage, clock, platform, version = VERSION }) {
  const host = platform ?? browserPlatform()

  /** Reads the stash without ever letting a refusing browser throw. */
  const stashed = () => {
    try { return host.session?.getItem(PENDING_KEY) ?? null } catch { return null }
  }
  const stash = (value) => {
    try {
      if (value === null) host.session?.removeItem(PENDING_KEY)
      else host.session?.setItem(PENDING_KEY, value)
    } catch { /* a private window is not a reason to fail */ }
  }

  /** Unregisters every worker and deletes every cache. Returns what it did. */
  async function clearShell() {
    // Defensive here rather than only in the platform: this is the code path
    // out of a broken state, so it cannot assume the browser is answering. A
    // cache API that throws must cost the caches, not the reset.
    let workers = 0
    try {
      for (const registration of await host.serviceWorkers()) {
        try { if (await registration.unregister()) workers += 1 } catch { /* already gone */ }
      }
    } catch { /* no service worker support, or a browser refusing to say */ }

    let caches = 0
    try {
      for (const key of await host.cacheKeys()) {
        try { if (await host.deleteCache(key)) caches += 1 } catch { /* leave it */ }
      }
    } catch { /* no cache storage */ }

    return { workers, caches }
  }

  /**
   * A backup of everything, in the documented export format.
   *
   * Offered before a reset rather than after, which is the only order that
   * helps: after the reset there is nothing left to export.
   */
  async function backup() {
    const document = await exportSnapshot(storage, clock)
    return {
      filename: `tempered-backup-${clock.today()}.json`,
      json: JSON.stringify(document, null, 2),
      document,
    }
  }

  /**
   * Wipes everything and returns to first run.
   *
   * @param {{confirmation?: string}} [options]
   * @returns {Promise<{ok: boolean, reason?: string, cleared?: object}>}
   */
  async function resetEverything(options = {}) {
    // The typed phrase is checked here, not in the screen. A confirmation that
    // lives only in the UI is a confirmation that the next screen forgets.
    if (String(options.confirmation ?? '').trim().toUpperCase() !== RESET_PHRASE) {
      return { ok: false, reason: `Type ${RESET_PHRASE} to confirm.` }
    }

    // Close first: an open connection blocks deleteDatabase indefinitely.
    try { await storage.close?.() } catch { /* already closed */ }
    await host.deleteDatabase(DATABASE_NAME)
    const cleared = await clearShell()
    stash(null)

    host.reload()
    return { ok: true, cleared }
  }

  /**
   * Drops the shell and reloads, so the next load comes from the network.
   *
   * The version is parked in session storage first, which survives the reload
   * and is what lets the screen say whether anything actually changed.
   */
  async function checkForUpdates() {
    stash(version)
    const cleared = await clearShell()
    host.reload()
    return { ok: true, cleared, before: version }
  }

  /**
   * The result of the last update check, once, or null.
   *
   * Reading it clears it: the answer belongs to the reload that was asked for,
   * and showing "no change" forever after would be noise.
   */
  function updateResult() {
    const before = stashed()
    if (before === null) return null
    stash(null)
    return { before, after: version, changed: before !== version }
  }

  return { backup, resetEverything, checkForUpdates, updateResult, RESET_PHRASE }
}
