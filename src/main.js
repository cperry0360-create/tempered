import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'
import { installMobileInteractions } from './ui/mobile-interactions.js'
import { installCableMachineRuntime } from './ui/cable-machine-runtime.js'
import { installCalorieAiRuntime } from './ui/calorie-ai-runtime.js'
import { installHealthPasteRuntime } from './ui/health-paste-runtime.js'
import { installWeeklyRecapRuntime } from './ui/weekly-recap-runtime.js'

// Keep the supplied LFMS launch artwork visible on fast devices, too.
// The overlay is OUTSIDE #app, so the finished dashboard is rendered behind
// it BEFORE the loaded barbell pulls the splash away.
const launch = document.querySelector('[data-lfms-launch]')
const splashStarted = performance.now()
const LFMS_PLATES_SETTLED_MS = 3990
const LFMS_PEEL_DURATION_MS = 1020
let splashDone = null
function dismissSplash() {
  if (splashDone) return splashDone
  // Peel the splash skin directly onto the already-rendered app; no fake wire or fade.
  // Never start the wipe before bootstrap and BOTH stacks of three bumper plates are done.
  splashDone = new Promise(resolve => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const remaining = reduced ? 0 : Math.max(0, LFMS_PLATES_SETTLED_MS - (performance.now() - splashStarted))
    setTimeout(() => {
      if (!launch) { resolve(); return }
      const finish = () => {
        launch.remove()
        window.dispatchEvent(new Event('tempered:splash-finished'))
        resolve()
      }
      if (reduced) {
        launch.dataset.closing = 'true'
        finish()
        return
      }
      // This also exposes the already-rendered app beneath the moving mask.
      launch.dataset.revealing = 'true'
      setTimeout(() => {
        launch.dataset.closing = 'true'
        // Let the peel's last frame render before removing the overlay.
        setTimeout(finish, 90)
      }, LFMS_PEEL_DURATION_MS)
    }, remaining)
  })
  return splashDone
}
// Never leave the splash covering a stalled or partially loaded app.
setTimeout(dismissSplash, 8000)

registerServiceWorker()
installMobileInteractions()
installCalorieAiRuntime()

bootstrap()
  .then(async (context) => {
    installSessionGuard(context)
    // The failed iOS Shortcut experiment remains dormant. ChatGPT Health now
    // supplies a predictable nine-line snapshot, so expose only the explicit
    // review-and-paste bridge in Daily Recap.
    installHealthPasteRuntime(context)
    try {
      await installCableMachineRuntime(context)
    } catch (error) {
      // Equipment preferences are optional. A malformed saved profile should
      // never turn a working tracker into a startup failure.
      console.error('[tempered] cable machine setup failed', error)
    }
    // Weekly recap is intentionally post-splash: modal focus and its backdrop
    // should never obscure or interrupt the animated launch artwork.
    await dismissSplash()
    await installWeeklyRecapRuntime(context)
  })
  .catch((error) => {
    dismissSplash()
    console.error('[tempered] failed to start', error)
    const app = document.getElementById('app')
    if (!app) return

    app.className = 'shell'
    app.replaceChildren(errorState({
      title: 'Less Fat More Strong could not start',
      detail: 'Your saved data has not been changed. Reload the app and try again.',
      onRetry: () => window.location.reload(),
    }))
  })
