import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('the ordinary PWA retains its portrait-only contract', () => {
  const normal = JSON.parse(read('manifest.webmanifest'))
  assert.equal(normal.orientation, 'portrait')
  assert.equal(normal.start_url, '.')
  assert.doesNotMatch(read('manifest.webmanifest'), /layout=duo/)
})

test('the opt-in Duo manifest can launch unfolded', () => {
  const duo = JSON.parse(read('manifest-duo.webmanifest'))
  assert.equal(duo.orientation, 'any')
  assert.match(duo.start_url, /\?layout=duo$/)
  assert.equal(duo.scope, '.')
})

test('layout and manifest switch are enabled only by the exact Duo opt-in URL', () => {
  const html = read('index.html')
  assert.match(html, /get\('layout'\) === 'duo'/)
  assert.match(html, /dataset\.layout = 'duo'/)
  assert.match(html, /manifest-duo\.webmanifest/)
  assert.match(html, /src\/duo\.css/)
  assert.match(html, /href="\.\/manifest\.webmanifest"/)
})

test('the Duo rail is scoped and preserves a full-width workout view', () => {
  const css = read('src/duo.css')
  assert.match(css, /html\[data-layout="duo"\] \.tabbar \{/)
  assert.match(css, /flex-direction: column/)
  assert.match(css, /right: var\(--duo-rail-width\)/)
  assert.match(css, /\.tabbar\[hidden\] \{ display: none; \}/)
  assert.match(css, /#app:has\(\.tabbar\[hidden\]\) \.app__body/)
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('default portrait lock remains and Duo can bypass only the lock', () => {
  const js = read('src/ui/mobile-interactions.js')
  assert.match(js, /dataset\.layout === 'duo'\) return/)
  assert.match(js, /screen\.orientation\.lock\('portrait'\)/)
  assert.match(read('src/duo.css'), /\.portrait-lock \{ display: none; \}/)
})

test('service worker retains both shells for offline installs', () => {
  const sw = read('sw.js')
  assert.match(sw, /'\.\/manifest\.webmanifest'/)
  assert.match(sw, /'\.\/manifest-duo\.webmanifest'/)
  assert.match(sw, /'\.\/src\/duo\.css'/)
})
