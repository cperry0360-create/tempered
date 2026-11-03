import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const session=read('src/ui/screens/session.js')
const css=read('src/lfms-session-duo.css')

test('active Duo session keeps one focused exercise with an anchored rest dock',()=>{
  assert.match(session,/function positionRestDock\(\)/)
  assert.match(session,/getBoundingClientRect\(\)/)
  assert.match(session,/--session-rest-left/)
  assert.match(session,/--session-rest-width/)
  assert.match(session,/document\.body\.append\(restBar\(\)\)\s*positionRestDock\(\)/)
  assert.match(css,/var\(--session-rest-left/)
  assert.match(css,/var\(--session-rest-width/)
  assert.match(css,/grid-template-columns:minmax\(0,\.75fr\) minmax\(0,1\.25fr\)/)
  assert.match(css,/height:100dvh/)
})

test('active session no longer displays optional cardio finisher under sets',()=>{
  const halfFold=session.slice(session.indexOf('  function halfFoldControls('),session.indexOf('  function movementPicker()'))
  const normal=session.slice(session.indexOf('  function render()'),session.indexOf('  function finishSheet()'))
  assert.doesNotMatch(halfFold,/cardioFinisherCard\(\)/)
  assert.doesNotMatch(normal,/cardioFinisherCard\(\)/)
  assert.match(normal,/session-r5__add-movement/)
  assert.match(normal,/halfFoldToggle\(\)/)
  assert.match(normal,/addingMovement\) && movementPicker\(\)/)
  assert.match(session,/onStartCardio/)
})

test('old charcoal-orange workout timer is styled with LFMS blue',()=>{
  assert.match(css,/\.sessionbar--r3 \.sessionbar__elapsed-value/)
  assert.match(css,/color:var\(--session-blue\)/)
  assert.match(css,/\.session-restbar__progress i \{background:var\(--lfms-sub-blue\)/)
  assert.match(css,/\.session-restbar__actions button/)
  assert.match(read('index.html'),/src\/lfms-session-duo\.css/)
  assert.match(read('sw.js'),/\.\/src\/lfms-session-duo\.css/)
  assert.match(read('src/version.js'),/0\.66\.36 \(142\)/)
})
