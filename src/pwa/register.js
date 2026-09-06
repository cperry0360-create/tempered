import { VERSION } from '../version.js'

/**
 * Registers the service worker that makes the app work offline.
 *
 * Updates are checked explicitly on every launch and the worker script bypasses
 * the browser's HTTP cache. The service worker itself owns the atomic handoff:
 * when a new version activates it reloads open Tempered windows once, so an
 * installed PWA cannot keep running a mixture of old JavaScript and new CSS.
 *
 * @returns {void}
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    // Safari/iOS can be conservative about noticing a module worker whose
    // top-level sw.js bytes are unchanged even when an imported version module
    // changed. Put the visible release in the worker URL so every Tempered
    // release is an unambiguous service-worker update on Home Screen installs.
    const workerUrl = new URL('../../sw.js', import.meta.url)
    workerUrl.searchParams.set('build', VERSION)

    navigator.serviceWorker.register(workerUrl, {
      type: 'module',
      updateViaCache: 'none',
    })
      .then((registration) => registration.update())
      .catch((/** @type {unknown} */ moduleError) => {
        // Tempered's supported iOS PWA target is 16.4+. Registration/update
        // failure must never hard-fail the foreground app.
        console.error('[tempered] service worker registration failed', moduleError)
      })
  })
}
