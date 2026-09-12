import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HEALTH_SHORTCUT_RECIPE, HEALTH_SNAPSHOT_PREFIX, MAX_SHORTCUT_SLEEP_HOURS, healthImportUrl, importHealthSnapshot, parseHealthSnapshot,
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
  assert.equal(parseHealthSnapshot(HEALTH_SHORTCUT_RECIPE), null)
  assert.equal(parseHealthSnapshot(`Here are your results:\n${HEALTH_SNAPSHOT_PREFIX}\nSLEEP=7.75`), null)
  assert.equal(parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nSLEEP=<decimal hours, e.g. 7.75>`), null)
})

test('allows partial snapshots because Health permissions are per metric', () => {
  assert.deepEqual(parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nSTEPS=3210\nSLEEP=`), { steps: 3210 })
})

test('accepts the unit-formatted values Shortcuts commonly emits', () => {
  assert.deepEqual(parseHealthSnapshot(`${HEALTH_SNAPSHOT_PREFIX}\nSTEPS=10,527 steps\nWEIGHT_KG=74.5 kg\nRESTING_HR=49 bpm\nHRV_MS=41 ms\nRESP_RATE=12 breaths/min\nSPO2=97%\nBODY_TEMP_F=98.6 °F`), {
    steps: 10527,
    weightKg: 74.5,
    restingHr: 49,
    hrvMs: 41,
    respiratoryRate: 12,
    spo2: 97,
    bodyTempF: 98.6,
  })
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

test('implausible Shortcut sleep is skipped and an earlier bad import is cleared', async () => {
  let day = { date: '2026-09-08', sleepHours: 21 }
  const daily = {
    async logAt(date, activity, value) {
      day = { ...day, date, ...(activity === 'steps' ? { steps: value } : {}), ...(activity === 'sleep' ? { sleepHours: value } : {}) }
    },
    async dayLog() { return { ...day } },
  }
  const storage = { async put(store, value) { if (store === 'dayLogs') day = { ...value } } }
  const clock = { today: () => '2026-09-08', nowIso: () => '2026-09-08T09:00:00.000Z' }

  const result = await importHealthSnapshot({ storage, clock, daily }, `${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-08\nSTEPS=1234\nSLEEP=21`)
  assert.equal(MAX_SHORTCUT_SLEEP_HOURS, 16)
  assert.equal(day.sleepHours, null)
  assert.equal(day.steps, 1234)
  assert.match(result.warnings[0], /Sleep was skipped/)
})
