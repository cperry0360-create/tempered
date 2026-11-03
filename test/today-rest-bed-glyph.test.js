import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { workoutDayGlyph } from '../src/ui/screens/today.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('rest icon shows for past and present days without completed workouts',()=>{
  assert.equal(workoutDayGlyph('2026-11-02','2026-11-05',false),'rest-bed')
  assert.equal(workoutDayGlyph('2026-11-05','2026-11-05',false),'rest-bed')
})

test('muscle icon requires a finished workout session; future days are neutral',()=>{
  assert.equal(workoutDayGlyph('2026-11-03','2026-11-05',true),'nav-train')
  assert.equal(workoutDayGlyph('2026-11-05','2026-11-05',true),'nav-train')
  assert.equal(workoutDayGlyph('2026-11-06','2026-11-05',false),null)
  assert.equal(workoutDayGlyph('2026-11-06','2026-11-05',true),null)
})

test('Today uses actual session finish timestamps rather than partial set totals',()=>{
  const today=read('src/ui/screens/today.js')
  assert.match(today,/storage\.getAll\('sessions'\)/)
  assert.match(today,/session\.endedAt && typeof session\.date === 'string'/)
  assert.match(today,/completedWorkoutDates\.has\(item\.date\)/)
  assert.match(today,/glyph \? \[icon\(glyph\)\] : \[\]/)
  assert.match(today,/icon: glyph === 'nav-train' \? 'workout' : glyph === 'rest-bed' \? 'rest' : 'upcoming'/)
})

test('bed is a single-color vector and retains readable all-white rendering',()=>{
  const glyphs=read('src/ui/icons.js')
  const css=read('src/today-next.css')
  assert.match(glyphs,/'rest-bed': \[\['silhouette',/)
  assert.match(css,/data-icon='rest'/)
  assert.match(css,/color:var\(--food-v2-text\);filter:none;stroke:none/)
  assert.match(read('src/version.js'),/export const VERSION = '\d+\.\d+\.\d+ \(\d+\)'/)
})
