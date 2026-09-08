import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appleHealthBridgeAvailable, createAppleHealth } from './apple-health.js'

function bridgeScope(handler) {
  const scope = {
    webkit: {
      messageHandlers: {
        temperedHealth: {
          postMessage(message) { handler(scope, message) },
        },
      },
    },
  }
  return scope
}

test('Apple Health is available only inside the native bridge', async () => {
  assert.equal(appleHealthBridgeAvailable({}), false)
  const scope = bridgeScope(() => {})
  assert.equal(appleHealthBridgeAvailable(scope), true)
  assert.equal(await createAppleHealth(scope).isAvailable(), true)
})

test('authorization and read requests round-trip through the native bridge', async () => {
  const actions = []
  const scope = bridgeScope((target, message) => {
    actions.push(message.action)
    queueMicrotask(() => {
      if (message.action === 'requestAuthorization') {
        target.__temperedHealthReceive({ id: message.id, ok: true, data: { authorized: true } })
        return
      }
      target.__temperedHealthReceive({
        id: message.id,
        ok: true,
        data: { steps: 12345, sleepHours: 7.75 },
      })
    })
  })
  const health = createAppleHealth(scope)

  assert.deepEqual(await health.requestAuthorization(), { authorized: true })
  assert.deepEqual(await health.read('2026-09-08'), {
    date: '2026-09-08',
    steps: 12345,
    sleepHours: 7.75,
    waterOz: null,
    source: 'device',
  })
  assert.deepEqual(actions, ['requestAuthorization', 'read'])
})

test('native errors are surfaced and the adapter never writes HealthKit', async () => {
  const scope = bridgeScope((target, message) => {
    queueMicrotask(() => target.__temperedHealthReceive({
      id: message.id,
      ok: false,
      error: 'Health access denied',
    }))
  })
  const health = createAppleHealth(scope)
  await assert.rejects(() => health.read('2026-09-08'), /Health access denied/)
  await assert.rejects(() => health.write('2026-09-08', { steps: 1 }), /read-only/)
})
