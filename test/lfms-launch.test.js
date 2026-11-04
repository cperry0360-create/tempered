import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('fallback uses LFMS mountain, split wordmark and TRAIN FUEL RECOVER tagline',()=>{
  const h=read('index.html')
  assert.match(h,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--less"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--strong"/)
  assert.match(h,/class="lfms-launch__tagline">TRAIN · FUEL · RECOVER/)
  assert.match(read('branding/lfms/logo-wordmark.svg'),/viewBox="205 547 1125 235"/)
  assert.match(read('branding/lfms/logo-mark.svg'),/viewBox="435 167 675 387"/)
})

test('stable logo intro replaces V8 mechanical reveal in the main boot sequence',()=>{
  const c=read('src/brand.css'),js=read('src/main.js')
  assert.match(c,/@keyframes lfms-clean-brand-enter/)
  assert.match(c,/\.lfms-launch__barbell-stage,\.lfms-launch__peel-strip,\.lfms-launch__lift-tab \{display:none\}/)
  assert.match(c,/\.lfms-launch__wordmark--less,\.lfms-launch__wordmark--strong \{[\s\S]*?animation:none;/)
  assert.match(js,/LFMS_SIMPLE_SPLASH_MIN_MS - \(performance\.now\(\) - splashStarted\)/)
  assert.match(js,/setTimeout\(finish, LFMS_SIMPLE_SPLASH_EXIT_MS\)/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
})

test('standalone iOS app can update the fallback offline',()=>{
  const sw=read('sw.js'),finish=read('src/lfms-finish.css')
  for(const path of ['src/brand.css','src/lfms-finish.css','branding/lfms/logo-wordmark.svg'])
    assert.ok(sw.includes("'./"+path+"'"),path)
  for(const cls of ['today2__pills','train2__pills','fn2__pills','progress-views'])
    assert.ok(finish.includes(cls))
})
