import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('LFMS PWA theme and both manifests use the Duo soft-black canvas color',()=>{
  const html=read('index.html')
  const normal=JSON.parse(read('manifest.webmanifest'))
  const duo=JSON.parse(read('manifest-duo.webmanifest'))
  const tokens=read('src/tokens.css')
  assert.match(html,/<meta name="theme-color" content="#101820"/)
  for(const manifest of [normal,duo]){
    assert.equal(manifest.theme_color,'#101820')
    assert.equal(manifest.background_color,'#101820')
  }
  assert.match(tokens,/--lfms-duo-canvas:\s*#101820/)
  // Keep the blue card palette and saved gradient tokens for a future experiment.
  assert.match(tokens,/--food-v2-deep:\s*#061424/)
  assert.match(tokens,/--lfms-today-canvas-start/)
})

test('Duo draws only solid root/body color behind launch, content and rail',()=>{
  const css=read('src/lfms-finish.css')
  assert.match(css,/html\[data-layout="duo"\] body::before\s*\{[^}]*content:none;[^}]*display:none;/)
  assert.match(css,/html\[data-layout="duo"\] body\s*\{[^}]*background:var\(--lfms-duo-canvas\);[^}]*background-image:none;/)
  assert.match(css,/html\[data-layout="duo"\] \.lfms-launch\s*\{[^}]*background:none;[^}]*box-shadow:none;/)
  assert.match(css,/html\[data-layout="duo"\] \.lfms-launch__glow \{display:none\}/)
  assert.ok(css.includes('html[data-layout="duo"] .status-bar-cover {display:none}'))
  assert.doesNotMatch(css,/--lfms-duo-status-backdrop/)
  assert.doesNotMatch(read('src/tokens.css'),/--lfms-duo-status-backdrop/)
  const brand=read('src/brand.css')
  assert.ok(brand.includes('html:not([data-layout="duo"]):has(.lfms-launch'))
  assert.match(css,/html\[data-layout="duo"\] #app\.app \.tabbar\s*\{\s*background:transparent/)
  assert.match(css,/html\[data-layout="duo"\]:has\(\.lfms-launch:not\(\[data-closing="true"\]\)\) #app\.app\s*\{[^}]*opacity:0;[^}]*visibility:hidden;/)
  assert.match(css,/html\[data-layout="duo"\]:has\(\.lfms-launch\[data-closing="true"\]\) #app\.app\s*\{[^}]*opacity:1;[^}]*visibility:visible;/)
  assert.match(css,/transition:opacity 180ms ease-out,visibility 0s linear 180ms/)
  assert.match(read('src/main.js'),/dataset\.layout === 'duo' \? 200 : 520/)
  assert.match(read('src/version.js'),/0\.66\.49 \(155\)/)
})

test('Duo top header surfaces share Today charcoal without replacing button actions',()=>{
  const css=read('src/lfms-session-duo.css')
  assert.match(css,/LFMS 0\.66\.48 — one charcoal header system/)
  assert.match(css,/--lfms-topbar-surface:var\(--lfms-duo-canvas\)/)
  for(const name of [
    'train2__heading','train-r4__subheader','fn2__heading',
    'food-v2__topline','progress-header','sessionbar--r3',
    'cardio-r5__header','mobility-screen__head',
    'weekly-recap__header','plate-calculator__header',
    'fn2__sheet-head','session-art-viewer__bar'
  ])assert.ok(css.includes('.'+name),name)
  assert.match(css,/background:var\(--lfms-topbar-surface\)/)
  assert.match(css,/--lfms-topbar-control:var\(--food-v2-panel-2\)/)
  assert.match(css,/html\[data-layout="duo"\] #app\.app \.screen--session \.sessionbar--r3/)
  assert.match(css,/\.screen--session,\.screen--cardio,\.mobility-screen/)
  // The user-approved Today header and its settings button are untouched.
  assert.ok(!css.includes('html[data-layout="duo"] .today-heading'))
  assert.ok(read('src/ui/screens/today.js').includes('button.today-settings'))
  assert.ok(read('src/ui/screens/session.js').includes('button.sessionbar__finish'))
})
