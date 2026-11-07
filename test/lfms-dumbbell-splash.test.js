import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('real LFMS SVGs remain single-source for the glass-impact mark and wordmark',()=>{
  const h=read('index.html'),c=read('src/brand.css')
  assert.match(h,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(h,/class="lfms-launch__wordmark" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(c,/animation:lfms-glass-mark-slam 650ms/)
  assert.match(c,/animation:lfms-glass-wordmark 420ms/)
})

test('all old screen-tear, weights and plate geometry are out of the app and styles',()=>{
  const h=read('index.html'),c=read('src/brand.css'),js=read('src/main.js')
  for(const pattern of [/lfms-launch__barbell-stage/,/lfms-launch__plate/,/lfms-launch__peel-strip/,/lfms-launch__lift-tab/,/lfms-launch__tear-edge/]){
    assert.doesNotMatch(h,pattern)
    assert.doesNotMatch(c,pattern)
  }
  assert.doesNotMatch(js,/runCinematicReveal|LFMS_REVEAL_START_MS/)
  assert.match(h,/lfms-launch__sweeper/)
  assert.doesNotMatch(h,/lfms-launch__cinema--top|lfms-launch__cinema--bottom|lfms-launch__flash/)
  assert.doesNotMatch(c,/@keyframes lfms-ignition-cut|@keyframes lfms-ignition-curtain/)
})

test('the cinematic gradient belongs to the splash, not the root or Duo rail',()=>{
  const c=read('src/brand.css'),f=read('src/lfms-finish.css'),tokens=read('src/tokens.css')
  assert.match(c,/\.lfms-launch__skin \{[\s\S]*?radial-gradient\([\s\S]*?linear-gradient\(/)
  assert.match(c,/html\[data-layout="duo"\] \.lfms-launch__skin \{[\s\S]*?radial-gradient\(/)
  assert.match(c,/var\(--lfms-duo-canvas\)/)
  assert.match(c,/width:100vw;height:100dvh;box-sizing:border-box/)
  assert.match(f,/html\[data-layout="duo"\] body\s*\{[^}]*background:var\(--lfms-duo-canvas\);[^}]*background-image:none;/)
  assert.match(tokens,/--lfms-duo-canvas:\s*#101820/)
})

test('approved glass hold, clean exit, reduced-motion and offline cache version',()=>{
  const c=read('src/brand.css'),main=read('src/main.js'),sw=read('sw.js')
  assert.match(main,/LFMS_GLASS_SWEEP_MIN_MS = 7100/)
  assert.match(main,/LFMS_GLASS_SWEEP_EXIT_MS = 340/)
  assert.match(main,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(main.indexOf('await dismissSplash()')<main.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(c,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(c,/\.lfms-launch__glass,\.lfms-launch__sweeper-stage \{display:none\}/)
  assert.match(c,/\.lfms-launch__mark,\.lfms-launch__wordmark \{animation:none;opacity:1;transform:none\}/)
  for(const asset of ['./branding/lfms/logo-mark.svg','./branding/lfms/logo-wordmark.svg']) assert.ok(sw.includes("'"+asset+"'"))
  assert.match(read('src/version.js'),/export const VERSION = '[0-9]+\.[0-9]+\.[0-9]+ \([0-9]+\)'/)
})
