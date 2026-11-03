import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('splash centers three separate hairline glass crack passes on the fixed mark site', () => {
  const html = read('index.html')
  assert.match(html, /class="lfms-launch__mark-stage"/)
  assert.match(html, /class="lfms-launch__cracks" viewBox="0 0 600 460"/)
  for (const phase of ['first','second','third']) {
    assert.match(html, new RegExp('class="lfms-launch__glass-phase lfms-launch__glass-phase--' + phase + '"'))
  }
  assert.ok(html.indexOf('lfms-launch__mark-stage') < html.indexOf('lfms-launch__cracks'))
  assert.ok(html.indexOf('lfms-launch__mark"') < html.indexOf('lfms-launch__cracks'))
  assert.doesNotMatch(html, /class="lfms-launch__shockwave"/)
  assert.doesNotMatch(html, /class="lfms-launch__crack-glint"/)
  assert.match(html, /stroke="currentColor"/)
})

test('vertical emblem has three compressive contacts aligned with the three neutral fractures', () => {
  const css = read('src/brand.css')
  assert.match(css, /animation:lfms-mark-smash 1690ms linear 710ms both/)
  const beats = css.slice(css.indexOf('@keyframes lfms-mark-smash'),css.indexOf('@keyframes lfms-glass-contact'))
  for(const beat of ['39%', '61.5%', '84%']) assert.ok(beats.includes(beat),beat)
  assert.ok(beats.includes('translateY(-250px)'))
  assert.ok(beats.includes('translateY(-78px)'))
  assert.ok(beats.includes('translateY(-30px)'))
  assert.ok(beats.includes('scaleY(.76)'))
  assert.ok(beats.includes('scaleY(.86)'))
  assert.ok(beats.includes('scaleY(.92)'))
  assert.match(css, /lfms-glass-fade 2270ms ease-out 1369ms both/)
  assert.match(css, /lfms-glass-fade 1875ms ease-out 1749ms both/)
  assert.match(css, /lfms-glass-fade 1480ms ease-out 2130ms both/)
  assert.match(css, /animation:lfms-glass-fracture/)
  assert.match(css, /color:rgba\(238,244,249,\.98\)/)
  assert.match(css, /width:min\(660px,112vw\)/)
  assert.match(css, /stroke-width:2\.3/)
  assert.match(css, /animation:lfms-identity-thud 2720ms linear both/)
  assert.match(css, /53\.4% \{transform:translateY\(calc\(-1vh \+ 10px\)\)/)
  assert.match(css, /67% \{opacity:\.88\}/)
  const glass = css.slice(css.indexOf('.lfms-launch__impact-flash'), css.indexOf('.lfms-launch[data-closing="true"]'))
  assert.doesNotMatch(glass, /lfms-launch-red/)
  assert.doesNotMatch(glass, /rgba\(240,55,37/)
})

test('wordmark entrance, tagline and reduced-motion treatment are preserved', () => {
  const css = read('src/brand.css')
  assert.match(css, /lfms-wordmark-enter-left 1080ms cubic-bezier\(\.17,\.91,\.29,1\) 80ms both/)
  assert.match(css, /lfms-wordmark-enter-right 1130ms cubic-bezier\(\.17,\.91,\.29,1\) 190ms both/)
  assert.match(css, /lfms-tagline-enter 650ms ease-out 2360ms both/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css, /\.lfms-launch__impact-flash,\.lfms-launch__cracks \{\s*display:none;animation:none;/)
  assert.doesNotMatch(css, /@keyframes lfms-impact-shake/)
})
