import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Duo startup never paints an old charcoal native strip',()=>{
  const html=read('index.html')
  const normal=JSON.parse(read('manifest.webmanifest'))
  const duo=JSON.parse(read('manifest-duo.webmanifest'))
  assert.match(html,/<meta name="theme-color" content="#061424"/)
  for(const manifest of [normal,duo]){
    assert.equal(manifest.theme_color,'#061424')
    assert.equal(manifest.background_color,'#061424')
  }
  assert.match(read('src/tokens.css'),/--food-v2-deep:\s*#061424/)
})

test('Duo paints the approved Today gradient once, independently of navigation and splash',()=>{
  const css=read('src/lfms-finish.css')
  assert.match(css,/html\[data-layout="duo"\] body::before\s*\{/)
  assert.match(css,/position:fixed/)
  assert.match(css,/radial-gradient\(ellipse 78% 46% at 40% 0%/)
  assert.match(css,/linear-gradient\(155deg,var\(--lfms-today-canvas-start\)/)
  assert.match(css,/transform:none/)
  assert.match(css,/html\[data-layout="duo"\]:has\(\.lfms-launch:not\(\[data-closing="true"\]\)\) body/)
  assert.match(css,/html\[data-layout="duo"\] #app\.app \.tabbar\s*\{\s*background:transparent/)
  assert.match(read('src/version.js'),/0\.66\.41 \(147\)/)
})
