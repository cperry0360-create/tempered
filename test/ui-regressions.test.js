import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createDailyService } from '../src/app/daily.js'
import { ensureProfile } from '../src/app/seed.js'
import { hasDailyGoal, dailyGoalComplete } from '../src/ui/screens/today.js'
import { loadBalance } from './helpers/balance.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const catalogue = JSON.parse(read('data/activities.json'))
const balance = loadBalance()

async function harness() {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-05T12:00:00.000Z')
  await ensureProfile(storage, clock)
  const daily = createDailyService({ storage, clock, balance, catalogue })
  return { storage, daily }
}

test('REGRESSION: a partial daily goal is progress, not completion', () => {
  const water = { id: 'water', dailyCap: 120, value: 8, logged: true }
  assert.equal(hasDailyGoal(water), true)
  assert.equal(dailyGoalComplete(water), false)
  assert.equal(dailyGoalComplete({ ...water, value: 119 }), false)
  assert.equal(dailyGoalComplete({ ...water, value: 120 }), true)
  assert.equal(dailyGoalComplete({ id: 'journal', logged: true }), true)
})

test('REGRESSION: water accumulates across separate drinks and only finishes at the cap', async () => {
  const { daily } = await harness()
  await daily.setCadence('water', 'daily')

  await daily.log('water', 8)
  let water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 8)
  assert.equal(dailyGoalComplete(water), false)

  await daily.log('water', 10)
  water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 18, 'the second drink adds to the first rather than replacing it')
  assert.equal(dailyGoalComplete(water), false)

  await daily.log('water', 102)
  water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 120)
  assert.equal(dailyGoalComplete(water), true)
})

test('REGRESSION: Today preserves additive semantics for manual and custom quick-add entries', () => {
  const today = read('src/ui/screens/today.js')
  assert.doesNotMatch(today, /entryMode/)
  assert.doesNotMatch(today, /mode:\s*['"]set['"]/)
  assert.match(today, /dailyGoalComplete/)
  assert.match(today, /dailyGoalLabel/)
  assert.match(today, /record\(activity, input\.value\)/)
  assert.match(today, /record\(activity, String\(preset\)\)/)
  assert.match(today, /daily\.logAt\(selectedDate, activity\.id, value, options\)/)
})

test('REGRESSION: Today keeps one additive Water quick action instead of the old three-button enhancer', () => {
  const today = read('src/ui/screens/today.js')
  const main = read('src/main.js')
  assert.match(today, /water:\s*20/)
  assert.match(today, /record\(activity, String\(preset\)\)/)
  assert.match(today, /data(?:set)?:?\s*adding && preset !== null|quickadd/)
  assert.doesNotMatch(main, /installWaterQuickPresets/)
})

test('REGRESSION: iOS Home Screen worker URL changes with every visible release', () => {
  const register = read('src/pwa/register.js')
  assert.match(register, /import \{ VERSION \} from '\.\.\/version\.js'/)
  assert.match(register, /searchParams\.set\('build', VERSION\)/)
  assert.match(register, /updateViaCache:\s*'none'/)
})

test('REGRESSION: cancel exercise uses Tempered UI, not a browser confirm', () => {
  const guard = read('src/ui/session-guard.js')
  const style = read('src/style.css')
  assert.doesNotMatch(guard, /window\.confirm|globalThis\.confirm/)
  assert.match(guard, /confirmDiscardExercise/)
  assert.match(guard, /aria-modal/)
  assert.match(guard, /DISCARD EXERCISE\?/)
  assert.match(guard, /clearActiveSessionDraft\(\)/)
  assert.match(style, /\.confirm-overlay/)
  assert.match(style, /\.confirm-sheet/)
})

test('REGRESSION: every screen respects the safe area and 16px Redesign V1 gutter', () => {
  const style = read('src/style.css')
  assert.match(style, /\.app__body\s*\{[\s\S]*padding:\s*calc\(env\(safe-area-inset-top\) \+ 16px\) 16px/)
})

test('REGRESSION: Character no longer carries a duplicate Settings button', () => {
  const character = read('src/ui/screens/character.js')
  assert.doesNotMatch(character, /\['SETTINGS'\]/)
  assert.doesNotMatch(character, /dataset:\s*\{\s*tab:\s*'settings'/)
})

test('REGRESSION: Progress widgets wake on the first mounted Progress screen', () => {
  const app = read('src/ui/app.js')
  const dashboard = read('src/ui/progress-dashboard-runtime.js')
  const progressCss = read('src/progress.css')
  assert.match(app, /tempered:screen-shown/)
  assert.match(app, /detail:\s*\{\s*tab:\s*target\s*\}/)
  assert.match(dashboard, /addEventListener\('tempered:screen-shown'/)
  assert.match(dashboard, /detail\?\.tab\s*===\s*'history'/)
  assert.match(dashboard, /progress-range__button, \.progress-views \.segmented__option/)
  assert.match(dashboard, /syncEditMode\(dashboard, order\)/)
  assert.match(dashboard, /syncGallery\(dashboard, data, order\)/)
  assert.doesNotMatch(dashboard, /new MutationObserver/)
  assert.doesNotMatch(dashboard, /\[data-progress-dashboard\]'\)\?\.remove/)
  assert.match(progressCss, /\.progress-panel\[hidden\]\s*\{\s*display:\s*none\s*!important/)
  const pivotCss = read('src/pivot.css')
  assert.match(pivotCss, /\.progress-widget\s*\{[\s\S]*animation:\s*none\s*!important/)
  assert.match(pivotCss, /\.progress-widget\s*\{[\s\S]*backdrop-filter:\s*none/)
})

test('REGRESSION: longer Progress ranges exclude unknown pre-Tempered history', () => {
  const history = read('src/ui/screens/history.js')
  const dashboard = read('src/ui/progress-dashboard-runtime.js')
  assert.match(history, /progressDataStart/)
  assert.match(history, /observedProgressDates/)
  assert.match(history, /fullCoverage/)
  assert.match(history, /'DAYS'\}\s+OF DATA/)
  assert.match(dashboard, /progressDataStart/)
  assert.match(dashboard, /recordedSampleCount/)
  assert.doesNotMatch(dashboard, /value \?\? min/)
})

test('REGRESSION: lower-row turtle stages use a taller undistorted viewport', () => {
  const companion = read('src/companion.css')
  const setup = read('src/setup.css')
  const style = read('src/style.css')
  assert.match(companion, /data-visual='8'[\s\S]*aspect-ratio:\s*\.89/)
  assert.match(companion, /background-size:\s*500% auto/)
  assert.match(setup, /data-style='turtle'[\s\S]*background-size:\s*500% auto/)
  assert.match(style, /summary-power__art--turtle[\s\S]*background-size:\s*500% auto/)
})

test('REGRESSION: active workouts can add movements, minimize, and resume', () => {
  const session = read('src/ui/screens/session.js')
  const app = read('src/ui/app.js')
  const bootstrap = read('src/app/bootstrap.js')
  assert.match(session, /data-action['"]?:\s*['"]add-movement|action:\s*'add-movement'/)
  assert.match(session, /workout\.prepareExercise\(exercise\.id/)
  assert.match(session, /action:\s*'minimize-workout'/)
  assert.match(session, /onMinimize/)
  assert.match(app, /loadActiveSessionDraft/)
  assert.match(app, /data-active-workout|activeWorkout/)
  assert.match(app, /resumeSession\(current\)/)
  assert.doesNotMatch(bootstrap, /clearActiveSessionDraft/)
})

test('REGRESSION: ChatGPT Health paste is live while the failed Shortcut UI stays dormant', () => {
  const main = read('src/main.js')
  const dashboard = read('src/ui/progress-dashboard-runtime.js')
  const health = read('src/ui/health-shortcut-runtime.js')
  const snapshot = read('src/ui/health-snapshot.js')
  const paste = read('src/ui/health-paste-runtime.js')
  assert.doesNotMatch(main, /installHealthShortcutRuntime/)
  assert.match(main, /installHealthPasteRuntime\(context\)/)
  assert.match(paste, /data-health-paste-input/)
  assert.match(paste, /data-health-paste-preview/)
  assert.match(paste, /source:\s*'chatgpt-health'/)
  assert.doesNotMatch(paste, /shortcuts:\/\//)
  assert.doesNotMatch(dashboard, /body:\s*\{\s*title:\s*'Body metrics'/)
  assert.doesNotMatch(dashboard, /data\.healthSetup|tempered:open-health-setup/)
  // Preserve the dormant parser/setup implementation so native-distribution
  // work can resume without reconstructing or migrating earlier imports.
  assert.match(health, /data-health-import-overlay|dataset\.healthImportOverlay/)
  assert.match(health, /data-health-import-input|dataset\.healthImportInput/)
  assert.match(health, /shortcuts:\/\/run-shortcut\?name=Tempered%20Health/)
  assert.match(snapshot, /export function parseHealthSnapshot/)
  assert.match(snapshot, /export async function importHealthSnapshot/)
})

test('REGRESSION: Health import is reached from the R2 Readiness card and redraws Today', () => {
  const today = read('src/ui/screens/today.js')
  const paste = read('src/ui/health-paste-runtime.js')
  assert.match(today, /No recovery data today/)
  assert.match(today, /Import from Health/)
  assert.match(today, /tempered:open-health-import/)
  assert.match(today, /healthMetrics\?\.restingHr/)
  assert.match(today, /healthMetrics\?\.hrvMs/)
  assert.match(paste, /addEventListener\('tempered:open-health-import'/)
  assert.match(paste, /tempered:health-imported/)
})

test('REGRESSION: practical surfaces lead and Fuel is a first-class tab', () => {
  const app = read('src/ui/app.js')
  const fuel = read('src/ui/screens/fuel.js')
  const train = read('src/ui/screens/train.js')
  assert.match(app, /id:\s*'fuel',\s*label:\s*'Fuel'/)
  assert.doesNotMatch(app, /id:\s*'companion'/)
  assert.match(app, /createFuelScreen/)
  assert.match(fuel, /HYDRATION/)
  assert.match(fuel, /fuel-meals__row/)
  const style = read('src/style.css')
  assert.match(train, /training-calendar-scroll/)
  assert.match(style, /\.training-calendar-scroll\s*\{[\s\S]*overflow-x:\s*auto/)
})

test('REGRESSION: R2 Today removes Daily Recap and uses bounded Health import instead', () => {
  const today = read('src/ui/screens/today.js')
  const paste = read('src/ui/health-paste-runtime.js')
  const pasteCss = read('src/pivot.css')
  assert.doesNotMatch(today, /Daily recap|today-recap|data-daily-recap/)
  assert.match(today, /tempered:open-health-import/)
  assert.match(paste, /health-paste-overlay/)
  assert.match(pasteCss, /\.health-paste-overlay[\s\S]*z-index:\s*1500/)
})

test('REGRESSION: Health import redraws Today without injecting a prior-day card', () => {
  const health = read('src/ui/health-paste-runtime.js')
  const nutrition = read('src/ui/calorie-ai-runtime.js')
  const app = read('src/ui/app.js')
  assert.match(health, /context\.app\?\.show/)
  assert.doesNotMatch(nutrition, /dataPriorDayReview|dataset\.priorDayReview/)
  assert.match(app, /showTodayDate/)
})

test('REGRESSION: Nutrition supports correcting an earlier date', () => {
  const nutrition = read('src/ui/calorie-ai-runtime.js')
  const css = read('src/nutrition-today.css')
  assert.match(nutrition, /data\.nutritionDate|dataset\.nutritionDate/)
  assert.match(nutrition, /switchNutritionDate/)
  assert.match(css, /\.nutrition-date-picker/)
})

test('REGRESSION: AI coaching includes the latest workout and confirmed records', () => {
  const train = read('src/ui/screens/train.js')
  assert.match(train, /LATEST_WORKOUT_BEST_SETS/)
  assert.match(train, /LATEST_WORKOUT_CONFIRMED_PRS/)
  assert.match(train, /latestSession/)
  assert.match(train, /specific next-session progression/)
})

test('REGRESSION: Fuel exposes practical hydration, meal, and recovery surfaces', () => {
  const companion = read('src/ui/screens/companion.js')
  const progress = read('src/ui/progress-dashboard-runtime.js')
  assert.match(companion, /HYDRATION/)
  assert.match(companion, /fuel-meals__row/)
  assert.match(companion, /RESTING HR/)
  assert.match(progress, /calorieQualitySummary/)
  assert.match(progress, /recovery:\s*\{ title:\s*'Recovery signals'/)
})
