import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('intro keeps official LFMS mark and both swooping wordmark halves',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  assert.match(html,/lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(html,/lfms-launch__wordmark--less" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(html,/lfms-launch__wordmark--strong" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(css,/lfms-wordmark-enter-left 1080ms cubic-bezier\(\.17,\.91,\.29,1\) 80ms both/)
  assert.match(css,/lfms-wordmark-enter-right 1130ms cubic-bezier\(\.17,\.91,\.29,1\) 190ms both/)
  assert.match(css,/lfms-logo-settle 630ms cubic-bezier/)
  assert.doesNotMatch(html,/lfms-launch__glass-phase|lfms-launch__cracks|lfms-launch__impact-flash/)
  assert.doesNotMatch(css,/lfms-mark-smash|lfms-glass-fade|lfms-identity-thud/)
})

test('dumbbell art is local vector steel with three separate falling plates',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  assert.match(html,/class="lfms-launch__dumbbell-stage"/)
  assert.match(html,/class="lfms-launch__bar-art"/)
  assert.match(html,/id="lfms-db-shaft"/)
  assert.match(html,/id="lfms-db-grip"/)
  for(const plate of ['one','two','three']) {
    assert.match(html,new RegExp('class="lfms-launch__plate lfms-launch__plate--'+plate+'"'))
  }
  assert.equal((html.match(/class="lfms-launch__plate lfms-launch__plate--/g)||[]).length,3)
  assert.match(css,/lfms-dumbbell-drop 690ms cubic-bezier/)
  assert.match(css,/lfms-plate-drop 515ms cubic-bezier[^\n]*2110ms both/)
  assert.match(css,/lfms-plate-drop 490ms cubic-bezier[^\n]*2510ms both/)
  assert.match(css,/lfms-plate-drop 465ms cubic-bezier[^\n]*2890ms both/)
  assert.match(css,/@keyframes lfms-plate-drop[\s\S]*?translateY\(-106vh\)/)
})

test('loaded dumbbell drags a live-app zipper wipe, not a blank crossfade',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  const finish=read('src/lfms-finish.css'),js=read('src/main.js')
  assert.match(html,/class="lfms-launch__tear-edge"/)
  assert.match(css,/\.lfms-launch\[data-revealing="true"\]/)
  assert.match(css,/animation:lfms-zipper-peel 1160ms cubic-bezier/)
  assert.match(css,/animation:lfms-loaded-scrape 1160ms cubic-bezier/)
  assert.match(css,/animation:lfms-tear-follow 1160ms cubic-bezier/)
  assert.match(css,/@keyframes lfms-zipper-peel[\s\S]*?clip-path:polygon\(102%/)
  assert.match(finish,/html\[data-layout="duo"\]:has\(\.lfms-launch\[data-revealing="true"\]\) #app\.app/)
  assert.match(finish,/opacity:1;\s*visibility:visible;/)
  assert.match(js,/LFMS_PLATES_SETTLED_MS = 3700/)
  assert.match(js,/LFMS_ZIPPER_DURATION_MS = 1160/)
  assert.match(js,/launch\.dataset\.revealing = 'true'/)
  assert.match(js,/await dismissSplash\(\)/)
  assert.ok(js.indexOf('await dismissSplash()') < js.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
})

test('reduced motion keeps stationary brand/equipment and skips the wipe',()=>{
  const css=read('src/brand.css'),js=read('src/main.js')
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css,/\.lfms-launch\[data-revealing="true"\] \{animation:none;clip-path:none\}/)
  assert.match(css,/\.lfms-launch__tear-edge \{display:none\}/)
  assert.match(js,/if \(reduced\) \{[\s\S]*?launch\.dataset\.closing = 'true'/)
})
