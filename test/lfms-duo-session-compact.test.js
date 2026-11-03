import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const session=read('src/ui/screens/session.js')
const css=read('src/lfms-session-duo.css')

test('active Duo session places rest below sets instead of overlaid above them',()=>{
  assert.match(session,/const isInlineRestDock = \(\) =>/)
  assert.match(session,/inlineRestDock && rest && restBar\(\{inline:true\}\)/)
  assert.match(session,/if \(rest && !inlineRestDock\) document\.body\.append\(restBar\(\)\)/)
  assert.match(css,/\.session-r5__log>\.session-restbar\[data-inline-rest="true"\]/)
  assert.match(css,/position:relative;left:auto;right:auto;top:auto;bottom:auto;transform:none/)
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
  assert.match(read('src/version.js'),/export const VERSION = '[0-9]+\.[0-9]+\.[0-9]+ \([0-9]+\)'/)
})

test('three-dot menu dismisses on outside pointer while preserving the clicked row',()=>{
  assert.match(session,/document\.addEventListener\('pointerdown',onOutsideMenuPointer,true\)/)
  assert.match(session,/event\.target\.closest\?\.\('\.exercise-menu-wrap'\)/)
  assert.match(session,/root\.querySelectorAll\('\.exercise-menu'\)\.forEach\(node=>node\.remove\(\)\)/)
  assert.match(session,/if\(dismissExerciseMenu\(\)\)event\.preventDefault\(\)/)
})
test('exercise artwork opens full-screen viewer from both reference surfaces',()=>{
  assert.match(session,/onclick:\(\)=>openExerciseArt\(entry\)/)
  assert.match(session,/onclick: \(\) => openExerciseArt\(entry\)/)
  assert.match(session,/role:'dialog','aria-modal':'true'/)
  assert.match(session,/sessionArtOverlay:'true'/)
  assert.match(css,/\.session-art-viewer\s*\{/)
  assert.match(css,/touch-action:pinch-zoom/)
})
