/**
 * Registers the generated service worker. Production only: in dev a cached
 * shell would serve stale modules and make changes look like they did nothing.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      // A failed registration costs offline support, not the app.
      console.error('[tempered] service worker registration failed', error)
    })
  })
}
