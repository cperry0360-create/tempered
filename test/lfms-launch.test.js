import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('launch uses separated transparent approved LFMS symbol and lettering',()=>{
  const html=read('index.html'),word=read('branding/lfms/logo-wordmark.svg'),mark=read('branding/lfms/logo-mark.svg')
  assert.match(html,/class="lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(html,/class="lfms-launch__wordmark" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(html,/class="lfms-launch__tagline">TRAIN · FUEL · RECOVER/)
  assert.doesNotMatch(html,/lfms-launch__caption/)
  assert.match(word,/viewBox="205 547 1125 235"/)
  assert.doesNotMatch(word,/<rect\b/)
  assert.match(mark,/viewBox="435 167 675 387"/)
})
test('splash has staggered entrances, no overlapping negative margins, and a readable hold',()=>{
  const css=read('src/brand.css'),js=read('src/main.js')
  for(const name of ['mark','rule','wordmark','tagline']) assert.match(css,new RegExp('lfms-'+name+'-enter'))
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.doesNotMatch(css,/margin-top:-/)
  assert.match(js,/2600 - \(performance\.now\(\) - splashStarted\)/)
  assert.match(js,/dismissSplash, 8000/)
  assert.match(js,/launch\.remove\(\), 520/)
})
test('new launch assets and four-tab finishing styles survive offline deployment',()=>{
  const html=read('index.html'),sw=read('sw.js'),finish=read('src/lfms-finish.css')
  assert.match(html,/src\/lfms-finish\.css/)
  assert.match(sw,/\.\/branding\/lfms\/logo-wordmark\.svg/)
  assert.match(sw,/\.\/src\/lfms-finish\.css/)
  for(const cls of ['today2__pills','train2__pills','fn2__pills','progress-views']) assert.ok(finish.includes(cls),cls)
  assert.match(finish,/min-height:44px/)
})
