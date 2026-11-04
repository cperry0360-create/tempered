import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('fallback uses the real LFMS brand assets and hides all weight effects',()=>{
  const h=read('index.html'), c=read('src/brand.css')
  for(const asset of ['logo-mark.svg','logo-wordmark.svg']) assert.ok(h.includes(asset))
  assert.match(c,/\.lfms-launch__barbell-stage,\.lfms-launch__peel-strip,\.lfms-launch__lift-tab \{display:none\}/)
  assert.match(c,/\.lfms-launch__glow \{display:none\}/)
  assert.match(c,/\.lfms-launch__identity \{[\s\S]*?animation:lfms-clean-brand-enter 560ms/)
  assert.match(c,/\.lfms-launch__wordmark--less,\.lfms-launch__wordmark--strong \{[\s\S]*?animation:none/)
  assert.match(c,/\.lfms-launch__skin \{animation:none;clip-path:inset\(0\)\}/)
})

test('no barbell or torn-page runtime is triggered on startup',()=>{
  const js=read('src/main.js')
  assert.doesNotMatch(js,/runCinematicReveal\(launch\)|LFMS_REVEAL_START_MS/)
  assert.match(js,/LFMS_SIMPLE_SPLASH_MIN_MS = 1600/)
  assert.match(js,/LFMS_SIMPLE_SPLASH_EXIT_MS = 260/)
  assert.match(js,/launch\.dataset\.closing = 'true'/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
})

test('sleeping figure is vivid solid Food-button red without glow',()=>{
  const c=read('src/today-next.css'),fuel=read('src/food-neon.css')
  assert.match(fuel,/--neo-red:rgb\(255,57,78\)/)
  assert.match(c,/today-week__day\[data-icon='rest'\] \.today-week__workout-icon \.icon \{[\s\S]*?color:rgb\(255,57,78\);stroke:none;filter:none;/)
  assert.match(c,/today-week__workout-icon::before \{[\s\S]*?content:none;display:none;box-shadow:none;background:none;/)
  assert.match(read('src/version.js'),/0\.66\.61 \(167\)/)
})

test('no motion is required and PWA still precaches real branding',()=>{
  const c=read('src/brand.css'),sw=read('sw.js')
  assert.match(c,/@media\(prefers-reduced-motion:reduce\) \{[\s\S]*?\.lfms-launch__identity \{animation:none;opacity:1/)
  assert.match(sw,/\.\/branding\/lfms\/logo-mark\.svg/)
  assert.match(sw,/\.\/branding\/lfms\/logo-wordmark\.svg/)
})
