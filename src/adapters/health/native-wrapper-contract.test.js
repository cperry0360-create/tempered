import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('native iOS target carries the HealthKit entitlement and privacy copy', () => {
  const entitlements = read('native/ios/Tempered/Tempered.entitlements')
  const info = read('native/ios/Tempered/Info.plist')
  const project = read('native/ios/Tempered.xcodeproj/project.pbxproj')

  assert.match(entitlements, /com\.apple\.developer\.healthkit/)
  assert.match(info, /NSHealthShareUsageDescription/)
  assert.match(info, /steps and sleep/i)
  assert.match(project, /HealthKit\.framework/)
  assert.match(project, /CODE_SIGN_ENTITLEMENTS = Tempered\/Tempered\.entitlements/)
  assert.match(info, /UISupportedInterfaceOrientations[\s\S]*UIInterfaceOrientationPortrait/)
  assert.doesNotMatch(info, /UIInterfaceOrientationLandscape/)
})

test('native wrapper exposes only the expected read-only bridge actions', () => {
  const webView = read('native/ios/Tempered/TemperedWebView.swift')
  const health = read('native/ios/Tempered/HealthKitBridge.swift')

  assert.match(webView, /name: "temperedHealth"/)
  assert.match(webView, /case "requestAuthorization"/)
  assert.match(webView, /case "read"/)
  assert.doesNotMatch(webView, /case "write"/)
  assert.match(health, /\.stepCount/)
  assert.match(health, /\.sleepAnalysis/)
  assert.match(health, /Set<HKSampleType>\(\)/, 'no HealthKit sample types are requested for writing')
})

test('native wrapper keeps the screen awake only while a workout is active', () => {
  const webView = read('native/ios/Tempered/TemperedWebView.swift')
  const session = read('src/ui/screens/session.js')
  assert.match(webView, /name: "temperedWakeLock"/)
  assert.match(webView, /UIApplication\.shared\.isIdleTimerDisabled = active/)
  assert.match(session, /navigator\.wakeLock.*request.*['"]screen['"]/s)
  assert.match(session, /releaseWorkoutWakeLock\(\)/)
  assert.match(session, /data-session-elapsed|sessionElapsed/)
})

test('sleep import uses wake-date noon-to-noon and merges overlapping asleep stages', () => {
  const health = read('native/ios/Tempered/HealthKitBridge.swift')
  assert.match(health, /date\(bySettingHour: 12/)
  assert.match(health, /asleepCore/)
  assert.match(health, /asleepDeep/)
  assert.match(health, /asleepREM/)
  assert.match(health, /if interval\.0 <= current\.1/)
  assert.match(health, /guard hours <= 16 else \{ return nil \}/)
})
