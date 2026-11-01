import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHATGPT_HEALTH_PROMPT, healthSnapshotPreview } from './health-paste-runtime.js'

test('ChatGPT Health prompt preserves the exact nine-line Tempered contract', () => {
  assert.match(CHATGPT_HEALTH_PROMPT, /TEMPERED_HEALTH_V1\nDATE=\nSTEPS=\nSLEEP=\nWEIGHT_LB=\nRESTING_HR=\nHRV_MS=\nRESP_RATE=\nSPO2=/)
  assert.doesNotMatch(CHATGPT_HEALTH_PROMPT, /BODY_TEMP/)
})

test('preview shows only populated fields and safely accepts blank sleep', () => {
  const preview = healthSnapshotPreview(`TEMPERED_HEALTH_V1
DATE=2026-09-13
STEPS=701
SLEEP=
WEIGHT_LB=167.6
RESTING_HR=60
HRV_MS=60
RESP_RATE=17
SPO2=96`, '2026-09-13')

  assert.equal(preview.date, '2026-09-13')
  assert.equal(preview.dateMatchesToday, true)
  assert.deepEqual(preview.metrics.map(({ key }) => key), [
    'steps', 'weightLb', 'restingHr', 'hrvMs', 'respiratoryRate', 'spo2',
  ])
  assert.equal(preview.metrics.some(({ key }) => key === 'sleepHours'), false)
})

test('preview calls out an earlier dated snapshot instead of silently presenting it as today', () => {
  const preview = healthSnapshotPreview('TEMPERED_HEALTH_V1\nDATE=2026-09-12\nSTEPS=9000', '2026-09-13')
  assert.equal(preview.dateMatchesToday, false)
  assert.equal(preview.date, '2026-09-12')
  assert.equal(preview.dateIsFuture, false)
})

test('preview identifies a future date that the importer will safely coerce to today', () => {
  const preview = healthSnapshotPreview('TEMPERED_HEALTH_V1\nDATE=2026-09-14\nSTEPS=9000', '2026-09-13')
  assert.equal(preview.dateMatchesToday, false)
  assert.equal(preview.dateIsFuture, true)
})

test('flattened one-line Health paste accepts blank fields and keeps numeric boundaries', () => {
  const snapshot = 'TEMPERED_HEALTH_V1 DATE=2026-11-01 STEPS= SLEEP= WEIGHT_LB=168.6 RESTING_HR=62 HRV_MS=34.7 RESP_RATE=16 SPO2=96'
  const preview = healthSnapshotPreview(snapshot, '2026-11-01')
  assert.ok(preview, 'the exact snapshot pasted on the Duo should be recognized')
  assert.equal(preview.parsed.date, '2026-11-01')
  assert.deepEqual(preview.metrics.map(({ key }) => key), [
    'weightLb', 'restingHr', 'hrvMs', 'respiratoryRate', 'spo2',
  ])
  assert.equal(preview.parsed.weightLb, 168.6)
  assert.equal(preview.parsed.restingHr, 62)
  assert.equal(preview.parsed.hrvMs, 34.7)
  assert.equal(preview.parsed.respiratoryRate, 16)
  assert.equal(preview.parsed.spo2, 96)
  assert.ok(!('steps' in preview.parsed) && !('sleepHours' in preview.parsed))
})

test('flattened fields do not allow unrelated text or a date-only import', () => {
  for (const bad of [
    'Not Tempered DATE=2026-11-01 WEIGHT_LB=168.6',
    'TEMPERED_HEALTH_V1FAKE DATE=2026-11-01 WEIGHT_LB=168.6',
    'TEMPERED_HEALTH_V1 DATE=2026-11-01 STEPS= SLEEP=',
  ]) {
    assert.equal(healthSnapshotPreview(bad, '2026-11-01'), null)
  }
})
