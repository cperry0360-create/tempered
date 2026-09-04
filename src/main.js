import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'

registerServiceWorker()

bootstrap().catch((error) => {
  console.error('[tempered] failed to start', error)
  const app = document.getElementById('app')
  if (app) {
    app.textContent = 'Tempered could not start. Reload to try again.'
    app.className = 'shell'
  }
})
