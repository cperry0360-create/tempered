import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const capture = readFileSync(root + 'tools/capture-release-screens.js', 'utf8')
const page = readFileSync(root + 'test/browser/release-visual.html', 'utf8')
const workflow = readFileSync(root + '.github/workflows/tests.yml', 'utf8')
const contract = readFileSync(root + 'docs/PRODUCT-TEAM.md', 'utf8')

test('release evidence covers onboarding and every core product surface', () => {
  for (const view of [
    'setup-welcome', 'setup-rhythm', 'setup-plan', 'today', 'train', 'session', 'fuel',
    'progress-score-progression', 'progress-score-adherence', 'progress-score-consistency', 'progress-score-volume',
    'progress', 'progress-lifts', 'progress-lift-detail', 'progress-habits', 'progress-log', 'progress-log-detail',
    'settings', 'program-builder', 'summary',
    'health-import', 'health-review', 'nutrition-log', 'nutrition-meal', 'session-discard',
    'train-rhythm', 'train-program-details', 'train-routine', 'train-library',
    'today-expanded', 'today-day-details', 'mobility',
  ]) {
    assert.match(capture, new RegExp(`['"]${view}['"]`), `capture matrix is missing ${view}`)
  }
  assert.match(page, /Unknown release visual/)
  assert.match(page, /__visual-ready/)
})

test('release evidence covers both supported iPhone viewport classes', () => {
  assert.match(capture, /390, height: 844/)
  assert.match(capture, /430, height: 932/)
  assert.match(capture, /Emulation\.setDeviceMetricsOverride/)
  assert.match(capture, /Page\.captureScreenshot/)
  assert.match(capture, /const THEMES = \['light', 'dark'\]/)
  assert.match(capture, /image\.width !== viewport\.width \|\| image\.height !== viewport\.height/)
})

test('CI preserves the captures and the contract requires direct inspection', () => {
  assert.match(workflow, /node tools\/capture-release-screens\.js/)
  assert.match(workflow, /actions\/upload-artifact@v4/)
  assert.match(contract, /Generating images is not visual sign-off; Codex must open and inspect them\./)
  assert.match(contract, /Verify production/)
})
