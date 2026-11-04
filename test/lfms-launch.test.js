import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('splash keeps the supplied transparent LFMS logo and split title',()=>{
  const h=read('index.html'),c=read('src/brand.css')
  assert.match(h,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--less"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--strong"/)
  assert.match(h,/class="lfms-launch__tagline">TRAIN · FUEL · RECOVER/)
  assert.match(read('branding/lfms/logo-wordmark.svg'),/viewBox="205 547 1125 235"/)
  assert.match(read('branding/lfms/logo-mark.svg'),/viewBox="435 167 675 387"/)
  assert.ok(h.indexOf('<!-- /lfms-launch__skin -->')<h.indexOf('class="lfms-launch__barbell-stage"'))
  assert.match(c,/lfms-brand-clear-side 520ms/)
  assert.doesNotMatch(h,/lfms-launch__glass-phase|lfms-launch__shockwave|lfms-launch__cracks/)
})

test('rigid weight lands before connected 1.01-second reveal and the weekly recap',()=>{
  const c=read('src/brand.css'),js=read('src/main.js'),runtime=read('src/ui/lfms-cinematic-splash.js')
  assert.match(c,/lfms-v8-loaded-fall 700ms linear 1060ms both/)
  assert.match(c,/lfms-tagline-enter 440ms ease-out 950ms both/)
  assert.match(js,/LFMS_REVEAL_START_MS - \(performance\.now\(\) - splashStarted\)/)
  assert.match(runtime,/LFMS_REVEAL_START_MS = 2050/)
  assert.match(runtime,/LFMS_REVEAL_DURATION_MS = 1010/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.match(js,/launch\.remove\(\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(c,/clip-path:inset\(0 0 43% 0\)/)
  assert.match(c,/clip-path:inset\(57% 0 0 0\)/)
})

test('V8 runtime and launch assets ship with offline PWA',()=>{
  const sw=read('sw.js'),finish=read('src/lfms-finish.css')
  for(const asset of ['src/ui/lfms-cinematic-splash.js','src/lfms-finish.css','branding/lfms/logo-wordmark.svg'])
    assert.ok(sw.includes("'./"+asset+"'"),asset)
  for(const cls of ['today2__pills','train2__pills','fn2__pills','progress-views'])
    assert.ok(finish.includes(cls),cls)
})
