import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const index = read('index.html')
const manifest = read('manifest.webmanifest')
const mobile = read('src/ui/mobile-interactions.js')
const mobileCss = read('src/mobile-fixes.css')

test('REGRESSION: installed app locks visual viewport against pinch zoom drift', () => {
  assert.match(index, /name="viewport"[^>]*maximum-scale=1[^>]*user-scalable=no/)
  assert.match(index, /touch-action:\s*pan-x pan-y/)
})

test('REGRESSION: content starts with a deliberate 32px gap below the safe area', () => {
  assert.match(index, /padding-top:\s*calc\(max\(var\(--s4\), env\(safe-area-inset-top\)\) \+ var\(--s5\)\)/)
})

test('REGRESSION: phone experiences stay in portrait', () => {
  assert.equal(JSON.parse(manifest).orientation, 'portrait')
  assert.match(mobile, /orientation\.lock\(['"]portrait['"]\)/)
  assert.match(index, /class="portrait-lock"/)
  assert.match(mobileCss, /@media \(orientation: landscape\).*\(pointer: coarse\)/)
})
