import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'

registerServiceWorker()

bootstrap()
  .then((context) => { installSessionGuard(context) })
  .catch((error) => {
    console.error('[tempered] failed to start', error)
    const app = document.getElementById('app')
    if (app) {
      app.textContent = 'Tempered could not start. Reload to try again.'
      app.className = 'shell'
    }
  })
