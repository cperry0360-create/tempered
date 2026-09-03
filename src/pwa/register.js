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
    // Relative to the document, so this resolves correctly under /tempered/.
    navigator.serviceWorker.register('./sw.js').catch((/** @type {unknown} */ error) => {
      // A failed registration costs offline support, not the app.
      console.error('[tempered] service worker registration failed', error)
    })
  })
}
