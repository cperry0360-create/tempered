import { startEmojiSweep } from './ui/lfms-emoji-sweep.js'
import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'
import { installMobileInteractions } from './ui/mobile-interactions.js'
import { installCableMachineRuntime } from './ui/cable-machine-runtime.js'
import { installCalorieAiRuntime } from './ui/calorie-ai-runtime.js'
import { installHealthPasteRuntime } from './ui/health-paste-runtime.js'
import { installWeeklyRecapRuntime } from './ui/weekly-recap-runtime.js'
import { LFMS_HANDOFF_MS, runBrandHandoff } from './ui/lfms-launch-handoff.js'


// Keep the approved LFMS glass-sweep launch visible on fast devices, too.
// The overlay is OUTSIDE #app, so the real dashboard renders behind it before
// the supplied mark completes its shared-element landing on Today.
const launch = document.querySelector('[data-lfms-launch]')
const splashStarted = performance.now()
// GLASS SWEEP: mark impact -> glass pile -> three deliberate sweeps -> Today.
const LFMS_GLASS_SWEEP_MIN_MS = 7100
const LFMS_GLASS_SWEEP_EXIT_MS = 340
const emojiSweep = startEmojiSweep(launch)
let splashDone = null
function dismissSplash() {
  if (splashDone) return splashDone
  // Bootstrap completes behind the splash while the sweeper clears the last shards.
  splashDone = new Promise(resolve => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const remaining = reduced ? 0 : Math.max(0, LFMS_GLASS_SWEEP_MIN_MS - (performance.now() - splashStarted))
    setTimeout(() => {
      if (!launch) { resolve(); return }
      const finish = () => {
        emojiSweep.then(cleanup => cleanup())
        launch.remove()
        window.dispatchEvent(new Event('tempered:splash-finished'))
        resolve()
      }
      if (reduced) {
        launch.dataset.closing = 'true'
        finish()
        return
      }
      // Preferred exit: fly the supplied mountain to Today's ACTUAL header
      // mark while the already-rendered dashboard is revealed beneath it.
      // If a setup/error screen has no header, use the safe original fade.
      runBrandHandoff(launch, { duration: LFMS_HANDOFF_MS })
        .then(used => {
          if (used) { finish(); return }
          launch.dataset.closing = 'true'
          setTimeout(finish, LFMS_GLASS_SWEEP_EXIT_MS)
        })
        .catch(error => {
          console.warn('[lfms] logo handoff fallback', error)
          launch.dataset.closing = 'true'
          setTimeout(finish, LFMS_GLASS_SWEEP_EXIT_MS)
        })
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
