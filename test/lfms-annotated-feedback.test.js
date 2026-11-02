import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const fuel = read('src/ui/screens/fuel-next.js')
const today = read('src/ui/screens/today.js')
const app = read('src/ui/app.js')
const polish = read('src/lfms-feedback-polish.css')

test('Meal History exposes accessible compact picker, date arrows and Fuel back glyph',()=>{
  const history=fuel.slice(fuel.indexOf('  function journal()'),fuel.indexOf('  // A historical entry already contains'))
  assert.match(history,/fn2__history-title/)
  assert.match(history,/fn2__return-fuel/)
  assert.match(history,/'aria-label':'Back to Fuel'/)
  assert.match(history,/icon\('nav-fuel'\)/)
  assert.match(history,/fn2__date-picker/)
  assert.match(history,/type:'date',value:journalDate,max:clock\.today\(\)/)
  assert.match(history,/onchange:event=>setJournalDate\(event\.target\.value\)/)
  assert.match(history,/!isToday&&el\('button\.fn2__history-today'/)
  assert.match(polish,/\.fn2__date-picker input\[type="date"\]/)
})

test('Sleep preset selects hours without automatically raising keyboard',()=>{
  assert.match(today,/activityId !== 'sleep'\) queueMicrotask/)
  assert.match(today,/input\.blur\(\)/)
  assert.match(today,/aria-pressed/)
  assert.match(today,/step: '0\.01'/)
  assert.match(polish,/data-activity="sleep"/)
  assert.match(polish,/today-editor__input:focus/)
  assert.match(polish,/today-editor__save/)
})

test('Cardio discards old copy and charcoal/orange format but keeps timer logging and pause',()=>{
  const screen=app.slice(app.indexOf('  function renderCardio()'),app.indexOf('  async function launchQuickCardio()'))
  assert.doesNotMatch(screen,/TEMPERED · CARDIO SESSION|TODAY’S FINISHER|Continuous cardio · no lifting sets|Heart rate is a guide; the talk test comes first/)
  assert.doesNotMatch(screen,/Your strength workout remains intact/)
  assert.match(screen,/CARDIO SESSION/)
  assert.match(screen,/icon\('steps'\)/)
  assert.match(screen,/data-set|toggle-cardio-pause|save-cardio/)
  assert.match(screen,/daily\.log\('micro_cardio', actual\)/)
  assert.match(polish,/\.screen--cardio \.cardio-r5__save \{background:var\(--lfms-sub-blue\)/)
  assert.match(polish,/\.screen--cardio \.cardio-r5__progress>span/)
  assert.match(app,/function cardioElapsedCopy/)
})

test('polish loads after earlier CSS and ships offline without changing persisted data',()=>{
  const html=read('index.html'),sw=read('sw.js')
  assert.ok(html.indexOf('food-log-polish.css')<html.indexOf('lfms-feedback-polish.css'))
  assert.match(sw,/'\.\/src\/lfms-feedback-polish\.css'/)
  assert.match(read('src/version.js'),/0\.66\.26 \(132\)/)
  assert.doesNotMatch(polish,/!important/)
})
