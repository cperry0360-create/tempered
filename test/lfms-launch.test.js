import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('Kinetic LFMS preserves supplied mountain/wordmark; no invented type or plate art',()=>{
  const h=read('index.html')
  assert.match(h,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--less"/)
  assert.match(h,/class="lfms-launch__wordmark lfms-launch__wordmark--strong"/)
  assert.match(h,/class="lfms-launch__tagline">TRAIN · FUEL · RECOVER/)
  assert.match(read('branding/lfms/logo-wordmark.svg'),/viewBox="205 547 1125 235"/)
  assert.match(read('branding/lfms/logo-mark.svg'),/viewBox="435 167 675 387"/)
  assert.doesNotMatch(h,/lfms-launch__barbell|lfms-launch__plate|lfms-launch__lift-tab/)
})

test('logo and staggered words resolve before clean real-dashboard fade',()=>{
  const c=read('src/brand.css'),js=read('src/main.js')
  for(const name of ['mark','less','strong','rule','tagline','sweep']) assert.match(c,new RegExp('@keyframes lfms-kinetic-'+name))
  assert.match(c,/lfms-kinetic-mark 580ms cubic-bezier\(\.16,1,\.28,1\) 150ms both/)
  assert.match(c,/lfms-kinetic-less 550ms cubic-bezier\(\.17,\.88,\.26,1\) 430ms both/)
  assert.match(c,/lfms-kinetic-strong 570ms cubic-bezier\(\.17,\.88,\.26,1\) 530ms both/)
  assert.match(js,/LFMS_KINETIC_SPLASH_MIN_MS - \(performance\.now\(\) - splashStarted\)/)
  assert.match(js,/setTimeout\(finish, LFMS_KINETIC_SPLASH_EXIT_MS\)/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
})

test('offline PWA includes source brand assets and remains one app',()=>{
  const sw=read('sw.js'),f=read('src/lfms-finish.css')
  for(const asset of ['branding/lfms/logo-wordmark.svg','branding/lfms/logo-mark.svg','src/brand.css','src/lfms-finish.css'])
    assert.ok(sw.includes("'./"+asset+"'"))
  for(const cls of ['today2__pills','train2__pills','fn2__pills','progress-views']) assert.ok(f.includes(cls))
})
