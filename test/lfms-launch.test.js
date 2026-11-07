import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('launch uses official brand artwork without characters or impact geometry',()=>{
 const h=read('index.html'),c=read('src/brand.css'),js=read('src/main.js')
 for(const asset of ['logo-mark.svg','logo-wordmark.svg']) assert.ok(h.includes('./branding/lfms/'+asset))
 for(const source of [h,c,js]) assert.doesNotMatch(source,/emoji-sweep|startEmojiSweep|lfms-launch__glass|lfms-launch__cracks|lfms-launch__sweeper|lfms-glass-mark-slam|runBrandHandoff/)
 assert.match(c,/@keyframes lfms-logo-in \{from \{opacity:0\} to \{opacity:1\}\}/)
})
test('short launch preserves post-splash recap and the boot failsafe',()=>{
 const js=read('src/main.js')
 assert.match(js,/LFMS_LAUNCH_MIN_MS = 900/)
 assert.match(js,/LFMS_LAUNCH_EXIT_MS = 240/)
 assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
 assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
})
test('offline shell retains official logos and drops the retired animation',()=>{
 const sw=read('sw.js')
 for(const asset of ['branding/lfms/logo-wordmark.svg','branding/lfms/logo-mark.svg']) assert.ok(sw.includes("'./"+asset+"'"))
 assert.doesNotMatch(sw,/emoji-sweep/)
})
