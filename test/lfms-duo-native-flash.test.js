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


test('all four main tabs share one actual mountain/title component and glass buttons',()=>{
  const shared=read('src/ui/main-tab-header.js')
  const today=read('src/ui/screens/today.js')
  const train=read('src/ui/screens/train.js')
  const fuel=read('src/ui/screens/fuel-next.js')
  const legacyFuel=read('src/ui/screens/fuel.js')
  const history=read('src/ui/screens/history.js')
  const css=read('src/lfms-session-duo.css')
  const screens=[today,train,fuel,history]
  assert.match(shared,/branding\/lfms\/logo-mark\.svg/)
  assert.match(shared,/div\.lfms-main-brand/)
  assert.match(shared,/img\.lfms-main-brand__mark/)
  assert.match(shared,/h1\.screen__title\.lfms-main-brand__title/)
  for(const source of screens){
    assert.match(source,/import \{ mainTabBrand \} from '\.\.\/main-tab-header\.js'/)
    assert.match(source,/mainTabBrand\(/)
    assert.match(source,/lfms-main-actions/)
  }
  assert.match(today,/mainTabBrand\(isRealToday\(\) \? 'Today' : 'Day review'/)
  assert.doesNotMatch(today,/el\('p\.today-heading__date'/)
  assert.match(train,/mainTabBrand\('Train'/)
  assert.doesNotMatch(train,/LFMS \/ TRAINING/)
  assert.match(fuel,/mainTabBrand\('Fuel'/)
  assert.match(legacyFuel,/mainTabBrand\('Fuel'/)
  assert.ok(legacyFuel.includes('nav.food-v2__header-actions.lfms-main-actions'))
  assert.ok(legacyFuel.includes('onclick: focusMealEntry'))
  assert.doesNotMatch(fuel,/small',\{text:' \/ FUEL'/)
  assert.match(history,/mainTabBrand\('Progress'/)
  assert.doesNotMatch(history,/LFMS \/ YOUR RESULTS/)
  for(const metric of ['width:44px','height:36px','font-size:26px','gap:8px','height:44px','border-radius:999px']){
    assert.ok(css.includes(metric),metric)
  }
  assert.match(css,/lfms-main-actions > button/)
  assert.match(css,/rgba\(199,232,255,\.36\)/)
  assert.match(css,/progress-views\.lfms-main-actions > button\[data-active="true"\]/)
  assert.ok(read('sw.js').includes("'./src/ui/main-tab-header.js'"))
})
