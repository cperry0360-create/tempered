import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const fuel=read('src/ui/screens/fuel-next.js')
const runtime=read('src/ui/calorie-ai-runtime.js')
const css=read('src/food-next.css')

test('week days choose date in modern Fuel instead of firing legacy Nutrition overlay',()=>{
  assert.match(fuel,/dataset:\{fuelDate:iso,today:String\(iso===today\),selected:String\(iso===selectedDate\)\}/)
  assert.match(fuel,/onclick:\(\)=>selectFuelDate\(iso\)/)
  assert.match(fuel,/root\.dataset\.selectedDate=selectedDate/)
  assert.doesNotMatch(fuel.slice(fuel.indexOf('function week()'),fuel.indexOf('function waterGoalFigure')),/tempered:open-nutrition/)
  assert.match(css,/\.fn2 \.fn2__week button\[data-selected="true"\]/)
})

test('selected date drives all Fuel operations and no date click performs a write',()=>{
  const select=fuel.slice(fuel.indexOf('async function selectFuelDate('),fuel.indexOf('function dateToolbar()',fuel.indexOf('async function selectFuelDate(')))
  assert.doesNotMatch(select,/storage\.put|daily\.(?:logAt|addNutrition|setNutritionStatus)/)
  assert.match(fuel,/daily\.forDate\(date\)/)
  assert.match(fuel,/date===selectedDate/)
  assert.match(fuel,/daily\.setNutritionStatus\(selectedDate,/)
  assert.match(fuel,/daily\.logAt\(selectedDate,'water'/)
  assert.match(fuel,/daily\.addNutrition\(selectedDate,\{\.\.\.values,portion:amount\},\{loggedAt:nutritionTimestamp\(selectedDate\)\}\)/)
  assert.match(fuel,/runtime\.dataset\.date=selectedDate/)
  assert.match(fuel,/detail:\{slot:runtime,date:selectedDate\}/)
  assert.match(fuel,/x\.date<=selectedDate&&n\(x\.bodyMetrics\?\.weight\)>0/)
  assert.match(fuel,/journalDate=selectedDate;go\('journal'\)/)
  assert.match(runtime,/historyTitle\.textContent = date === globalThis\.tempered\.clock\.today\(\)/)
  assert.match(runtime,/slot\.closest\('\.fn2'\).*data-nutrition-earlier/)
})

test('selected-date calendar browses across weeks, with explicit Today recovery',()=>{
  assert.match(fuel,/function dateToolbar\(\)/)
  assert.match(fuel,/aria-label':'Previous week'/)
  assert.match(fuel,/aria-label':'Next week'/)
  assert.match(fuel,/aria-label':'Return Fuel to today'/)
  assert.match(fuel,/type:'date',value:selectedDate,max:today/)
  assert.match(fuel,/selectedDate=date\s+journalDate=date/)
  assert.match(fuel,/const date=selectedDate\s+await load\(\)\s+if\(date===selectedDate\)render\(\)/)
  assert.match(css,/\.fn2 \.fn2__date-toolbar/)
  assert.match(read('src/version.js'),/VERSION = '[0-9]+\.[0-9]+\.[0-9]+ \([0-9]+\)'/)
})

test('no historical log is accidentally timestamped with present date',()=>{
  assert.match(fuel,/function nutritionTimestamp\(date\)/)
  assert.match(fuel,/new Date\(year,month-1,day,now\.getHours\(\),now\.getMinutes\(\)/)
  assert.match(fuel,/loggedAt:nutritionTimestamp\(selectedDate\)/)
})
