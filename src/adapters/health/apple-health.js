/**
 * Native Apple Health adapter.
 *
 * The browser/PWA never sees this bridge. The iOS wrapper injects a
 * `window.webkit.messageHandlers.temperedHealth` message handler and replies
 * through `window.__temperedHealthReceive(...)`.
 */

const pending = new Map()
const receiverScopes = new WeakSet()
let sequence = 0

export function appleHealthBridgeAvailable(scope = globalThis) {
  return Boolean(scope?.webkit?.messageHandlers?.temperedHealth?.postMessage)
}

function installReceiver(scope = globalThis) {
  if (receiverScopes.has(scope)) return
  receiverScopes.add(scope)
  scope.__temperedHealthReceive = (message) => {
    const id = message?.id
    const request = pending.get(id)
    if (!request) return
    pending.delete(id)
    clearTimeout(request.timer)
    if (message?.ok === false) {
      request.reject(new Error(message?.error || 'Apple Health request failed'))
      return
    }
    request.resolve(message?.data ?? null)
  }
}

function request(action, payload = {}, scope = globalThis) {
  if (!appleHealthBridgeAvailable(scope)) {
    return Promise.reject(new Error('Apple Health native bridge is unavailable'))
  }
  installReceiver(scope)
  const id = `hk_${Date.now()}_${++sequence}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Apple Health ${action} timed out`))
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    scope.webkit.messageHandlers.temperedHealth.postMessage({ id, action, ...payload })
  })
}

/** @returns {import('./health-adapter.js').HealthAdapter & {requestAuthorization: () => Promise<any>}} */
export function createAppleHealth(scope = globalThis) {
  return {
    kind: 'apple-health',

    async isAvailable() {
      return appleHealthBridgeAvailable(scope)
    },

    async requestAuthorization() {
      return request('requestAuthorization', {}, scope)
    },

    async read(date) {
      const data = await request('read', { date }, scope)
      if (!data) return null
      return {
        date,
        steps: Number.isFinite(Number(data.steps)) ? Number(data.steps) : null,
        sleepHours: Number.isFinite(Number(data.sleepHours)) ? Number(data.sleepHours) : null,
        waterOz: null,
        source: 'device',
      }
    },

    async write() {
      throw new Error('Apple Health adapter is read-only')
    },
  }
}
