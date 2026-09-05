/**
 * Registers the service worker that makes the app work offline.
 *
 * Registered in every environment, including localhost — offline support is an
 * acceptance criterion, so it needs exercising during development rather than
 * only in production. The worker serves stale-while-revalidate, so an edit shows
 * up on the second reload. To wipe it entirely: DevTools → Application →
 * Service Workers → Unregister.
 *
 * @returns {void}
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    // A module worker, so sw.js can import the version its cache key derives
    // from. Registered relative to the document, so it resolves under /tempered/.
    navigator.serviceWorker.register('./sw.js', { type: 'module' })
      .catch((/** @type {unknown} */ moduleError) => {
        // Tempered's supported iOS PWA target is 16.4+. Older iOS versions
        // are not a compatibility target; registration failure still must not
        // hard-fail the foreground app.
        console.error('[tempered] service worker registration failed', moduleError)
      })
  })
}
