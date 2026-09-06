import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'

registerServiceWorker()

bootstrap()
  .then((context) => { installSessionGuard(context) })
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
