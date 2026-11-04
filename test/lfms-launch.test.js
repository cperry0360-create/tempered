import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('launch uses separated transparent approved LFMS symbol and lettering',()=>{
  const html=read('index.html'),word=read('branding/lfms/logo-wordmark.svg'),mark=read('branding/lfms/logo-mark.svg')
  assert.match(html,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(html,/class="lfms-launch__wordmark lfms-launch__wordmark--less" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(html,/class="lfms-launch__tagline">TRAIN · FUEL · RECOVER/)
  assert.doesNotMatch(html,/lfms-launch__caption/)
  assert.match(word,/viewBox="205 547 1125 235"/)
  assert.doesNotMatch(word,/<rect\b/)
  assert.match(mark,/viewBox="435 167 675 387"/)
  assert.match(html,/class="lfms-launch__wordmark lfms-launch__wordmark--strong" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(html,/class="lfms-launch__mark-stage"/)
  assert.match(html,/class="lfms-launch__skin"/)
  assert.match(html,/class="lfms-launch__peel-flap"/)
  assert.match(html,/class="lfms-launch__barbell-stage"/)
  assert.match(html,/class="lfms-launch__bar-art"/)
  for(const side of ['bottom','top']) {
    for(const color of ['red','white','blue']) {
      assert.match(html,new RegExp('lfms-launch__plate--'+side+'-'+color))
    }
  }
  assert.match(html,/class="lfms-launch__lift-tab"/)
  assert.doesNotMatch(html,/lfms-launch__tear-edge|lfms-launch__peel-flap/)
  assert.doesNotMatch(html,/lfms-launch__cracks|lfms-launch__impact-flash|lfms-launch__shockwave/)
})
test('splash has staggered entrances, no overlapping negative margins, and a readable hold',()=>{
  const css=read('src/brand.css'),js=read('src/main.js')
  for(const name of ['rule','wordmark','tagline']) assert.match(css,new RegExp('lfms-'+name+'-enter'))
  assert.match(css,/lfms-logo-settle/)
  assert.match(css,/prefers-reduced-motion:reduce/)
  for(const name of ['wordmark-enter-left','wordmark-enter-right','barbell-drop','bumper-stack','corner-peel','loaded-scrape','curl-release'])
    assert.match(css,new RegExp('lfms-'+name))
  assert.doesNotMatch(css,/lfms-mark-smash|lfms-glass-fracture|lfms-shockwave/)
  assert.match(css,/clip-path:inset\(0 0 43% 0\)/)
  assert.match(css,/clip-path:inset\(57% 0 0 0\)/)

  assert.doesNotMatch(css,/margin-top:-/)
  assert.match(js,/LFMS_PLATES_SETTLED_MS = 3990/)
  assert.match(js,/LFMS_PEEL_DURATION_MS = 1020/)
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
  assert.match(js,/launch\.dataset\.revealing = 'true'/)
  assert.match(js,/setTimeout\(finish, 90\)/)
  assert.match(js,/launch\.remove\(\)/)
  assert.match(js,/await dismissSplash\(\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'),
    'recap must initialize after launch animation removes the splash')
})
test('new launch assets and four-tab finishing styles survive offline deployment',()=>{
  const html=read('index.html'),sw=read('sw.js'),finish=read('src/lfms-finish.css')
  assert.match(html,/src\/lfms-finish\.css/)
  assert.match(sw,/\.\/branding\/lfms\/logo-wordmark\.svg/)
  assert.match(sw,/\.\/src\/lfms-finish\.css/)
  for(const cls of ['today2__pills','train2__pills','fn2__pills','progress-views']) assert.ok(finish.includes(cls),cls)
  assert.match(finish,/min-height:44px/)
})
