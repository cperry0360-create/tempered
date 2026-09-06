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
    // A module worker, so sw.js can import the version its cache key derives
    // from. updateViaCache:none matters on iOS Home Screen installs: a launch
    // should ask the server whether sw.js changed rather than trusting a stale
    // HTTP-cache copy of the worker script or its imports.
    navigator.serviceWorker.register('./sw.js', {
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
