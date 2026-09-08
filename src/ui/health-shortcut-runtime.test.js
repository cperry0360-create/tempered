import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HEALTH_SNAPSHOT_PREFIX, healthImportUrl, parseHealthSnapshot,
} from './health-shortcut-runtime.js'

test('parses the iPhone Shortcut Health snapshot format', () => {
  const parsed = parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-08\nSTEPS=10,527\nSLEEP=7.75\nWEIGHT_LB=164.2\nRESTING_HR=49\nHRV_MS=41\nRESP_RATE=12\nSPO2=97\nBODY_TEMP_C=36.4`)
  assert.deepEqual(parsed, {
    date: '2026-09-08',
    steps: 10527,
    sleepHours: 7.75,
    weightLb: 164.2,
    restingHr: 49,
    hrvMs: 41,
    respiratoryRate: 12,
    spo2: 97,
    bodyTempC: 36.4,
  })
})

test('rejects unrelated clipboard text and empty snapshots', () => {
  assert.equal(parseHealthSnapshot('STEPS=1234'), null)
  assert.equal(parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-08`), null)
})

test('allows partial snapshots because Health permissions are per metric', () => {
  assert.deepEqual(parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nSTEPS=3210\nSLEEP=`), { steps: 3210 })
})

test('builds a one-tap import URL whose search parameter round-trips exactly', () => {
  const snapshot = `${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-08\nSTEPS=10527\nSLEEP=7.75\nSPO2=97%`
  const handoff = healthImportUrl(snapshot)
  const url = new URL(handoff)
  assert.equal(url.origin + url.pathname, 'https://cperry0360-create.github.io/tempered/')
  assert.equal(url.searchParams.get('temperedHealth'), snapshot)
  assert.equal(parseHealthSnapshot(url.searchParams.get('temperedHealth')).spo2, 97)
})

test('refuses to build a handoff URL for unrelated data', () => {
  assert.throws(() => healthImportUrl('hello world'), /No Tempered Health snapshot/)
})
