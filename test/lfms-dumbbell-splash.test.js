import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('approved LFMS mark and lettering swoops survive the cinematic change', () => {
  const h=read('index.html'),c=read('src/brand.css')
  for(const name of ['logo-mark.svg','logo-wordmark.svg']) assert.ok(h.includes(name),name)
  assert.match(c,/lfms-wordmark-enter-left 1080ms/)
  assert.match(c,/lfms-wordmark-enter-right 1130ms/)
  assert.match(c,/lfms-logo-settle 630ms/)
  assert.doesNotMatch(h,/lfms-launch__cracks|lfms-launch__impact-flash|lfms-launch__tear-edge|lfms-launch__peel-flap/)
})

test('bar is a long center-knurled Olympic shaft with six rigid bumper plates', () => {
  const h=read('index.html'),c=read('src/brand.css')
  for(const side of ['bottom','top']) for(const color of ['red','white','blue'])
    assert.ok(h.includes('lfms-launch__plate--'+side+'-'+color),side+color)
  assert.equal((h.match(/class="lfms-launch__plate lfms-launch__plate--/g)||[]).length,6)
  assert.match(h,/viewBox="0 0 160 700"/)
  assert.match(h,/rect x="69" y="269" width="22" height="162"/)
  assert.match(c,/\.lfms-launch__bar-art,\.lfms-launch__plate \{animation:none;opacity:1;transform:none\}/)
  assert.match(c,/animation:lfms-v8-loaded-fall 700ms linear 1060ms both/)
  assert.doesNotMatch(read('src/main.js'),/LFMS_PLATES_SETTLED_MS/)
})

test('bar and folded skin move from one V8 reveal progress', () => {
  const js=read('src/ui/lfms-cinematic-splash.js'),main=read('src/main.js'),css=read('src/brand.css')
  assert.match(js,/export const LFMS_REVEAL_START_MS = 2050/)
  assert.match(js,/export const LFMS_REVEAL_DURATION_MS = 1010/)
  assert.match(js,/const cut = skinAndFold\(p, width, height\)/)
  assert.match(js,/skin\.style\.clipPath = cut\.skin/)
  assert.match(js,/fold\.style\.clipPath = cut\.fold/)
  assert.match(js,/bar\.style\.transform =/)
  assert.match(css,/\.lfms-launch__peel-strip/)
  assert.match(css,/\.lfms-launch__lift-tab \{display:none\}/)
  assert.match(main,/runCinematicReveal\(launch\)/)
  assert.ok(main.indexOf('await dismissSplash()')<main.indexOf('await installWeeklyRecapRuntime(context)'))
})

test('calendar sleeping person glows Fuel-close red without touching history', () => {
  const c=read('src/today-next.css'),fuel=read('src/food-neon.css')
  assert.match(fuel,/\.fn2__neo-close \{/)
  assert.match(c,/today-week__day\[data-icon='rest'\] \.today-week__workout-icon \.icon/)
  assert.match(c,/color:rgb\(255,74,94\)/)
  assert.match(c,/drop-shadow\(0 0 8px rgba\(255,45,71,\.78\)\)/)
})

test('reduced motion and offline handoff still work', () => {
  const c=read('src/brand.css'),js=read('src/main.js'),sw=read('sw.js')
  assert.match(c,/\.lfms-launch__peel-strip \{display:none\}/)
  assert.match(js,/if \(reduced\) \{[\s\S]*?launch\.dataset\.closing = 'true'/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.match(sw,/\.\/src\/ui\/lfms-cinematic-splash\.js/)
  assert.match(read('src/version.js'),/0\.66\.59 \(165\)/)
})
