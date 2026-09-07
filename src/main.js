import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'
import { installBattleFx } from './ui/battle-fx-runtime.js'
import { installWaterQuickPresets } from './ui/water-quick-presets.js'
import { installMobileInteractions } from './ui/mobile-interactions.js'
import { installCableMachineRuntime } from './ui/cable-machine-runtime.js'

registerServiceWorker()
installWaterQuickPresets()
installMobileInteractions()

// Importing the FX module installs the presentation-only listener. Keep the
// named import so the offline precache contract can follow the module graph.
void installBattleFx

bootstrap()
  .then(async (context) => {
    installSessionGuard(context)
    await installCableMachineRuntime(context)
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