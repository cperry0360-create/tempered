import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('launch keeps official brand artwork and uses the reviewed rendered emoji asset',()=>{
  const h=read('index.html'),c=read('src/brand.css')
  for(const asset of ['logo-mark.svg','logo-wordmark.svg']) assert.ok(h.includes('./branding/lfms/'+asset))
  assert.match(h,/data-lfms-emoji-sweep/)
  assert.match(h,/class="lfms-launch__cracks"/)
  assert.doesNotMatch(h,/lfms-launch__sweeper-body|lfms-launch__sweeper-arm|lfms-launch__shards/)
  assert.match(c,/width:min\(92vw,72dvh\)/)
  assert.match(c,/aspect-ratio:16\/9/)
  const asset=readFileSync(new URL('../branding/lfms/emoji-sweep.webp',import.meta.url))
  assert.equal(asset.toString('ascii',0,4),'RIFF')
  assert.equal(asset.toString('ascii',8,12),'WEBP')
  assert.ok(asset.includes(Buffer.from('ANIM')),'the shipped file is animated')
})

test('emoji playback fits before the genuine Today handoff and recap',()=>{
  const js=read('src/main.js'),c=read('src/brand.css')
  assert.match(js,/LFMS_GLASS_SWEEP_MIN_MS = 7100/)
  assert.match(js,/startEmojiSweep\(launch\)/)
  assert.match(js,/emojiSweep.then\(cleanup => cleanup\(\)\)/)
  assert.match(js,/runBrandHandoff\(launch, \{ duration: LFMS_HANDOFF_MS \}\)/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(c,/animation:lfms-glass-mark-slam 650ms/)
  assert.match(c,/animation:lfms-glass-crack 980ms/)
})

test('offline shell contains both the rendered asset and its player',()=>{
  const sw=read('sw.js')
  for(const asset of ['branding/lfms/emoji-sweep.webp','src/ui/lfms-emoji-sweep.js','branding/lfms/logo-wordmark.svg','branding/lfms/logo-mark.svg']) assert.ok(sw.includes("'./"+asset+"'"))
})
