import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source=read('src/ui/screens/fuel-next.js')
const css=read('src/food-next.css')

test('Water card shares the exact LFMS lifting icon, not a second hand-drawn figure',()=>{
  assert.match(source,/function waterGoalFigure\(amount, goal\)/)
  const figure=source.slice(source.indexOf('  function waterGoalFigure('),source.indexOf('  function dashboard()'))
  assert.equal((figure.match(/icon\('nav-train'\)/g)||[]).length,2)
  assert.match(figure,/data-set|waterGoalFigure:'true'/)
  assert.match(source,/waterGoalFigure\(n\(day\.waterOz\),target\('water',120\)\)/)
})

test('Animated fill uses actual water progress, clamps at goal and respects motion preferences',()=>{
  assert.match(source,/const progress=pct\(amount,goal\)/)
  assert.match(source,/let paintedWaterPercent=0/)
  assert.match(source,/paintedWaterPercent=percent/)
  assert.match(source,/wave\.setAttribute\('d',waterWavePath\(paintedWaterPercent/)
  assert.match(css,/\.fn2__water-figure-fill\s*\{/)
  assert.match(source,/const duration=2000/)
  assert.match(source,/clip\.setAttribute\('clipPathUnits','userSpaceOnUse'\)/)
  assert.match(source,/glyph\.setAttribute\('clip-path','url\(#'\+clipId\+'\)'\)/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css,/\.fn2__water-figure-fill\s*\{[^}]*filter:none/s)
  assert.match(css,/\.fn2__water-figure-empty \{color:var\(--food-v2-text\);opacity:1\}/)
  assert.match(css,/width:clamp\(106px,34%,170px\)/)
  assert.match(css,/margin-inline-end:clamp\(12px,2vw,26px\)/)
})

test('Visual water meter has percent and accessibility without changing logging storage',()=>{
  assert.match(source,/role:'meter'/)
  assert.match(source,/'aria-valuemax':'100'/)
  assert.match(source,/'aria-valuenow':String\(percent\)/)
  assert.match(source,/fn2__water-figure-percent/)
  assert.match(source,/daily\.logAt\(selectedDate,'water',amount\)/)
  assert.match(source,/daily\.logAt\(selectedDate,'water',Math\.round\(amount\*10\)\/10\)/)
  assert.match(css,/var\(--food-v2-blue-light\)/)
  assert.match(css,/@container water-card \(max-width:300px\)/)
  assert.match(read('src/version.js'),/export const VERSION = '[0-9]+\.[0-9]+\.[0-9]+ \([0-9]+\)'/)
})
