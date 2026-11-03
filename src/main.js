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
// This overlay lives outside #app so bootstrap cannot instantly erase it.
const launch = document.querySelector('[data-lfms-launch]')
const splashStarted = performance.now()
let splashDone = null
function dismissSplash() {
  if (splashDone) return splashDone
  // Resolve only AFTER the exit transition and DOM removal. A modal shown
  // during this interval can otherwise cover the LFMS splash artwork.
  splashDone = new Promise(resolve => {
    const remaining = Math.max(0, 3800 - (performance.now() - splashStarted))
    setTimeout(() => {
      if (!launch) { resolve(); return }
      launch.dataset.closing = 'true'
      const finish = () => {
        launch.remove()
        window.dispatchEvent(new Event('tempered:splash-finished'))
        resolve()
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
      // The Duo handoff has a 180ms exit crossfade: remove only after it
      // finishes, without leaving the dark splash sitting over a hidden app.
      else setTimeout(finish, document.documentElement.dataset.layout === 'duo' ? 200 : 520)
    }, remaining)
  })
  return splashDone
}
// Never leave a loading overlay covering a stalled or partially loaded app.
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
