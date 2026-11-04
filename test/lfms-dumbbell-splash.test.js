import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('real LFMS SVGs remain single-source for the kinetic mark and split wordmark',()=>{
  const h=read('index.html'),c=read('src/brand.css')
  assert.match(h,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  for(const side of ['less','strong']) assert.match(h,new RegExp('lfms-launch__wordmark--'+side+'" src="\\./branding/lfms/logo-wordmark.svg"'))
  assert.match(c,/clip-path:inset\(0 0 43% 0\)/)
  assert.match(c,/clip-path:inset\(57% 0 0 0\)/)
  assert.match(c,/animation:lfms-kinetic-mark 580ms/)
  assert.match(c,/animation:lfms-kinetic-less 550ms/)
  assert.match(c,/animation:lfms-kinetic-strong 570ms/)
  assert.match(c,/animation:lfms-kinetic-sweep 690ms/)
})

test('all old screen-tear, weights and plate geometry are out of the app and styles',()=>{
  const h=read('index.html'),c=read('src/brand.css'),js=read('src/main.js')
  for(const pattern of [/lfms-launch__barbell-stage/,/lfms-launch__plate/,/lfms-launch__peel-strip/,/lfms-launch__lift-tab/,/lfms-launch__tear-edge/]){
    assert.doesNotMatch(h,pattern)
    assert.doesNotMatch(c,pattern)
  }
  assert.doesNotMatch(js,/runCinematicReveal|LFMS_REVEAL_START_MS/)
  assert.match(h,/class="lfms-launch__sweep"/)
  assert.match(c,/@keyframes lfms-kinetic-sweep/)
})

test('the cinematic gradient belongs to the splash, not the root or Duo rail',()=>{
  const c=read('src/brand.css'),f=read('src/lfms-finish.css'),tokens=read('src/tokens.css')
  assert.match(c,/\.lfms-launch__skin \{[\s\S]*?radial-gradient\([\s\S]*?linear-gradient\(/)
  assert.match(c,/html\[data-layout="duo"\] \.lfms-launch__skin \{[\s\S]*?radial-gradient\(/)
  assert.match(c,/var\(--lfms-duo-canvas\)/)
  assert.match(f,/html\[data-layout="duo"\] body\s*\{[^}]*background:var\(--lfms-duo-canvas\);[^}]*background-image:none;/)
  assert.match(tokens,/--lfms-duo-canvas:\s*#101820/)
})

test('brief kinetic hold, clean exit, reduced-motion and offline cache version',()=>{
  const c=read('src/brand.css'),main=read('src/main.js'),sw=read('sw.js')
  assert.match(main,/LFMS_KINETIC_SPLASH_MIN_MS = 1820/)
  assert.match(main,/LFMS_KINETIC_SPLASH_EXIT_MS = 240/)
  assert.match(main,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(main.indexOf('await dismissSplash()')<main.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(c,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(c,/\.lfms-launch__sweep \{display:none\}/)
  for(const asset of ['./branding/lfms/logo-mark.svg','./branding/lfms/logo-wordmark.svg']) assert.ok(sw.includes("'"+asset+"'"))
  assert.match(read('src/version.js'),/0\.66\.62 \(168\)/)
})
