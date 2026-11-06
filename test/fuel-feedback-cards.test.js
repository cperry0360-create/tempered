import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source = read('src/ui/screens/fuel-next.js')
const dashboard = source.slice(source.indexOf('  function dashboard()'),source.indexOf('  function grouped('))
const foodCSS = read('src/food-next.css')
const railCSS = read('src/lfms-finish.css')

test('Fuel dashboard has only balanced Weight and Water cards; Steps data remains intact elsewhere',()=>{
  assert.match(dashboard,/fn2__stats--two/)
  assert.match(dashboard,/fn2__stat--weight/)
  assert.match(dashboard,/fn2__stat--water/)
  assert.doesNotMatch(dashboard,/icon\('steps'\)/)
  assert.match(foodCSS,/\.fn2__stats--two\s*\{grid-template-columns:repeat\(2,/)
})

test('Weight compares latest logged body weight with user-editable persistent goal',()=>{
  assert.match(dashboard,/prefs\.weightGoalLb/)
  assert.match(dashboard,/weight-comparison/)
  assert.match(dashboard,/lb to goal/)
  assert.match(dashboard,/Set goal/)
  assert.match(source,/savePrefs\(\{weightGoalLb:Math\.round\(goal\*10\)\/10\}\)/)
  assert.match(source,/weightGoalOpen&&el\('form/)
})

test('Custom Water validates, saves through existing daily logs, and retains presets',()=>{
  assert.match(dashboard,/8,12,25/)
  assert.match(dashboard,/Custom/)
  assert.match(dashboard,/customWaterOpen&&el\('form/)
  assert.match(source,/daily\.logAt\(selectedDate,'water',Math\.round\(amount\*10\)\/10\)/)
  assert.match(source,/amount<0\.1\|\|amount>200/)
})

test('Duo nav and content share solid soft-black canvas, preserving glass rail',()=>{
  assert.ok(railCSS.includes('html[data-layout="duo"] body {'))
  assert.ok(railCSS.includes('background:var(--lfms-duo-canvas);'))
  assert.ok(railCSS.includes('html[data-layout="duo"] body::before {'))
  assert.ok(railCSS.includes('content:none;'))
  assert.ok(railCSS.includes('display:none;'))
  assert.match(railCSS,/html\[data-layout="duo"\] #app\.app \.tabbar \{\s*background:transparent/)
  assert.match(railCSS,/\.tabbar__glyph/)
})
