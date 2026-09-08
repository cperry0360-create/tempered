import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'
import { installBattleFx } from './ui/battle-fx-runtime.js'
import { installWaterQuickPresets } from './ui/water-quick-presets.js'
import { installMobileInteractions } from './ui/mobile-interactions.js'
import { installCableMachineRuntime } from './ui/cable-machine-runtime.js'
import { installCalorieAiRuntime } from './ui/calorie-ai-runtime.js'
import { installHealthShortcutRuntime } from './ui/health-shortcut-runtime.js'
import { installProgressDashboardRuntime } from './ui/progress-dashboard-runtime.js'

registerServiceWorker()
installWaterQuickPresets()
installMobileInteractions()
installCalorieAiRuntime()

// Kept only for backwards-compatible legacy routes. Battle is no longer part
// of normal navigation after the companion pivot.
void installBattleFx

bootstrap()
  .then(async (context) => {
    installSessionGuard(context)
    installHealthShortcutRuntime(context)
    installProgressDashboardRuntime(context)
    try {
      await installCableMachineRuntime(context)
    } catch (error) {
      // Equipment preferences are optional. A malformed saved profile should
      // never turn a working tracker into a startup failure.
      console.error('[tempered] cable machine setup failed', error)
    }
  })
  .catch((error) => {
    console.error('[tempered] failed to start', error)
    const app = document.getElementById('app')
    if (!app) return

    app.className = 'shell'
    app.replaceChildren(errorState({
      title: 'Tempered could not start',
      detail: 'Your saved data has not been changed. Reload the app and try again.',
      onRetry: () => window.location.reload(),
    }))
  })